import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ChannelLogo } from "@/components/channel-logo";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { systemChannelQuery, type SystemChannelType } from "@/lib/messaging";

/**
 * The official FIVESOM Support / News channel screen. Shared by the
 * /support and /news shortcuts and by /messages/system/:id.
 */
export function SystemChannel({
  channelId,
  fallbackType,
}: {
  channelId: string;
  fallbackType?: SystemChannelType;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const channel = useQuery(systemChannelQuery(channelId));
  const type = channel.data?.conversation?.type ?? fallbackType ?? "support";
  const isSupport = type === "support";
  const title = isSupport ? "FIVESOM Support" : "FIVESOM News";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channel.data?.messages.length]);

  useEffect(() => {
    if (!channel.data?.conversation || !(channel.data.conversation.unread_user ?? 0)) return;
    void supabase
      .from("system_conversations")
      .update({ unread_user: 0 })
      .eq("id", channelId)
      .then(() => qc.invalidateQueries({ queryKey: ["inbox"] }));
  }, [channel.data?.conversation, channelId, qc]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("system_messages").insert({
        conversation_id: channelId,
        sender_type: "user",
        body,
      });
      if (error) throw error;
      await supabase
        .from("system_conversations")
        .update({ last_message: body, last_message_at: new Date().toISOString() })
        .eq("id", channelId);
    },
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey: ["system-channel", channelId] });
      void qc.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
          <Link
            to="/messages"
            className="grid h-9 w-9 place-items-center rounded-full border border-border"
            aria-label="Back to messages"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <ChannelLogo className="h-9 w-9" />

          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{title}</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {isSupport
                ? (channel.data?.conversation?.status ?? "Official channel")
                : "Official channel"}
            </p>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-28">
          {(channel.data?.messages ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {isSupport
                ? "Send us a message and the FIVESOM team will reply here."
                : "No announcements yet."}
            </p>
          ) : null}
          {(channel.data?.messages ?? []).map((m) => {
            const mine = m.sender_type === "user";
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  {m.attachment_url ? (
                    <a
                      href={m.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block text-xs underline"
                    >
                      Open attachment
                    </a>
                  ) : null}
                  <p
                    className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                  >
                    {new Date(m.created_at).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {isSupport && user ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) send.mutate(text.trim());
            }}
            className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center gap-2 border-t border-border bg-card px-3 py-3"
          >
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message FIVESOM Support..."
              className="h-11 rounded-full"
            />
            <button
              type="submit"
              disabled={send.isPending || !text.trim()}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
