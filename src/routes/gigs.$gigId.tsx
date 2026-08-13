import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  RefreshCcw,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import {
  freelancerProfilesQuery,
  gigGallery,
  gigMediaQuery,
  gigPackagesQuery,
  gigQuery,
  gigReviewsQuery,
  freelancerPortfolioQuery,
  initials,
  isOnline,
  memberSince,
  money,
  timeAgo,
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

type TabKey = "description" | "requirements" | "reviews" | "seller";

function GigDetails() {
  const { gigId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useSession();
  const gig = useQuery(gigQuery(gigId));
  const packages = useQuery(gigPackagesQuery(gigId));
  const media = useQuery(gigMediaQuery(gigId));
  const reviews = useQuery(gigReviewsQuery(gigId));
  const sellers = useQuery(freelancerProfilesQuery(gig.data ? [gig.data.freelancer_id] : []));
  const portfolio = useQuery(freelancerPortfolioQuery(gig.data?.freelancer_id));
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>("description");
  const [slide, setSlide] = useState(0);

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
  const gallery = gigGallery(gig.data, media.data);
  const current = gallery.length ? gallery[Math.min(slide, gallery.length - 1)] : null;
  const reviewList = reviews.data ?? [];
  const sellerOnline = isOnline(seller?.profile?.last_seen);
  const sellerSkills = seller?.freelancer?.skills ?? seller?.profile?.skills ?? [];
  const sellerLanguages = seller?.profile?.languages ?? [];
  const sellerTools = seller?.freelancer?.software_tools ?? [];
  const requirements = (gig.data as { buyer_requirements?: string | null }).buyer_requirements;

  function step(dir: 1 | -1) {
    if (gallery.length < 2) return;
    setSlide((s) => (s + dir + gallery.length) % gallery.length);
  }

  function startOrder() {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!gig.data) return;
    navigate({
      to: "/checkout/$gigId",
      params: { gigId: gig.data.id },
      search: pkg ? { pkg: pkg.id } : {},
    });
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

  const tabs: { key: TabKey; label: string }[] = [
    { key: "description", label: "Description" },
    { key: "requirements", label: "Requirements" },
    { key: "reviews", label: `Reviews (${reviewList.length})` },
    { key: "seller", label: "About Seller" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md pb-10">
        <div className="sticky top-0 z-30 flex items-center gap-3 bg-card/95 px-4 py-3 backdrop-blur">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full border border-border">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold">Gig Details</span>
        </div>

        <div className="relative aspect-[4/3] w-full bg-muted">
          {current ? (
            <img
              src={current}
              alt={`${gig.data.title} — image ${slide + 1}`}
              className="h-full w-full object-contain"
            />
          ) : null}
          {gallery.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 backdrop-blur"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next image"
                className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-card/90 backdrop-blur"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
                {gallery.map((u, i) => (
                  <span
                    key={u}
                    className={`h-1.5 rounded-full transition-all ${
                      i === slide ? "w-4 bg-primary" : "w-1.5 bg-border"
                    }`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>

        {gallery.length > 1 ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3">
            {gallery.map((u, i) => (
              <button
                key={u}
                type="button"
                onClick={() => setSlide(i)}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 ${
                  i === slide ? "border-primary" : "border-border"
                }`}
              >
                <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}

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

          {gig.data.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {gig.data.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

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

          <div className="rounded-xl border border-border bg-card">
            <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border p-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    tab === t.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 text-sm">
              {tab === "description" ? (
                <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                  {gig.data.description || "No description provided."}
                </p>
              ) : null}

              {tab === "requirements" ? (
                requirements ? (
                  <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                    {requirements}
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    The seller will send the requirements after you place the order.
                  </p>
                )
              ) : null}

              {tab === "reviews" ? (
                reviews.isLoading ? (
                  <Skeleton className="h-16 w-full rounded-lg" />
                ) : reviewList.length === 0 ? (
                  <p className="text-muted-foreground">No reviews yet for this gig.</p>
                ) : (
                  <ul className="space-y-4">
                    {reviewList.map((r) => (
                      <li key={r.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs font-semibold">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            {Number(r.rating ?? 0).toFixed(1)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {timeAgo(r.created_at)}
                          </span>
                        </div>
                        {r.comment ? (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {r.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )
              ) : null}

              {tab === "seller" ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <Avatar className="h-16 w-16 border border-border">
                        <AvatarImage
                          src={seller?.profile?.profile_image_url ?? undefined}
                          alt={seller?.profile?.full_name ?? "Seller"}
                        />
                        <AvatarFallback>{initials(seller?.profile?.full_name)}</AvatarFallback>
                      </Avatar>
                      <span
                        aria-label={sellerOnline ? "Online" : "Offline"}
                        className={`absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
                          sellerOnline ? "bg-success" : "bg-muted-foreground/50"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {seller?.profile?.full_name ?? "Freelancer"}
                        </p>
                        {seller?.freelancer?.is_verified || seller?.freelancer?.has_blue_tick ? (
                          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                            ★ Top Rated
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs font-medium text-primary">
                        {seller?.freelancer?.professional_title ??
                          seller?.profile?.professional_title ??
                          "Seller"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {sellerOnline ? "Online now" : "Offline"}
                        {memberSince(seller?.profile?.member_since)
                          ? ` · Member since ${memberSince(seller?.profile?.member_since)}`
                          : ""}
                      </p>
                      <p className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-warning text-warning" />
                          {Number(seller?.freelancer?.rating ?? 0) > 0
                            ? Number(seller?.freelancer?.rating).toFixed(1)
                            : "New"}
                        </span>
                        <span>{seller?.freelancer?.completed_orders ?? 0} orders completed</span>
                      </p>
                    </div>
                  </div>

                  <Section title="About">
                    <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {seller?.freelancer?.bio ??
                        seller?.profile?.bio ??
                        "This seller hasn't added a bio yet."}
                    </p>
                  </Section>

                  {sellerSkills.length ? (
                    <Section title="Skills">
                      <Chips items={sellerSkills} />
                    </Section>
                  ) : null}

                  <div className="grid grid-cols-2 gap-4">
                    {sellerLanguages.length ? (
                      <Section title="Languages">
                        <Chips items={sellerLanguages} />
                      </Section>
                    ) : null}
                    {seller?.freelancer?.years_experience ? (
                      <Section title="Experience">
                        <p className="text-xs text-muted-foreground">
                          {String(seller.freelancer.years_experience)}
                        </p>
                      </Section>
                    ) : null}
                  </div>

                  {seller?.freelancer?.education_level ? (
                    <Section title="Education">
                      <p className="text-xs text-muted-foreground">
                        {seller.freelancer.education_level}
                      </p>
                    </Section>
                  ) : null}

                  {sellerTools.length ? (
                    <Section title="Software & Tools">
                      <Chips items={sellerTools} />
                    </Section>
                  ) : null}

                  {seller?.profile?.location ? (
                    <Section title="Location">
                      <p className="text-xs text-muted-foreground">{seller.profile.location}</p>
                    </Section>
                  ) : null}

                  {portfolio.data?.length ? (
                    <Section title="Portfolio">
                      <div className="grid grid-cols-2 gap-2">
                        {portfolio.data.map((item) =>
                          item.media_type?.startsWith("video") ? (
                            <video
                              key={item.id}
                              src={item.media_url}
                              controls
                              playsInline
                              className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                            />
                          ) : (
                            <img
                              key={item.id}
                              src={item.media_url}
                              alt="Portfolio work"
                              loading="lazy"
                              className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                            />
                          ),
                        )}
                      </div>
                    </Section>
                  ) : null}

                  <Button variant="outline" className="w-full" onClick={messageSeller}>
                    Contact Seller
                  </Button>
                </div>
              ) : null}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold">{title}</p>
      {children}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span
          key={i}
          className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px]"
        >
          {i}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
