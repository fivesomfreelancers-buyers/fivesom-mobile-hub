import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreditCard, Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { StripeCardForm } from "@/components/stripe-card-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { gigPackagesQuery, gigQuery, money } from "@/lib/fivesom";
import {
  confirmOrderPayment,
  getStripePublishableKey,
  startGigCheckout,
} from "@/lib/stripe.functions";

type CheckoutSearch = { pkg?: string };

/** Flat buyer service fee — $1 per order (also enforced server-side). */
const BUYER_FEE = 1;

export const Route = createFileRoute("/_authenticated/checkout/$gigId")({
  validateSearch: (raw: Record<string, unknown>): CheckoutSearch =>
    typeof raw['pkg'] === "string" && raw['pkg'] ? { pkg: raw['pkg'] } : {},
  head: () => ({
    meta: [
      { title: "Secure Payment — FIVESOM" },
      { name: "description", content: "Pay securely with Stripe, then send your requirements to the seller." },
      { property: "og:title", content: "Secure Payment — FIVESOM" },
      { property: "og:description", content: "PCI-compliant card payments handled by Stripe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { gigId } = Route.useParams();
  const { pkg: pkgId } = Route.useSearch();
  const navigate = useNavigate();

  const gig = useQuery(gigQuery(gigId));
  const packages = useQuery(gigPackagesQuery(gigId));
  const stripeKey = useQuery({
    queryKey: ["stripe-publishable-key"],
    queryFn: () => getStripePublishableKey(),
    staleTime: Infinity,
  });

  const selected = packages.data?.find((p) => p.id === pkgId) ?? packages.data?.[0] ?? null;
  const price = Number(selected?.price ?? gig.data?.base_price ?? 0);
  const total = Math.round((price + BUYER_FEE) * 100) / 100;
  const publishableKey = stripeKey.data?.publishableKey ?? null;

  /** Creates the order + PaymentIntent server-side and reveals Stripe Elements. */
  const start = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Please sign in again to continue.");
      return startGigCheckout({
        data: { gigId, ...(pkgId ? { packageId: pkgId } : {}), accessToken },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Card is the only payment method, so prepare the secure form immediately.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !publishableKey || !gig.data) return;
    started.current = true;
    start.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishableKey, gig.data]);

  async function handlePaid(paymentIntentId: string) {
    const orderId = start.data?.orderId;
    if (!orderId) return;
    try {
      const res = await confirmOrderPayment({ data: { orderId, paymentIntentId } });
      if (!res.paid) throw new Error("Payment is still processing. Please refresh in a moment.");
      toast.success("Payment successful — your order has been placed.");
      navigate({ to: "/orders/$orderId/requirements", params: { orderId } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (gig.isLoading || packages.isLoading) {
    return (
      <MobileShell>
        <AppHeader title="Payment" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </MobileShell>
    );
  }
  if (!gig.data) {
    return (
      <MobileShell>
        <AppHeader title="Payment" />
        <p className="p-6 text-sm">This gig is no longer available.</p>
      </MobileShell>
    );
  }

  const amount = start.data ? Number(start.data.amount) : total;

  return (
    <MobileShell>
      <AppHeader title="Payment" />
      <div className="space-y-5 p-4 pb-24">
        <ol className="flex items-center gap-2 text-[11px] font-medium">
          {["Payment", "Requirements"].map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                  i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span className={i === 0 ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              {i === 0 ? <span className="h-px flex-1 bg-border" /> : null}
            </li>
          ))}
        </ol>

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="line-clamp-2 text-sm font-semibold">{gig.data.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selected?.name ?? "Basic"} · {selected?.delivery_time ?? `${gig.data.delivery_time_days ?? 3} days`} ·{" "}
            {selected?.revisions ?? "1"} revisions
          </p>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
          <Row label={selected?.name ?? "Package"} value={money(price)} />
          <Row label="Buyer's service fee" value={money(BUYER_FEE)} />
          <div className="border-t border-border pt-2">
            <Row label="Total due now" value={money(amount)} strong />
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <p className="text-base font-bold">Card Payment</p>
              <p className="text-[11px] text-muted-foreground">
                Secure card payment powered by Stripe (Live)
              </p>
            </div>
          </div>

          {publishableKey === null && !stripeKey.isLoading ? (
            <p className="rounded-lg bg-destructive/10 p-2.5 text-[11px] font-medium text-destructive">
              Card payments are not configured yet. Add your Stripe keys to enable them.
            </p>
          ) : start.isError ? (
            <div className="space-y-3">
              <p className="rounded-lg bg-destructive/10 p-2.5 text-[11px] font-medium text-destructive">
                {(start.error as Error).message}
              </p>
              <Button
                className="h-12 w-full rounded-xl text-base"
                disabled={start.isPending}
                onClick={() => start.mutate()}
              >
                Try again
              </Button>
            </div>
          ) : start.data && publishableKey ? (
            <StripeCardForm
              publishableKey={publishableKey}
              clientSecret={start.data.clientSecret}
              amountLabel={money(amount)}
              onPaid={handlePaid}
            />
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-14 rounded-xl" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
              <p className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Preparing secure card form…
              </p>
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "text-base font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}
