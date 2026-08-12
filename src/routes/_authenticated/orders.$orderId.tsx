import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Package,
  RotateCcw,
  Send,
  Truck,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { money, timeAgo } from "@/lib/fivesom";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order Details — FIVESOM" },
      { name: "description", content: "Track your FIVESOM order timeline, requirements, delivery and chat." },
      { property: "og:title", content: "Order Details — FIVESOM" },
      { property: "og:description", content: "Requirements, delivery and messages for your order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrderDetailPage,
});

type OrderRow = {
  id: string;
  gig_id: string | null;
  buyer_id: string;
  freelancer_id: string;
  status: string | null;
  amount: number | null;
  package_name: string | null;
  payment_status: string | null;
  payment_method: string | null;
  requirements: string | null;
  created_at: string;
  updated_at: string | null;
};

type Delivery = {
  id: string;
  delivery_message: string | null;
  delivery_file_url: string | null;
  delivery_link: string | null;
  status: string | null;
  delivered_at: string | null;
  revision_feedback: string | null;
  revision_requested_at: string | null;
  created_at: string;
};

const STEPS = [
  { key: "pending", label: "Order placed", icon: Package },
  { key: "in_progress", label: "In progress", icon: Clock },
  { key: "delivered", label: "Delivered", icon: Truck },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
] as const;

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

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const { user } = useSession();
  const qc = useQueryClient();

  const order = useQuery({
    queryKey: ["order", orderId],
    enabled: !!user?.id,
    queryFn: async (): Promise<OrderRow | null> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, gig_id, buyer_id, freelancer_id, status, amount, package_name, payment_status, payment_method, requirements, created_at, updated_at",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data as OrderRow | null;
    },
  });

  const gig = useQuery({
    queryKey: ["order-gig", order.data?.gig_id],
    enabled: !!order.data?.gig_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("gigs")
        .select("id, title, thumbnail_url")
        .eq("id", order.data!.gig_id!)
        .maybeSingle();
      return data as { id: string; title: string; thumbnail_url: string | null } | null;
    },
  });

  const seller = useQuery({
    queryKey: ["order-seller", order.data?.freelancer_id],
    enabled: !!order.data?.freelancer_id,
    queryFn: async () => {
      const { data: fl } = await supabase
        .from("public_freelancers")
        .select("id, user_id")
        .eq("id", order.data!.freelancer_id)
        .maybeSingle();
      if (!fl?.user_id) return null;
      const { data: p } = await supabase
        .from("public_profiles")
        .select("id, full_name, profile_image_url")
        .eq("id", fl.user_id as string)
        .maybeSingle();
      return { userId: fl.user_id as string, profile: p as { full_name: string | null } | null };
    },
  });

  const requirements = useQuery({
    queryKey: ["order-requirements", orderId],
    queryFn: async () => {
      const { data: req } = await supabase
        .from("order_requirements")
        .select("id, instructions, external_links, created_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (!req) return null;
      const { data: files } = await supabase
        .from("order_requirement_files")
        .select("id, file_url, file_name")
        .eq("order_requirement_id", req.id as string);
      return {
        instructions: req.instructions as string | null,
        links: (req.external_links as string[] | null) ?? [],
        files: (files ?? []) as { id: string; file_url: string; file_name: string | null }[],
      };
    },
  });

  const deliveries = useQuery({
    queryKey: ["order-deliveries", orderId],
    queryFn: async (): Promise<Delivery[]> => {
      const { data } = await supabase
        .from("order_deliveries")
        .select(
          "id, delivery_message, delivery_file_url, delivery_link, status, delivered_at, revision_feedback, revision_requested_at, created_at",
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      return (data ?? []) as Delivery[];
    },
  });

  const isBuyer = !!user && order.data?.buyer_id === user.id;
  const isSeller = !!user && !!seller.data && seller.data.userId === user.id;
  const status = order.data?.status ?? "pending";

  const setStatus = useMutation({
    mutationFn: async (next: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["order", orderId] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Order updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deliveryMsg, setDeliveryMsg] = useState("");
  const [deliveryLink, setDeliveryLink] = useState("");
  const [deliveryFile, setDeliveryFile] = useState<File | null>(null);

  const deliver = useMutation({
    mutationFn: async () => {
      if (deliveryMsg.trim().length < 5) throw new Error("Add a short delivery note");
      let filePath: string | null = null;
      if (deliveryFile) {
        if (deliveryFile.size > 50 * 1024 * 1024) throw new Error("File must be under 50MB");
        const path = `${user!.id}/${orderId}/${Date.now()}-${deliveryFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from("delivery-files").upload(path, deliveryFile);
        if (up.error) throw up.error;
        filePath = up.data.path;
      }
      const { error } = await supabase.from("order_deliveries").insert({
        order_id: orderId,
        delivery_message: deliveryMsg.trim(),
        ...(deliveryLink.trim() ? { delivery_link: deliveryLink.trim() } : {}),
        ...(filePath ? { delivery_file_url: filePath } : {}),
        status: "delivered",
        delivered_at: new Date().toISOString(),
      });
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("orders")
        .update({ status: "delivered", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      setDeliveryMsg("");
      setDeliveryLink("");
      setDeliveryFile(null);
      void qc.invalidateQueries({ queryKey: ["order-deliveries", orderId] });
      void qc.invalidateQueries({ queryKey: ["order", orderId] });
      toast.success("Delivery sent to the buyer");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [revision, setRevision] = useState("");
  const requestRevision = useMutation({
    mutationFn: async () => {
      if (revision.trim().length < 5) throw new Error("Tell the seller what to change");
      const latest = deliveries.data?.[0];
      if (latest) {
        const { error } = await supabase
          .from("order_deliveries")
          .update({
            status: "revision_requested",
            revision_feedback: revision.trim(),
            revision_requested_at: new Date().toISOString(),
          })
          .eq("id", latest.id);
        if (error) throw error;
      }
      const { error: e2 } = await supabase
        .from("orders")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (e2) throw e2;
    },
    onSuccess: () => {
      setRevision("");
      void qc.invalidateQueries({ queryKey: ["order-deliveries", orderId] });
      void qc.invalidateQueries({ queryKey: ["order", orderId] });
      toast.success("Revision requested");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (order.isLoading) {
    return (
      <MobileShell>
        <AppHeader title="Order" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </MobileShell>
    );
  }
  if (!order.data) {
    return (
      <MobileShell>
        <AppHeader title="Order" />
        <div className="p-6 text-center text-sm text-muted-foreground">
          Order not found.
          <div className="mt-3">
            <Link to="/orders" className="font-semibold text-primary">
              Back to orders
            </Link>
          </div>
        </div>
      </MobileShell>
    );
  }

  const activeIndex = STEPS.findIndex((s) => s.key === status);

  return (
    <MobileShell>
      <AppHeader title="Order Details" />
      <div className="space-y-5 p-4 pb-24">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            {gig.data?.thumbnail_url ? (
              <img
                src={gig.data.thumbnail_url}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold">
                {gig.data?.title ?? "Custom order"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                #{order.data.id.slice(0, 8)} · {order.data.package_name ?? "Package"} ·{" "}
                {timeAgo(order.data.created_at)} ago
              </p>
            </div>
            <span className="shrink-0 text-sm font-bold text-success">
              {money(order.data.amount)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusTone(status)}`}
            >
              {status.replace("_", " ")}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
              payment: {order.data.payment_status ?? "pending"}
            </span>
            {order.data.payment_method ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                {order.data.payment_method}
              </span>
            ) : null}
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
          {status === "cancelled" ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm">
              <XCircle className="h-4 w-4 text-destructive" />
              This order was cancelled.
            </div>
          ) : (
            <ol className="space-y-0 rounded-xl border border-border bg-card p-4">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const done = i <= activeIndex;
                return (
                  <li key={s.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full ${
                          done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {i < STEPS.length - 1 ? (
                        <span className={`w-px flex-1 ${i < activeIndex ? "bg-primary" : "bg-border"}`} />
                      ) : null}
                    </div>
                    <div className={`pb-5 ${i === STEPS.length - 1 ? "pb-0" : ""}`}>
                      <p className={`text-sm ${done ? "font-semibold" : "text-muted-foreground"}`}>
                        {s.label}
                      </p>
                      {i === activeIndex ? (
                        <p className="text-[11px] text-muted-foreground">
                          Updated {timeAgo(order.data?.updated_at ?? order.data?.created_at)} ago
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Requirements</h2>
          <div className="space-y-2 rounded-xl border border-border bg-card p-4 text-xs">
            <p className="whitespace-pre-line text-muted-foreground">
              {requirements.data?.instructions ?? order.data.requirements ?? "No requirements sent."}
            </p>
            {(requirements.data?.links ?? []).map((l) => (
              <a
                key={l}
                href={l}
                target="_blank"
                rel="noreferrer"
                className="block truncate font-medium text-primary"
              >
                {l}
              </a>
            ))}
            {(requirements.data?.files ?? []).map((f) => (
              <RequirementFile key={f.id} path={f.file_url} name={f.file_name ?? "Attachment"} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Delivery</h2>
          {(deliveries.data ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No delivery yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {(deliveries.data ?? []).map((d) => (
                <li key={d.id} className="rounded-xl border border-border bg-card p-3 text-xs">
                  <p className="whitespace-pre-line">{d.delivery_message}</p>
                  {d.delivery_link ? (
                    <a
                      href={d.delivery_link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate font-medium text-primary"
                    >
                      {d.delivery_link}
                    </a>
                  ) : null}
                  {d.delivery_file_url ? (
                    <DeliveryFile path={d.delivery_file_url} />
                  ) : null}
                  {d.revision_feedback ? (
                    <p className="mt-2 rounded-lg bg-muted p-2 text-[11px]">
                      <span className="font-semibold">Revision requested:</span> {d.revision_feedback}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    {timeAgo(d.delivered_at ?? d.created_at)} ago
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isSeller && (status === "pending" || status === "in_progress") ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">
              {status === "pending" ? "Start this order" : "Send delivery"}
            </h2>
            {status === "pending" ? (
              <Button
                className="h-11 w-full rounded-xl"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate("in_progress")}
              >
                Accept & start working
              </Button>
            ) : (
              <div className="space-y-2 rounded-xl border border-border bg-card p-3">
                <Textarea
                  rows={4}
                  value={deliveryMsg}
                  maxLength={2000}
                  onChange={(e) => setDeliveryMsg(e.target.value)}
                  placeholder="Describe what you're delivering…"
                  className="rounded-xl"
                />
                <Input
                  value={deliveryLink}
                  onChange={(e) => setDeliveryLink(e.target.value)}
                  placeholder="Link (Figma, Drive…) — optional"
                  className="h-11 rounded-xl"
                />
                <Input
                  type="file"
                  className="rounded-xl"
                  onChange={(e) => setDeliveryFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  className="h-11 w-full rounded-xl"
                  disabled={deliver.isPending}
                  onClick={() => deliver.mutate()}
                >
                  {deliver.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Deliver now
                </Button>
              </div>
            )}
          </section>
        ) : null}

        {isBuyer && status === "delivered" ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Review & complete</h2>
            <Button
              className="h-11 w-full rounded-xl"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate("completed")}
            >
              <CheckCircle2 className="h-4 w-4" /> Accept delivery
            </Button>
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <Textarea
                rows={3}
                value={revision}
                maxLength={1000}
                onChange={(e) => setRevision(e.target.value)}
                placeholder="Need changes? Describe them…"
                className="rounded-xl"
              />
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl"
                disabled={requestRevision.isPending}
                onClick={() => requestRevision.mutate()}
              >
                <RotateCcw className="h-4 w-4" /> Request revision
              </Button>
            </div>
          </section>
        ) : null}

        {isBuyer && (status === "pending" || status === "in_progress") ? (
          <Button
            variant="outline"
            className="h-11 w-full rounded-xl text-destructive"
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate("cancelled")}
          >
            Cancel order
          </Button>
        ) : null}

        <OrderChat
          orderId={orderId}
          buyerId={order.data.buyer_id}
          freelancerId={order.data.freelancer_id}
          sellerUserId={seller.data?.userId ?? null}
          sellerName={seller.data?.profile?.full_name ?? "Seller"}
        />
      </div>
    </MobileShell>
  );
}

function RequirementFile({ path, name }: { path: string; name: string }) {
  const url = useSignedUrl("order-requirements", path);
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 font-medium"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="truncate">{name}</span>
    </a>
  );
}

function DeliveryFile({ path }: { path: string }) {
  const url = useSignedUrl("delivery-files", path);
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 font-medium"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="truncate">Download delivery</span>
    </a>
  );
}

function useSignedUrl(bucket: string, path: string) {
  const { data } = useQuery({
    queryKey: ["signed-url", bucket, path],
    queryFn: async () => {
      if (/^https?:\/\//i.test(path)) return path;
      const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      return data?.signedUrl ?? null;
    },
  });
  return data ?? null;
}

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  message: string | null;
  created_at: string;
};

function OrderChat({
  orderId,
  buyerId,
  freelancerId,
  sellerUserId,
  sellerName,
}: {
  orderId: string;
  buyerId: string;
  freelancerId: string;
  sellerUserId: string | null;
  sellerName: string;
}) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const conversation = useQuery({
    queryKey: ["order-conversation", buyerId, freelancerId],
    enabled: !!user,
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("buyer_id", buyerId)
        .eq("freelancer_id", freelancerId)
        .maybeSingle();
      if (existing?.id) return existing.id as string;
      const { data, error } = await supabase
        .from("conversations")
        .insert({ buyer_id: buyerId, freelancer_id: freelancerId })
        .select("id")
        .maybeSingle();
      if (error) return null;
      return (data?.id as string) ?? null;
    },
  });

  const convoId = conversation.data ?? null;

  const messages = useQuery({
    queryKey: ["order-messages", convoId],
    enabled: !!convoId,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, sender_id, receiver_id, message, created_at")
        .eq("conversation_id", convoId!)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });

  useEffect(() => {
    if (!convoId) return;
    const channel = supabase
      .channel(`order-chat-${convoId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convoId}` },
        () => void qc.invalidateQueries({ queryKey: ["order-messages", convoId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [convoId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.data?.length]);

  const send = useMutation({
    mutationFn: async () => {
      const body = text.trim();
      if (!body) throw new Error("Write a message first");
      if (!convoId || !user) throw new Error("Chat unavailable");
      const receiver = user.id === buyerId ? sellerUserId : buyerId;
      const { error } = await supabase.from("messages").insert({
        conversation_id: convoId,
        sender_id: user.id,
        ...(receiver ? { receiver_id: receiver } : {}),
        message: body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey: ["order-messages", convoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Order chat</h2>
        {convoId ? (
          <Link
            to="/messages/$conversationId"
            params={{ conversationId: convoId }}
            className="text-xs font-medium text-primary"
          >
            Open full chat
          </Link>
        ) : null}
      </div>
      <div className="rounded-xl border border-border bg-card">
        <div className="max-h-72 space-y-2 overflow-y-auto p-3">
          {messages.isLoading ? (
            <Skeleton className="h-16 rounded-lg" />
          ) : (messages.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Start the conversation with {sellerName} about order #{orderId.slice(0, 8)}.
            </p>
          ) : (
            (messages.data ?? []).map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs ${
                      mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.message}</p>
                    <p className="mt-1 text-[10px] opacity-70">{timeAgo(m.created_at)}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
        <form
          className="flex items-center gap-2 border-t border-border p-2"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            placeholder="Message about this order…"
            className="h-10 rounded-xl"
          />
          <Button type="submit" size="icon" className="h-10 w-10 rounded-xl" disabled={send.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </section>
  );
}
