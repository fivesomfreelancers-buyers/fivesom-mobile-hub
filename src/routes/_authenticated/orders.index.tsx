import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { money, timeAgo } from "@/lib/fivesom";

export const Route = createFileRoute("/_authenticated/orders/")({
  head: () => ({
    meta: [
      { title: "Orders & Delivery — FIVESOM" },
      {
        name: "description",
        content: "Track your FIVESOM orders, deliveries and revisions as a buyer or freelancer.",
      },
      { property: "og:title", content: "Orders & Delivery — FIVESOM" },
      { property: "og:description", content: "Manage every order end to end on FIVESOM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

type Order = {
  id: string;
  gig_id: string | null;
  buyer_id: string;
  freelancer_id: string;
  status: string | null;
  amount: number | null;
  package_name: string | null;
  payment_status: string | null;
  requirements: string | null;
  created_at: string;
};

const TABS = ["all", "pending", "in_progress", "delivered", "completed", "cancelled"] as const;

function statusTone(status: string | null) {
  switch (status) {
    case "completed":
      return "bg-success/15 text-success";
    case "cancelled":
      return "bg-destructive/15 text-destructive";
    case "delivered":
      return "bg-warning/20 text-foreground";
    case "in_progress":
      return "bg-primary/15 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function OrdersPage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const [view, setView] = useState<"buying" | "selling">("buying");

  const orders = useQuery({
    queryKey: ["orders", user?.id, view],
    enabled: !!user?.id,
    queryFn: async (): Promise<Order[]> => {
      let query = supabase
        .from("orders")
        .select(
          "id, gig_id, buyer_id, freelancer_id, status, amount, package_name, payment_status, requirements, created_at",
        )
        .order("created_at", { ascending: false });
      if (view === "buying") {
        query = query.eq("buyer_id", user!.id);
      } else {
        const { data: fl } = await supabase
          .from("freelancers")
          .select("id")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (!fl?.id) return [];
        query = query.eq("freelancer_id", fl.id as string);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const gigIds = [...new Set((orders.data ?? []).map((o) => o.gig_id).filter(Boolean))] as string[];
  const gigTitles = useQuery({
    queryKey: ["order-gigs", gigIds.sort()],
    enabled: gigIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("gigs").select("id, title").in("id", gigIds);
      if (error) throw error;
      return new Map((data ?? []).map((g) => [g.id as string, g.title as string]));
    },
  });

  const list = (orders.data ?? []).filter((o) => (tab === "all" ? true : o.status === tab));

  async function updateStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Order marked ${status.replace("_", " ")}`);
    void qc.invalidateQueries({ queryKey: ["orders"] });
  }

  return (
    <MobileShell>
      <AppHeader title={view === "buying" ? "Delivery" : "Orders"} />
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["buying", "selling"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg py-2 text-xs font-semibold capitalize ${
                view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {v === "buying" ? "My Purchases" : "My Sales"}
            </button>
          ))}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium capitalize ${
                tab === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {t.replace("_", " ")}
            </button>
          ))}
        </div>

        {orders.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No {tab === "all" ? "" : tab.replace("_", " ")} orders yet.
            <div className="mt-3">
              <Link to="/" className="font-semibold text-primary">
                Browse gigs
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((o) => (
              <li key={o.id} className="rounded-xl border border-border bg-card p-4">
                <Link
                  to="/orders/$orderId"
                  params={{ orderId: o.id }}
                  className="flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {(o.gig_id && gigTitles.data?.get(o.gig_id)) ?? "Custom order"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {o.package_name ?? "Package"} · Ordered {timeAgo(o.created_at)} ago
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-success">
                    {money(o.amount)}
                  </span>
                </Link>


                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusTone(o.status)}`}
                  >
                    {(o.status ?? "pending").replace("_", " ")}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                    payment: {o.payment_status ?? "pending"}
                  </span>
                </div>

                {o.requirements ? (
                  <p className="mt-3 line-clamp-2 rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
                    {o.requirements}
                  </p>
                ) : null}

                <div className="mt-3 flex gap-2">
                  {view === "selling" && o.status === "pending" ? (
                    <Button size="sm" className="flex-1" onClick={() => updateStatus(o.id, "in_progress")}>
                      Accept Order
                    </Button>
                  ) : null}
                  {view === "selling" && o.status === "in_progress" ? (
                    <Button size="sm" className="flex-1" onClick={() => updateStatus(o.id, "delivered")}>
                      Mark Delivered
                    </Button>
                  ) : null}
                  {view === "buying" && o.status === "delivered" ? (
                    <Button size="sm" className="flex-1" onClick={() => updateStatus(o.id, "completed")}>
                      Accept & Complete
                    </Button>
                  ) : null}
                  {view === "buying" && (o.status === "pending" || o.status === "in_progress") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => updateStatus(o.id, "cancelled")}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MobileShell>
  );
}
