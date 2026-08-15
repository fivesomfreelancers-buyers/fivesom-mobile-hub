import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfiles } from "@/lib/messaging";
import {
  notificationPermission,
  primeAlertSound,
  registerNotificationWorker,
  showFivesomAlert,
} from "@/lib/notify";

/**
 * Watches for incoming messages and raises a FIVESOM notification (chime +
 * OS drop-down with the sender's name, photo and a Reply action) whenever the
 * user is not actively reading that conversation.
 */
export function useMessageAlerts(): void {
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  // Unlock the audio context on the first interaction of the session.
  useEffect(() => {
    const unlock = () => primeAlertSound();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    if (notificationPermission() === "granted") void registerNotificationWorker();
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Notification clicks from the service worker deep-link into the thread.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; url?: string } | undefined;
      if (data?.type === "fivesom-notification-click" && data.url) {
        void navigate({ to: data.url });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`fivesom-alerts-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            conversation_id: string | null;
            sender_id: string | null;
            message: string | null;
            attachment_url?: string | null;
          };
          void qc.invalidateQueries({ queryKey: ["inbox"] });

          const url = row.conversation_id ? `/messages/${row.conversation_id}` : "/messages";
          const reading =
            document.visibilityState === "visible" && pathRef.current === url;
          if (reading) return;

          void (async () => {
            let name = "New message";
            let icon: string | null = null;
            if (row.sender_id) {
              const profiles = await fetchProfiles([row.sender_id]);
              const p = profiles.get(row.sender_id);
              if (p?.full_name) name = p.full_name;
              icon = p?.profile_image_url ?? null;
            }
            await showFivesomAlert({
              title: `${name} · FIVESOM`,
              body: row.message?.trim() || "Sent you an attachment",
              icon,
              url,
              tag: `conversation-${row.conversation_id ?? "new"}`,
            });
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}
