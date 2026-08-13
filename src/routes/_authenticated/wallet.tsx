import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, CreditCard, Wallet as WalletIcon } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { money, timeAgo } from "@/lib/fivesom";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet, Earnings & Payments — FIVESOM" },
      {
        name: "description",
        content:
          "Freelancers track earnings, pending balance and withdrawals; buyers review every payment made on FIVESOM.",
      },
      { property: "og:title", content: "Wallet & Earnings — FIVESOM" },
      { property: "og:description", content: "Your FIVESOM balance, payouts and payment history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WalletPage,
});

type OrderRow = {
  id: string;
  amount: number | null;
  status: string | null;
  payment_status: string | null;
  package_name: string | null;
  created_at: string;
};

function WalletPage() {
  const { user } = useSession();
  const { isFreelancer, freelancerId, loading } = useRole();

  const wallet = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user?.id && isFreelancer,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as Record<string, unknown> | null;
    },
  });

  /** Sales feeding the freelancer's pending vs cleared earnings. */
  const sales = useQuery({
    queryKey: ["earnings-orders", freelancerId],
    enabled: !!freelancerId,
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, amount, status, payment_status, package_name, created_at")
        .eq("freelancer_id", freelancerId!)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  /** Every payment the buyer has actually made. */
  const purchases = useQuery({
    queryKey: ["payment-history", user?.id],
    enabled: !!user?.id && !isFreelancer,
    queryFn: async (): Promise<OrderRow[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, amount, status, payment_status, package_name, created_at")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const withdrawals = useQuery({
    queryKey: ["withdrawals", user?.id],
    enabled: !!user?.id && isFreelancer,
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("id, amount, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as { id: string; amount: number; status: string; created_at: string }[];
    },
  });

  if (loading) {
    return (
      <MobileShell>
        <AppHeader title="Wallet" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </MobileShell>
    );
  }

  if (!isFreelancer) {
    const list = purchases.data ?? [];
    const totalPaid = list
      .filter((o) => o.payment_status === "paid")
      .reduce((sum, o) => sum + Number(o.amount ?? 0), 0);
    return (
      <MobileShell>
        <AppHeader title="Payments" />
        <div className="space-y-5 px-4 pt-4">
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <p className="text-xs opacity-80">Total spent on FIVESOM</p>
            <p className="mt-1 text-3xl font-bold">{money(totalPaid)}</p>
            <p className="mt-2 text-xs opacity-80">
              {list.length} order{list.length === 1 ? "" : "s"} · same account as the website
            </p>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold">Payment history</h2>
            {purchases.isLoading ? (
              <Skeleton className="h-16 rounded-xl" />
            ) : list.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">No payments yet</p>
                <Button asChild variant="outline" className="mt-4 rounded-xl">
                  <Link to="/">Browse services</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((o) => (
                  <Link
                    key={o.id}
                    to="/orders/$orderId"
                    params={{ orderId: o.id }}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {o.package_name ?? "Order"} · #{o.id.slice(0, 8)}
                      </p>
                      <p className="text-[11px] capitalize text-muted-foreground">
                        {o.payment_status ?? "pending"} · {timeAgo(o.created_at)} ago
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold">{money(o.amount)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </MobileShell>
    );
  }

  const rows = sales.data ?? [];
  const pending = rows
    .filter((o) => o.status !== "completed" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const lifetime = rows
    .filter((o) => o.status === "completed")
    .reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const available = Number((wallet.data?.['balance'] as number | undefined) ?? 0);
  const withdrawn = (withdrawals.data ?? [])
    .filter((w) => w.status === "completed")
    .reduce((s, w) => s + Number(w.amount ?? 0), 0);

  return (
    <MobileShell>
      <AppHeader title="Earnings" />
      <div className="space-y-5 px-4 pt-4">
        {wallet.isLoading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <p className="text-xs opacity-80">Available balance</p>
            <p className="mt-1 text-3xl font-bold">{money(available)}</p>
            <p className="mt-2 text-xs opacity-80">
              Funds clear to your balance once the buyer accepts the delivery.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Pending" value={money(pending)} />
          <Metric label="Lifetime" value={money(lifetime)} />
          <Metric label="Withdrawn" value={money(withdrawn)} />
        </div>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Recent sales</h2>
          {sales.isLoading ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              No paid orders yet.
            </p>
          ) : (
            <div className="space-y-2">
              {rows.slice(0, 15).map((o) => (
                <Link
                  key={o.id}
                  to="/orders/$orderId"
                  params={{ orderId: o.id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {o.package_name ?? "Order"} · #{o.id.slice(0, 8)}
                    </p>
                    <p className="text-[11px] capitalize text-muted-foreground">
                      {(o.status ?? "pending").replace("_", " ")} · {timeAgo(o.created_at)} ago
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      o.status === "completed" ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {money(o.amount)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Withdrawal history</h2>
          {withdrawals.isLoading ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : (withdrawals.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <WalletIcon className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">No withdrawals yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Withdrawals are requested and processed on the FIVESOM website.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {(withdrawals.data ?? []).map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                    <ArrowDownToLine className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{money(w.amount)}</p>
                    <p className="text-xs capitalize text-muted-foreground">{w.status}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(w.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </MobileShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
