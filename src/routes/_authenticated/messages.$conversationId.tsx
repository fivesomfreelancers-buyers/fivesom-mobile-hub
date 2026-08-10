import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { initials, type PublicProfile } from "@/lib/fivesom";

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

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string | null;
  message: string | null;
  attachment_url: string | null;
  is_read: boolean | null;
  created_at: string;
};

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { user } = useSession();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const convo = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, buyer_id, freelancer_id")
        .eq("id", conversationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      let counterpartId: string | null = null;
      if (data.buyer_id === user?.id) {
        const { data: fl } = await supabase
          .from("public_freelancers")
          .select("user_id")
          .eq("id", data.freelancer_id)
          .maybeSingle();
        counterpartId = (fl?.user_id as string) ?? null;
      } else {
        counterpartId = data.buyer_id as string;
      }
      let counterpart: PublicProfile | null = null;
      if (counterpartId) {
        const { data: pr } = await supabase
          .from("public_profiles")
          .select(
            "id, full_name, username, profile_image_url, professional_title, bio, location, role, last_seen",
          )
          .eq("id", counterpartId)
          .maybeSingle();
        counterpart = (pr as PublicProfile) ?? null;
      }
      return { ...data, counterpart, counterpartId };
    },
  });

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ["messages", conversationId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data?.length]);

  // Mark incoming messages as read
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
      );
  }, [messages.data, user]);

  async function send(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!text.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      receiver_id: convo.data?.counterpartId ?? null,
      message: text.trim(),
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    void qc.invalidateQueries({ queryKey: ["messages", conversationId] });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
          <Link
            to="/messages"
            className="grid h-9 w-9 place-items-center rounded-full border border-border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Avatar className="h-9 w-9">
            <AvatarImage src={convo.data?.counterpart?.profile_image_url ?? undefined} alt="" />
            <AvatarFallback>{initials(convo.data?.counterpart?.full_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {convo.data?.counterpart?.full_name ?? "FIVESOM user"}
            </p>
            <p className="truncate text-[11px] capitalize text-muted-foreground">
              {convo.data?.counterpart?.role ?? ""}
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
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  <p
                    className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                  >
                    {new Date(m.created_at).toLocaleTimeString([], {
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

        <form
          onSubmit={send}
          className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md items-center gap-2 border-t border-border bg-card px-3 py-3"
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
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
