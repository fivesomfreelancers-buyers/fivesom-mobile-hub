import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { gigPackagesQuery, gigQuery, money } from "@/lib/fivesom";
import { createOrderCheckoutSession } from "@/lib/stripe.functions";

type CheckoutSearch = { pkg?: string };

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

  const [method, setMethod] = useState<"card" | "manual">("card");
  const [proof, setProof] = useState<File | null>(null);

  const selected =
    packages.data?.find((p) => p.id === pkgId) ?? packages.data?.[0] ?? null;
  const price = selected?.price ?? gig.data?.base_price ?? 0;
  const serviceFee = Math.round(Number(price) * 0.05 * 100) / 100;
  const total = Math.round((Number(price) + serviceFee) * 100) / 100;

  const pay = useMutation({
    mutationFn: async () => {
      if (!user || !gig.data) throw new Error("Missing session");

      let proofUrl: string | null = null;
      if (method === "manual") {
        if (!proof) throw new Error("Upload your payment proof to continue");
        const path = `${user.id}/${Date.now()}-${sanitize(proof.name)}`;
        const up = await supabase.storage.from("order-requirements").upload(path, proof);
        if (up.error) throw up.error;
        proofUrl = up.data.path;
      }

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          gig_id: gig.data.id,
          buyer_id: user.id,
          freelancer_id: gig.data.freelancer_id,
          amount: total,
          package_name: selected?.name ?? selected?.package_type ?? "basic",
          status: "pending",
          payment_method: method === "card" ? "stripe" : "manual",
          payment_status: "pending",
          ...(proofUrl ? { payment_proof_url: proofUrl } : {}),
        })
        .select("id")
        .single();
      if (error) throw error;
      const orderId = order.id as string;

      if (method === "manual") return { orderId, url: null as string | null };

      const res = await createOrderCheckoutSession({
        data: { orderId, origin: window.location.origin },
      });
      return { orderId, url: res.url };
    },
    onSuccess: ({ orderId, url }) => {
      if (url) {
        window.location.href = url;
        return;
      }
      toast.success("Order created — now send your requirements.");
      navigate({ to: "/orders/$orderId/requirements", params: { orderId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
          <Row label="Buyer's service fee (5%)" value={money(serviceFee)} />
          <div className="border-t border-border pt-2">
            <Row label="Total due now" value={money(total)} strong />
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <p className="text-base font-bold">Card Payment</p>
              <p className="text-[11px] text-muted-foreground">
                Secure card payment powered by Stripe
              </p>
            </div>
          </div>

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

          {method === "manual" ? (
            <div className="space-y-1.5">
              <Label htmlFor="proof">Payment proof</Label>
              <Input
                id="proof"
                type="file"
                accept="image/*,application/pdf"
                className="rounded-xl"
                onChange={(e) => setProof(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : null}

          <Button
            className="h-12 w-full rounded-xl text-base"
            disabled={pay.isPending}
            onClick={() => pay.mutate()}
          >
            {pay.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Continue — Pay {money(total)}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            Card details are handled directly by Stripe. FIVESOM never stores them.
          </p>
          <p className="flex items-center justify-center gap-2 rounded-lg bg-success/10 p-2.5 text-[11px] font-medium text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            PCI-compliant live payments handled by Stripe
          </p>
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
