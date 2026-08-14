import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, CheckCheck, Loader2, Paperclip, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { initials, isOnline, type PublicProfile } from "@/lib/fivesom";
import {
  fileNameFromUrl,
  isImageUrl,
  uploadAttachment,
  type ChatMessage,
} from "@/lib/messaging";

export const Route = createFileRoute("/_authenticated/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversation — FIVESOM" },
      { name: "description", content: "Your FIVESOM conversation with a buyer or freelancer." },
      { property: "og:title", content: "Conversation — FIVESOM" },
      { property: "og:description", content: "Chat in real time on FIVESOM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConversationPage,
});

const PROFILE_COLUMNS =
  "id, full_name, username, profile_image_url, professional_title, bio, location, role, last_seen";

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { user } = useSession();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const convo = useQuery({
    queryKey: ["conversation", conversationId, user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, buyer_id, freelancer_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      // Both columns store auth user ids (same model as the website).
      const counterpartId =
        data.buyer_id === user?.id ? (data.freelancer_id as string) : (data.buyer_id as string);
      const { data: pr } = await supabase
        .from("public_profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", counterpartId)
        .maybeSingle();
      return { ...data, counterpartId, counterpart: (pr as PublicProfile) ?? null };
    },
  });

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    refetchInterval: 15000,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, conversation_id, sender_id, receiver_id, message, attachment_url, is_read, created_at",
        )
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["messages", conversationId] });
          void qc.invalidateQueries({ queryKey: ["inbox"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  // Typing indicator over a presence/broadcast channel (no DB writes).
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`typing:${conversationId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, (payload) => {
        if ((payload["payload"] as { userId?: string } | undefined)?.userId === user.id) return;
        setPeerTyping(true);
        window.setTimeout(() => setPeerTyping(false), 2500);
      })
      .subscribe();
    typingChannel.current = ch;
    return () => {
      typingChannel.current = null;
      void supabase.removeChannel(ch);
    };
  }, [conversationId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length, peerTyping]);

  // Read receipts: mark incoming messages as read.
  useEffect(() => {
    if (!user || !messages.data?.length) return;
    const unread = messages.data.filter((m) => m.receiver_id === user.id && !m.is_read);
    if (!unread.length) return;
    void supabase
      .from("messages")
      .update({ is_read: true })
      .in(
        "id",
        unread.map((m) => m.id),
      )
      .then(() => qc.invalidateQueries({ queryKey: ["inbox"] }));
  }, [messages.data, user, qc]);

  async function insertMessage(fields: { message?: string; attachment_url?: string }) {
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user!.id,
      receiver_id: convo.data?.counterpartId ?? null,
      message: fields.message ?? null,
      attachment_url: fields.attachment_url ?? null,
    });
    if (error) throw error;
    void qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    void qc.invalidateQueries({ queryKey: ["inbox"] });
  }

  async function send(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setSending(true);
    try {
      await insertMessage({ message: text.trim() });
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message not sent.");
    } finally {
      setSending(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Files must be 25 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAttachment(user.id, file);
      await insertMessage({ attachment_url: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const counterpart = convo.data?.counterpart;
  const online = isOnline(counterpart?.last_seen);

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
          <div className="relative">
            <Avatar className="h-9 w-9">
              <AvatarImage
                src={counterpart?.profile_image_url ?? undefined}
                alt=""
                className="h-full w-full object-cover"
              />
              <AvatarFallback>{initials(counterpart?.full_name)}</AvatarFallback>
            </Avatar>
            {online ? (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {counterpart?.full_name ?? "FIVESOM user"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {peerTyping
                ? "typing…"
                : online
                  ? "Online"
                  : counterpart?.username
                    ? `@${counterpart.username}`
                    : (counterpart?.role ?? "")}
            </p>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 pb-28">
          {(messages.data ?? []).length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No messages yet — say hello.
            </p>
          ) : null}
          {(messages.data ?? []).map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground"
                  }`}
                >
                  {m.attachment_url ? (
                    isImageUrl(m.attachment_url) ? (
                      <a href={m.attachment_url} target="_blank" rel="noreferrer">
                        <img
                          src={m.attachment_url}
                          alt="Attachment"
                          loading="lazy"
                          className="mb-1 max-h-60 w-full rounded-lg object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        href={m.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-1 flex items-center gap-2 rounded-lg bg-background/20 px-2 py-1.5 text-xs underline"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span className="truncate">{fileNameFromUrl(m.attachment_url)}</span>
                      </a>
                    )
                  ) : null}
                  {m.message ? (
                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  ) : null}
                  <p
                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                  >
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {mine ? (
                      m.is_read ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )
                    ) : null}
                  </p>
                </div>
              </div>
            );
          })}
          {peerTyping ? (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-xs text-muted-foreground">
                typing…
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={send}
          className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center gap-2 border-t border-border bg-card px-3 py-3"
        >
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={onPickFile}
            accept="image/*,video/*,.pdf,.doc,.docx,.zip,.rar,.txt,.csv,.xlsx,.psd,.ai"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-muted-foreground disabled:opacity-50"
            aria-label="Attach a file"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </button>
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              void typingChannel.current?.send({
                type: "broadcast",
                event: "typing",
                payload: { userId: user?.id },
              });
            }}
            placeholder="Type a message..."
            className="h-11 rounded-full"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
