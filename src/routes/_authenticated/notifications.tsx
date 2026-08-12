import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ClipboardList, MessageSquare } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { money, timeAgo } from "@/lib/fivesom";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — FIVESOM" },
      { name: "description", content: "New orders, deliveries and unread messages on your FIVESOM account." },
      { property: "og:title", content: "Notifications — FIVESOM" },
      { property: "og:description", content: "Stay on top of every order and message." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

type Item = {
  id: string;
  kind: "order" | "message";
  title: string;
  body: string;
  at: string;
};

function NotificationsPage() {
  const { user } = useSession();

  const feed = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user?.id,
    refetchInterval: 20000,
    queryFn: async (): Promise<Item[]> => {
      const { data: fl } = await supabase
        .from("freelancers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      const freelancerId = fl?.id as string | undefined;

      const filters = [`buyer_id.eq.${user!.id}`];
      if (freelancerId) filters.push(`freelancer_id.eq.${freelancerId}`);

      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, amount, package_name, created_at, updated_at, buyer_id, freelancer_id")
        .or(filters.join(","))
        .order("updated_at", { ascending: false })
        .limit(20);

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, conversation_id, message, created_at, is_read, receiver_id")
        .eq("receiver_id", user!.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);

      const orderItems: Item[] = (orders ?? []).map((o) => ({
        id: `order-${o.id as string}`,
        kind: "order" as const,
        title:
          o.freelancer_id === freelancerId && o.buyer_id !== user!.id
            ? `Order ${String(o.status ?? "updated").replace("_", " ")}`
            : `Your order is ${String(o.status ?? "updated").replace("_", " ")}`,
        body: `${o.package_name ?? "Package"} · ${money(o.amount as number)}`,
        at: (o.updated_at ?? o.created_at) as string,
      }));

      const msgItems: Item[] = (msgs ?? []).map((m) => ({
        id: `msg-${m.id as string}`,
        kind: "message" as const,
        title: "New message",
        body: (m.message as string | null) ?? "Attachment",
        at: m.created_at as string,
      }));

      return [...orderItems, ...msgItems].sort(
        (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
      );
    },
  });

  return (
    <MobileShell>
      <AppHeader title="Notifications" />
      <div className="space-y-3 px-4 pt-4">
        {feed.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
        ) : (feed.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">You're all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">
              New orders and messages will show up here.
            </p>
            <Button asChild className="mt-4 rounded-xl">
              <Link to="/search">Explore gigs</Link>
            </Button>
          </div>
        ) : (
          (feed.data ?? []).map((n) => (
            <Link
              key={n.id}
              to={n.kind === "order" ? "/orders" : "/messages"}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
            >
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                {n.kind === "order" ? (
                  <ClipboardList className="h-4 w-4" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="truncate text-xs text-muted-foreground">{n.body}</p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(n.at)}</span>
            </Link>
          ))
        )}
      </div>
    </MobileShell>
  );
}
