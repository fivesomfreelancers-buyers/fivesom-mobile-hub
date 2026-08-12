import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Signing you in — FIVESOM" },
      {
        name: "description",
        content: "Completing your secure FIVESOM sign-in and returning you to the app.",
      },
      { property: "og:title", content: "Signing you in — FIVESOM" },
      { property: "og:description", content: "Completing your secure FIVESOM sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthCallbackPage,
});

const NEXT_KEY = "fivesom-auth-next";

/** Only same-origin app paths may be used as a post-login destination. */
function safeNext(): string {
  if (typeof window === "undefined") return "/";
  const raw = window.sessionStorage.getItem(NEXT_KEY);
  window.sessionStorage.removeItem(NEXT_KEY);
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/auth")) return "/";
  return raw;
}

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let cancelled = false;

    async function finish(): Promise<void> {
      const url = new URL(window.location.href);
      const errorDescription =
        url.searchParams.get("error_description") ?? url.searchParams.get("error");

      if (errorDescription) {
        if (cancelled) return;
        setMessage(errorDescription);
        toast.error(errorDescription);
        navigate({ to: "/auth", replace: true });
        return;
      }

      // PKCE flow: exchange the ?code= for a persisted session.
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && !/code verifier|already/i.test(error.message)) {
          if (cancelled) return;
          toast.error(error.message);
          navigate({ to: "/auth", replace: true });
          return;
        }
      }

      // Implicit flow (#access_token=…) is handled by detectSessionInUrl; give
      // the client a tick to persist it before we read the session back.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!data.session) {
        const { data: retry } = await new Promise<Awaited<ReturnType<typeof supabase.auth.getSession>>>(
          (resolve) => setTimeout(() => void supabase.auth.getSession().then(resolve), 400),
        );
        if (cancelled) return;
        if (!retry.session) {
          toast.error("We couldn't complete the sign-in. Please try again.");
          navigate({ to: "/auth", replace: true });
          return;
        }
      }

      // Strip tokens/codes from the address bar, then continue into the app.
      window.history.replaceState({}, "", "/auth/callback");
      toast.success("Signed in");
      navigate({ to: safeNext(), replace: true });
    }

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Logo className="h-12 w-12" />
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
