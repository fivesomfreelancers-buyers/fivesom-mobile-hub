import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, Clock, RefreshCcw, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import {
  freelancerProfilesQuery,
  gigImage,
  gigPackagesQuery,
  gigQuery,
  initials,
  money,
} from "@/lib/fivesom";

export const Route = createFileRoute("/gigs/$gigId")({
  head: () => ({
    meta: [
      { title: "Gig Details — FIVESOM" },
      {
        name: "description",
        content: "View gig packages, pricing, delivery time and message the seller on FIVESOM.",
      },
      { property: "og:title", content: "Gig Details — FIVESOM" },
      {
        property: "og:description",
        content: "Compare packages and order freelance services on FIVESOM.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GigDetails,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Gig not found.</div>,
});

function GigDetails() {
  const { gigId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const gig = useQuery(gigQuery(gigId));
  const packages = useQuery(gigPackagesQuery(gigId));
  const sellers = useQuery(freelancerProfilesQuery(gig.data ? [gig.data.freelancer_id] : []));
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected && packages.data?.length) setSelected(packages.data[0]!.id);
  }, [packages.data, selected]);

  if (gig.isLoading) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4">
        <Skeleton className="h-52 w-full rounded-xl" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (!gig.data) return <div className="p-6 text-sm">Gig not found.</div>;

  const seller = sellers.data?.[gig.data.freelancer_id];
  const pkg = packages.data?.find((p) => p.id === selected) ?? null;
  const img = gigImage(gig.data);

  async function startOrder() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!gig.data) return;
    setBusy(true);
    const { error } = await supabase.from("orders").insert({
      gig_id: gig.data.id,
      buyer_id: user.id,
      freelancer_id: gig.data.freelancer_id,
      amount: pkg?.price ?? gig.data.base_price,
      package_name: pkg?.name ?? pkg?.package_type ?? "basic",
      status: "pending",
      payment_status: "pending",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Order created");
    navigate({ to: "/orders" });
  }

  async function messageSeller() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!gig.data) return;
    const freelancerUserId = seller?.profile?.id;
    setBusy(true);
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("freelancer_id", gig.data.freelancer_id)
      .maybeSingle();
    let convoId = existing?.id as string | undefined;
    if (!convoId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ buyer_id: user.id, freelancer_id: gig.data.freelancer_id })
        .select("id")
        .maybeSingle();
      if (error) {
        setBusy(false);
        toast.error(error.message);
        return;
      }
      convoId = data?.id as string | undefined;
    }
    setBusy(false);
    if (convoId) {
      navigate({
        to: "/messages/$conversationId",
        params: { conversationId: convoId },
        search: freelancerUserId ? { to: freelancerUserId } : {},
      });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md pb-10">
        <div className="sticky top-0 z-30 flex items-center gap-3 bg-card/95 px-4 py-3 backdrop-blur">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full border border-border">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold">Gig Details</span>
        </div>

        <div className="aspect-[4/3] w-full bg-muted">
          {img ? <img src={img} alt={gig.data.title} className="h-full w-full object-cover" /> : null}
        </div>

        <div className="space-y-5 px-4 pt-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={seller?.profile?.profile_image_url ?? undefined} alt="" />
              <AvatarFallback>{initials(seller?.profile?.full_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {seller?.profile?.full_name ?? "Freelancer"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {seller?.freelancer?.professional_title ?? "Seller"}
              </p>
            </div>
          </div>

          <h1 className="text-lg font-bold leading-snug">{gig.data.title}</h1>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              {Number(seller?.freelancer?.rating ?? 0).toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {gig.data.delivery_time_days ?? 3} Days Delivery
            </span>
            <span className="flex items-center gap-1">
              <RefreshCcw className="h-3.5 w-3.5" />
              {pkg?.revisions ?? "1"} Revisions
            </span>
          </div>

          {packages.data && packages.data.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold">Select a Package</p>
              <div className="grid grid-cols-3 gap-2">
                {packages.data.map((p) => {
                  const active = p.id === selected;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className={`rounded-xl border p-2 text-center ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card"
                      }`}
                    >
                      <span className="block text-[11px] font-semibold capitalize">
                        {p.package_type}
                      </span>
                      <span className="block text-sm font-bold">{money(p.price)}</span>
                    </button>
                  );
                })}
              </div>
              {pkg ? (
                <ul className="space-y-2 rounded-xl border border-border bg-card p-3">
                  {(pkg.features ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
                    <span>{pkg.delivery_time ?? "—"}</span>
                    <span>{pkg.revisions ?? "1"} revisions</span>
                  </li>
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Button className="h-12 w-full text-base" disabled={busy} onClick={startOrder}>
              Continue ({money(pkg?.price ?? gig.data.base_price)})
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full text-base"
              disabled={busy}
              onClick={messageSeller}
            >
              Message Seller
            </Button>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">About This Gig</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {gig.data.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
