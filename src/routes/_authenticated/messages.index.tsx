import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { initials, timeAgo, type PublicProfile } from "@/lib/fivesom";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({
    meta: [
      { title: "Messages — FIVESOM" },
      { name: "description", content: "Chat with buyers and freelancers about your FIVESOM orders." },
      { property: "og:title", content: "Messages — FIVESOM" },
      { property: "og:description", content: "Your FIVESOM conversations in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagesPage,
});

type ConversationRow = {
  id: string;
  buyer_id: string;
  freelancer_id: string;
  created_at: string;
  counterpart?: PublicProfile | undefined;
  lastMessage?: { message: string | null; created_at: string; is_read: boolean | null } | undefined;
  unread: number;
};

function MessagesPage() {
  const { user } = useSession();
  const [search, setSearch] = useState("");

  const conversations = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user?.id,
    refetchInterval: 15000,
    queryFn: async (): Promise<ConversationRow[]> => {
      const { data: fl } = await supabase
        .from("freelancers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      const freelancerId = fl?.id as string | undefined;

      const filters = [`buyer_id.eq.${user!.id}`];
      if (freelancerId) filters.push(`freelancer_id.eq.${freelancerId}`);
      const { data, error } = await supabase
        .from("conversations")
        .select("id, buyer_id, freelancer_id, created_at")
        .or(filters.join(","))
        .order("created_at", { ascending: false });
      if (error) throw error;
      const convos = (data ?? []) as ConversationRow[];
      if (!convos.length) return [];

      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id, message, created_at, is_read, receiver_id")
        .in(
          "conversation_id",
          convos.map((c) => c.id),
        )
        .order("created_at", { ascending: false });

      // Resolve counterpart profiles
      const otherUserIds = new Set<string>();
      const freelancerRowIds = convos
        .filter((c) => c.buyer_id === user!.id)
        .map((c) => c.freelancer_id);
      let freelancerUserById = new Map<string, string>();
      if (freelancerRowIds.length) {
        const { data: fls } = await supabase
          .from("public_freelancers")
          .select("id, user_id")
          .in("id", freelancerRowIds);
        freelancerUserById = new Map((fls ?? []).map((f) => [f.id as string, f.user_id as string]));
        for (const v of freelancerUserById.values()) otherUserIds.add(v);
      }
      for (const c of convos) if (c.buyer_id !== user!.id) otherUserIds.add(c.buyer_id);

      let profiles = new Map<string, PublicProfile>();
      if (otherUserIds.size) {
        const { data: pr } = await supabase
          .from("public_profiles")
          .select(
            "id, full_name, username, profile_image_url, professional_title, bio, location, role, last_seen",
          )
          .in("id", [...otherUserIds]);
        profiles = new Map(((pr ?? []) as PublicProfile[]).map((p) => [p.id, p]));
      }

      return convos.map((c) => {
        const counterpartUserId =
          c.buyer_id === user!.id ? freelancerUserById.get(c.freelancer_id) : c.buyer_id;
        const cMsgs = (msgs ?? []).filter((m) => m.conversation_id === c.id);
        return {
          ...c,
          counterpart: counterpartUserId ? profiles.get(counterpartUserId) : undefined,
          lastMessage: cMsgs[0]
            ? {
                message: cMsgs[0].message as string | null,
                created_at: cMsgs[0].created_at as string,
                is_read: cMsgs[0].is_read as boolean | null,
              }
            : undefined,
          unread: cMsgs.filter((m) => m.receiver_id === user!.id && !m.is_read).length,
        };
      });
    },
  });

  const list = (conversations.data ?? []).filter((c) =>
    search
      ? (c.counterpart?.full_name ?? "").toLowerCase().includes(search.toLowerCase())
      : true,
  );

  return (
    <MobileShell>
      <AppHeader title="Messages" />
      <div className="space-y-4 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search messages..."
            className="h-11 rounded-xl pl-9"
          />
        </div>

        {conversations.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No conversations yet. Message a seller from a gig to start one.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {list.map((c) => (
              <li key={c.id}>
                <Link
                  to="/messages/$conversationId"
                  params={{ conversationId: c.id }}
                  className="flex items-center gap-3 p-3"
                >
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={c.counterpart?.profile_image_url ?? undefined} alt="" />
                    <AvatarFallback>{initials(c.counterpart?.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">
                        {c.counterpart?.full_name ?? "FIVESOM user"}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(c.lastMessage?.created_at ?? c.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {c.lastMessage?.message ?? "No messages yet"}
                      </p>
                      {c.unread > 0 ? (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {c.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
