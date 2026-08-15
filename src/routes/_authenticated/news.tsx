import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Newspaper } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { SystemChannel } from "@/components/system-channel";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { timeAgo } from "@/lib/fivesom";
import { systemChannelIdQuery } from "@/lib/messaging";

export const Route = createFileRoute("/_authenticated/news")({
  head: () => ({
    meta: [
      { title: "FIVESOM News & Announcements" },
      {
        name: "description",
        content: "Official FIVESOM announcements, platform updates and marketplace news.",
      },
      { property: "og:title", content: "FIVESOM News" },
      { property: "og:description", content: "Official FIVESOM announcements and platform updates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { user } = useSession();
  const channel = useQuery(systemChannelIdQuery(user?.id, "news"));

  if (channel.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (channel.data) return <SystemChannel channelId={channel.data} fallbackType="news" />;

  return (
    <MobileShell>
      <AppHeader title="FIVESOM News" />
      <NewsFeed />
    </MobileShell>
  );
}

/** Read-only fallback: platform announcements published from the backend. */
function NewsFeed() {
  const news = useQuery({
    queryKey: ["platform-news"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news")
        .select("id, title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) return [];
      return (data ?? []) as { id: string; title: string | null; body: string | null; created_at: string }[];
    },
  });

  const items = news.data ?? [];

  return (
    <div className="space-y-3 px-4 pt-4">
      {items.length === 0 ? (
        <div className="rounded-2xl bg-accent-pink/10 p-6 text-center">
          <Newspaper className="mx-auto h-6 w-6 text-accent-pink" />
          <p className="mt-2 text-sm font-semibold">No announcements yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            FIVESOM updates and platform news will appear here.
          </p>
        </div>
      ) : null}
      {items.map((n) => (
        <article key={n.id} className="rounded-xl border border-accent-pink/30 bg-card p-4">
          <h2 className="text-sm font-semibold">{n.title}</h2>
          <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
            {n.body}
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">{timeAgo(n.created_at)} ago</p>
        </article>
      ))}
    </div>
  );
}
