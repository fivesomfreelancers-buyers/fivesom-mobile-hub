import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, Wallet as WalletIcon } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { money, timeAgo } from "@/lib/fivesom";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({
    meta: [
      { title: "Wallet & Earnings — FIVESOM" },
      { name: "description", content: "Track your FIVESOM balance, earnings and withdrawal history." },
      { property: "og:title", content: "Wallet & Earnings — FIVESOM" },
      { property: "og:description", content: "Your FIVESOM balance and payouts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { user } = useSession();

  const wallet = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as Record<string, unknown> | null;
    },
  });

  const withdrawals = useQuery({
    queryKey: ["withdrawals", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawals")
        .select("id, amount, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as { id: string; amount: number; status: string; created_at: string }[];
    },
  });

  const balance = Number((wallet.data?.['balance'] as number | undefined) ?? 0);

  return (
    <MobileShell>
      <AppHeader title="Wallet" />
      <div className="space-y-5 px-4 pt-4">
        {wallet.isLoading ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : (
          <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
            <p className="text-xs opacity-80">Available balance</p>
            <p className="mt-1 text-3xl font-bold">{money(balance)}</p>
            <p className="mt-2 text-xs opacity-80">
              Withdrawals are processed from the FIVESOM website.
            </p>
          </div>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold">Withdrawal history</h2>
          {withdrawals.isLoading ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : (withdrawals.data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <WalletIcon className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">No withdrawals yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Complete orders to build up your balance.
              </p>
              <Button asChild variant="outline" className="mt-4 rounded-xl">
                <Link to="/orders">View orders</Link>
              </Button>
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
