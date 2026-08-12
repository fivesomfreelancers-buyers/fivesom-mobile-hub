import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, FileUp, Loader2, Paperclip, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { gigPackagesQuery, gigQuery, money } from "@/lib/fivesom";

type CheckoutSearch = { pkg?: string };

export const Route = createFileRoute("/_authenticated/checkout/$gigId")({
  validateSearch: (raw: Record<string, unknown>): CheckoutSearch =>
    typeof raw['pkg'] === "string" && raw['pkg'] ? { pkg: raw['pkg'] } : {},
  head: () => ({
    meta: [
      { title: "Checkout — FIVESOM" },
      { name: "description", content: "Send your requirements and complete your FIVESOM order securely." },
      { property: "og:title", content: "Checkout — FIVESOM" },
      { property: "og:description", content: "Requirements, files and payment for your FIVESOM order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CheckoutPage,
});

const MAX_FILE_MB = 25;

const schema = z.object({
  instructions: z
    .string()
    .trim()
    .min(10, "Please describe what you need (at least 10 characters)")
    .max(4000, "Instructions must be under 4000 characters"),
  links: z.array(z.string().trim().url("Enter a valid URL")).max(5),
});

function CheckoutPage() {
  const { gigId } = Route.useParams();
  const { pkg: pkgId } = Route.useSearch();
  const { user } = useSession();
  const navigate = useNavigate();

  const gig = useQuery(gigQuery(gigId));
  const packages = useQuery(gigPackagesQuery(gigId));

  const [step, setStep] = useState<1 | 2>(1);
  const [instructions, setInstructions] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [method, setMethod] = useState<"card" | "manual">("card");
  const [proof, setProof] = useState<File | null>(null);

  const selected =
    packages.data?.find((p) => p.id === pkgId) ?? packages.data?.[0] ?? null;
  const price = selected?.price ?? gig.data?.base_price ?? 0;
  const serviceFee = Math.round(Number(price) * 0.05 * 100) / 100;
  const total = Math.round((Number(price) + serviceFee) * 100) / 100;

  const place = useMutation({
    mutationFn: async () => {
      if (!user || !gig.data) throw new Error("Missing session");
      const parsed = schema.safeParse({ instructions, links });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

      let proofUrl: string | null = null;
      if (method === "manual" && proof) {
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
          requirements: parsed.data.instructions,
          ...(proofUrl ? { payment_proof_url: proofUrl } : {}),
        })
        .select("id")
        .single();
      if (error) throw error;
      const orderId = order.id as string;

      const { data: req, error: reqErr } = await supabase
        .from("order_requirements")
        .insert({
          order_id: orderId,
          instructions: parsed.data.instructions,
          external_links: parsed.data.links,
        })
        .select("id")
        .single();
      if (reqErr) throw reqErr;

      for (const file of files) {
        const path = `${user.id}/${orderId}/${Date.now()}-${sanitize(file.name)}`;
        const up = await supabase.storage.from("order-requirements").upload(path, file);
        if (up.error) throw up.error;
        const { error: fileErr } = await supabase.from("order_requirement_files").insert({
          order_requirement_id: req.id as string,
          file_url: up.data.path,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
        });
        if (fileErr) throw fileErr;
      }

      return orderId;
    },
    onSuccess: (orderId) => {
      toast.success("Order placed — requirements sent to the seller.");
      navigate({ to: "/orders/$orderId", params: { orderId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function addLink() {
    const value = linkInput.trim();
    if (!value) return;
    if (!/^https?:\/\/\S+$/i.test(value)) {
      toast.error("Enter a valid URL starting with http(s)://");
      return;
    }
    if (links.length >= 5) {
      toast.error("Up to 5 links");
      return;
    }
    setLinks((l) => [...l, value]);
    setLinkInput("");
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} is larger than ${MAX_FILE_MB}MB`);
        continue;
      }
      next.push(f);
    }
    setFiles((prev) => [...prev, ...next].slice(0, 10));
  }

  if (gig.isLoading || packages.isLoading) {
    return (
      <MobileShell>
        <AppHeader title="Checkout" />
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
        <AppHeader title="Checkout" />
        <p className="p-6 text-sm">This gig is no longer available.</p>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <AppHeader title="Checkout" />
      <div className="space-y-5 p-4 pb-24">
        <ol className="flex items-center gap-2 text-[11px] font-medium">
          {["Requirements", "Payment"].map((label, i) => {
            const n = (i + 1) as 1 | 2;
            const done = step > n;
            return (
              <li key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                    step === n || done
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : n}
                </span>
                <span className={step === n ? "text-foreground" : "text-muted-foreground"}>
                  {label}
                </span>
                {i === 0 ? <span className="h-px flex-1 bg-border" /> : null}
              </li>
            );
          })}
        </ol>

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="line-clamp-2 text-sm font-semibold">{gig.data.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selected?.name ?? "Basic"} · {selected?.delivery_time ?? `${gig.data.delivery_time_days ?? 3} days`} ·{" "}
            {selected?.revisions ?? "1"} revisions
          </p>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            {(gig.data as { buyer_requirements?: string | null }).buyer_requirements ? (
              <div className="rounded-xl bg-muted p-3 text-xs whitespace-pre-line text-muted-foreground">
                <p className="mb-1 font-semibold text-foreground">Seller needs:</p>
                {(gig.data as { buyer_requirements?: string | null }).buyer_requirements}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="instructions">Your instructions</Label>
              <Textarea
                id="instructions"
                rows={6}
                maxLength={4000}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Describe your project, brand, style preferences and deadlines…"
                className="rounded-xl"
              />
              <p className="text-right text-[11px] text-muted-foreground">
                {instructions.length}/4000
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="link">Reference links (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="link"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://…"
                  className="h-11 rounded-xl"
                />
                <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={addLink}>
                  Add
                </Button>
              </div>
              {links.length ? (
                <ul className="space-y-1 pt-1">
                  {links.map((l) => (
                    <li
                      key={l}
                      className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
                    >
                      <span className="min-w-0 flex-1 truncate">{l}</span>
                      <button
                        type="button"
                        aria-label="Remove link"
                        onClick={() => setLinks((p) => p.filter((x) => x !== l))}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="files">Attach files (optional)</Label>
              <label
                htmlFor="files"
                className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-border p-6 text-center"
              >
                <FileUp className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs font-medium">Upload briefs, logos or examples</span>
                <span className="text-[11px] text-muted-foreground">Up to {MAX_FILE_MB}MB each</span>
              </label>
              <input
                id="files"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              {files.length ? (
                <ul className="space-y-1 pt-1">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <button
                        type="button"
                        aria-label="Remove file"
                        onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <Button
              className="h-12 w-full rounded-xl text-base"
              onClick={() => {
                const parsed = schema.safeParse({ instructions, links });
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
                  return;
                }
                setStep(2);
              }}
            >
              Continue to payment
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-sm">
              <Row label={selected?.name ?? "Package"} value={money(price)} />
              <Row label="Service fee (5%)" value={money(serviceFee)} />
              <div className="border-t border-border pt-2">
                <Row label="Total" value={money(total)} strong />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Payment method</Label>
              {(
                [
                  { key: "card", title: "Card via Stripe", sub: "Secure checkout, funds held until you accept" },
                  { key: "manual", title: "Bank transfer / manual", sub: "Upload your payment proof for review" },
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
                    className={`mt-0.5 grid h-4 w-4 place-items-center rounded-full border ${
                      method === m.key ? "border-primary bg-primary" : "border-border"
                    }`}
                  >
                    {method === m.key ? <Check className="h-2.5 w-2.5 text-primary-foreground" /> : null}
                  </span>
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
            ) : (
              <p className="rounded-xl bg-muted p-3 text-[11px] text-muted-foreground">
                Your order is created immediately and the seller is notified. Card payment is captured
                by FIVESOM's Stripe checkout — the payment status updates automatically once it
                settles.
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="h-12 flex-1 rounded-xl"
                onClick={() => setStep(1)}
                disabled={place.isPending}
              >
                Back
              </Button>
              <Button
                className="h-12 flex-[2] rounded-xl text-base"
                disabled={place.isPending}
                onClick={() => place.mutate()}
              >
                {place.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Place order · {money(total)}
              </Button>
            </div>
          </div>
        )}
      </div>
    </MobileShell>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "text-base font-bold text-primary" : "font-medium"}>{value}</span>
    </div>
  );
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
}
