import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { StripeCardForm } from "@/components/stripe-card-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { gigPackagesQuery, gigQuery, money } from "@/lib/fivesom";
import {
  confirmOrderPayment,
  createOrderPaymentIntent,
  getStripePublishableKey,
} from "@/lib/stripe.functions";

type CheckoutSearch = { pkg?: string };

/** Flat buyer service fee — $1 per order. */
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

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

function CheckoutPage() {
  const { gigId } = Route.useParams();
  const { pkg: pkgId } = Route.useSearch();
  const { user } = useSession();
  const navigate = useNavigate();

  const gig = useQuery(gigQuery(gigId));
  const packages = useQuery(gigPackagesQuery(gigId));
  const stripeKey = useQuery({
    queryKey: ["stripe-publishable-key"],
    queryFn: () => getStripePublishableKey(),
    staleTime: Infinity,
  });

  const [method, setMethod] = useState<"card" | "manual">("card");
  const [proof, setProof] = useState<File | null>(null);
  const [pay, setPay] = useState<{ orderId: string; clientSecret: string } | null>(null);

  const selected = packages.data?.find((p) => p.id === pkgId) ?? packages.data?.[0] ?? null;
  const price = Number(selected?.price ?? gig.data?.base_price ?? 0);
  const serviceFee = BUYER_FEE;
  const total = Math.round((price + serviceFee) * 100) / 100;

  async function createOrder(payment: "stripe" | "manual", proofUrl: string | null) {
    if (!user || !gig.data) throw new Error("Missing session");
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        gig_id: gig.data.id,
        buyer_id: user.id,
        freelancer_id: gig.data.freelancer_id,
        amount: total,
        package_name: selected?.name ?? selected?.package_type ?? "basic",
        status: "pending",
        payment_method: payment,
        payment_status: "pending",
        ...(proofUrl ? { payment_proof_url: proofUrl } : {}),
      })
      .select("id")
      .single();
    if (error) throw error;
    return order.id as string;
  }

  /** Card: create the order, then a Stripe PaymentIntent, then reveal Stripe Elements. */
  const startCard = useMutation({
    mutationFn: async () => {
      const orderId = pay?.orderId ?? (await createOrder("stripe", null));
      const res = await createOrderPaymentIntent({ data: { orderId } });
      return { orderId, clientSecret: res.clientSecret };
    },
    onSuccess: setPay,
    onError: (e: Error) => toast.error(e.message),
  });

  /** Manual/bank transfer: upload proof, create order pending verification. */
  const submitManual = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Missing session");
      if (!proof) throw new Error("Upload your payment proof to continue");
      const path = `${user.id}/${Date.now()}-${sanitize(proof.name)}`;
      const up = await supabase.storage.from("order-requirements").upload(path, proof);
      if (up.error) throw up.error;
      return createOrder("manual", up.data.path);
    },
    onSuccess: (orderId) => {
      toast.success("Proof submitted — payment is pending verification.");
      navigate({ to: "/orders/$orderId/requirements", params: { orderId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /**
   * Card is the default method, so prepare the PaymentIntent as soon as the
   * publishable key is available. Stripe Elements then renders inline with no
   * extra click and no blocking prompt.
   */
  const started = useRef(false);
  useEffect(() => {
    if (method !== "card" || pay || !publishableKeyReady || started.current) return;
    started.current = true;
    startCard.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, pay, publishableKeyReady]);


  async function handlePaid(paymentIntentId: string) {
    if (!pay) return;
    try {
      const res = await confirmOrderPayment({
        data: { orderId: pay.orderId, paymentIntentId },
      });
      if (!res.paid) throw new Error("Payment is still processing. Please refresh in a moment.");
      toast.success("Payment successful — your order has been placed.");
      navigate({ to: "/orders/$orderId/requirements", params: { orderId: pay.orderId } });
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

  const publishableKey = stripeKey.data?.publishableKey ?? null;

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
          <Row label="Buyer's service fee" value={money(serviceFee)} />
          <div className="border-t border-border pt-2">
            <Row label="Total due now" value={money(total)} strong />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            {method === "card" ? (
              <CreditCard className="h-5 w-5 text-primary" />
            ) : (
              <Building2 className="h-5 w-5 text-primary" />
            )}
            <div>
              <p className="text-base font-bold">
                {method === "card" ? "Card Payment" : "Bank Transfer"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {method === "card"
                  ? "Secure card payment powered by Stripe"
                  : "Transfer manually and upload your proof"}
              </p>
            </div>
          </div>

          {!pay ? (
            <div className="space-y-2">
              <Label>Payment method</Label>
              {(
                [
                  { key: "card", title: "Card via Stripe", sub: "Visa, Mastercard and more" },
                  { key: "manual", title: "Bank transfer / manual", sub: "Upload your payment proof" },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${
                    method === m.key ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <span
                    className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${
                      method === m.key ? "border-primary bg-primary" : "border-border"
                    }`}
                  />
                  <span>
                    <span className="block text-sm font-semibold">{m.title}</span>
                    <span className="block text-[11px] text-muted-foreground">{m.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {method === "card" ? (
            publishableKey === null && !stripeKey.isLoading ? (
              <p className="rounded-lg bg-destructive/10 p-2.5 text-[11px] font-medium text-destructive">
                Card payments are not configured yet. Add your Stripe keys to enable them.
              </p>
            ) : pay && publishableKey ? (
              <StripeCardForm
                publishableKey={publishableKey}
                clientSecret={pay.clientSecret}
                amountLabel={money(total)}
                onPaid={handlePaid}
              />
            ) : (
              <div className="space-y-3">
                <Skeleton className="h-11 rounded-xl" />
                <Skeleton className="h-12 rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-12 rounded-xl" />
                  <Skeleton className="h-12 rounded-xl" />
                </div>
                <p className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Preparing secure card form…
                </p>
              </div>
            )
          ) : null}


          {method === "manual" ? (
            <div className="space-y-3">
              <div className="space-y-1 rounded-xl bg-muted/50 p-3 text-[12px]">
                <p className="font-semibold">FIVESOM bank details</p>
                <p className="text-muted-foreground">Bank: Premier Bank</p>
                <p className="text-muted-foreground">Account name: FIVESOM Technologies</p>
                <p className="text-muted-foreground">Account number: 0201-000-123456</p>
                <p className="mt-1 font-medium">Amount to transfer: {money(total)}</p>
                <p className="font-medium">
                  Reference: FIVESOM-{gig.data.id.slice(0, 8).toUpperCase()}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proof">Payment proof (image or PDF)</Label>
                <Input
                  id="proof"
                  type="file"
                  accept="image/*,application/pdf"
                  className="rounded-xl"
                  onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                />
              </div>

              <Button
                className="h-12 w-full rounded-xl text-base"
                disabled={submitManual.isPending}
                onClick={() => submitManual.mutate()}
              >
                {submitManual.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit payment proof
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Your order will show “Pending verification” until an admin approves the transfer.
              </p>
            </div>
          ) : null}
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
