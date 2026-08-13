import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileUp, Loader2, Paperclip, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
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

type Search = { session_id?: string };

export const Route = createFileRoute("/_authenticated/orders/$orderId/requirements")({
  validateSearch: (raw: Record<string, unknown>): Search =>
    typeof raw['session_id'] === "string" && raw['session_id']
      ? { session_id: raw['session_id'] }
      : {},
  head: () => ({
    meta: [
      { title: "Send Requirements — FIVESOM" },
      { name: "description", content: "Payment received. Send your project requirements so the seller can start." },
      { property: "og:title", content: "Send Requirements — FIVESOM" },
      { property: "og:description", content: "Share instructions, links and files for your FIVESOM order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RequirementsPage,
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

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

function RequirementsPage() {
  const { orderId } = Route.useParams();
  const { session_id: sessionId } = Route.useSearch();
  const { user } = useSession();
  const navigate = useNavigate();

  const [instructions, setInstructions] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [links, setLinks] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [confirming, setConfirming] = useState(Boolean(sessionId));

  const order = useQuery({
    queryKey: ["order-checkout", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, amount, package_name, payment_status, gigs(title, buyer_requirements)")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Payment is verified server-side before the order row exists, so here we
  // only need the row to actually be paid.
  useEffect(() => {
    if (!sessionId) return;
    void order.refetch();
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, orderId]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Missing session");
      if (order.data?.['payment_status'] !== "paid") {
        throw new Error("This order is not paid yet.");
      }
      const parsed = schema.safeParse({ instructions, links });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

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

      const { error: upErr } = await supabase
        .from("orders")
        .update({ requirements: parsed.data.instructions })
        .eq("id", orderId);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Requirements sent — the seller can start now.");
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

  if (order.isLoading || confirming) {
    return (
      <MobileShell>
        <AppHeader title="Requirements" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </MobileShell>
    );
  }

  const gig = order.data?.['gigs'] as { title?: string; buyer_requirements?: string | null } | null;

  return (
    <MobileShell>
      <AppHeader title="Requirements" />
      <div className="space-y-5 p-4 pb-24">
        <ol className="flex items-center gap-2 text-[11px] font-medium">
          {["Payment", "Requirements"].map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                  i === 1 ? "bg-primary text-primary-foreground" : "bg-success text-white"
                }`}
              >
                {i + 1}
              </span>
              <span className={i === 1 ? "text-foreground" : "text-muted-foreground"}>{label}</span>
              {i === 0 ? <span className="h-px flex-1 bg-border" /> : null}
            </li>
          ))}
        </ol>

        {order.data?.['payment_status'] === "paid" ? (
          <p className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-xs font-medium text-success">
            <ShieldCheck className="h-4 w-4" /> Payment confirmed by Stripe
          </p>
        ) : null}

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="line-clamp-2 text-sm font-semibold">{gig?.title ?? "Your order"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {String(order.data?.['package_name'] ?? "Basic")}
          </p>
        </div>

        {gig?.buyer_requirements ? (
          <div className="rounded-xl bg-muted p-3 text-xs whitespace-pre-line text-muted-foreground">
            <p className="mb-1 font-semibold text-foreground">Seller needs:</p>
            {gig.buyer_requirements}
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
          <p className="text-right text-[11px] text-muted-foreground">{instructions.length}/4000</p>
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
                <li key={l} className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs">
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
          disabled={submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Send requirements
        </Button>
      </div>
    </MobileShell>
  );
}
