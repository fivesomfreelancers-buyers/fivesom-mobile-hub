import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Search } from "lucide-react";
import { useState } from "react";

import { AppHeader } from "@/components/app-header";
import { ChannelLogo } from "@/components/channel-logo";
import { MobileShell } from "@/components/mobile-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { initials, isOnline, timeAgo } from "@/lib/fivesom";
import { inboxQuery } from "@/lib/messaging";

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

function MessagesPage() {
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const inbox = useQuery(inboxQuery(user?.id));

  const list = (inbox.data ?? []).filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name =
      c.kind === "system"
        ? c.channel === "support"
          ? "fivesom support"
          : "fivesom news"
        : `${c.counterpart?.full_name ?? ""} ${c.counterpart?.username ?? ""}`.toLowerCase();
    return name.includes(q) || (c.lastMessage ?? "").toLowerCase().includes(q);
  });

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

        {inbox.isLoading ? (
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
            {list.map((c) => {
              const isSystem = c.kind === "system";
              const name = isSystem
                ? c.channel === "support"
                  ? "FIVESOM Support"
                  : "FIVESOM News"
                : (c.counterpart?.full_name ?? "FIVESOM user");
              const online = !isSystem && isOnline(c.counterpart?.last_seen);
              return (
                <li key={`${c.kind}-${c.id}`}>
                  <Link
                    to={isSystem ? "/messages/system/$channelId" : "/messages/$conversationId"}
                    params={
                      isSystem
                        ? ({ channelId: c.id } as never)
                        : ({ conversationId: c.id } as never)
                    }
                    className="flex items-center gap-3 p-3"
                  >
                    <div className="relative">
                      {isSystem ? (
                        <ChannelLogo className="h-11 w-11" />
                      ) : (

                        <Avatar className="h-11 w-11">
                          <AvatarImage
                            src={c.counterpart?.profile_image_url ?? undefined}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <AvatarFallback>{initials(c.counterpart?.full_name)}</AvatarFallback>
                        </Avatar>
                      )}
                      {online ? (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1 truncate text-sm font-semibold">
                          <span className="truncate">{name}</span>
                          {isSystem ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                        </p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {timeAgo(c.lastAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">
                          {c.lastMessage ?? "No messages yet"}
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
              );
            })}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
