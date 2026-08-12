import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, SlidersHorizontal, Star, BadgeCheck, Clock } from "lucide-react";
import { useState } from "react";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CATEGORIES,
  freelancerProfilesQuery,
  freelancersQuery,
  gigImage,
  gigsQuery,
  initials,
  money,
  type Gig,
} from "@/lib/fivesom";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FIVESOM — Find, Hire & Work With the Best Freelancers" },
      {
        name: "description",
        content:
          "Browse gigs, hire vetted freelancers, message sellers and track orders on the FIVESOM marketplace.",
      },
      { property: "og:title", content: "FIVESOM — Freelance Marketplace" },
      {
        property: "og:description",
        content: "Connect. Work. Earn. Grow together on FIVESOM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const gigs = useQuery(
    gigsQuery({
      ...(category ? { category } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      limit: 40,
    }),
  );
  const freelancers = useQuery(freelancersQuery(12));
  const ids = [...new Set((gigs.data ?? []).map((g) => g.freelancer_id))];
  const sellers = useQuery(freelancerProfilesQuery(ids));

  return (
    <MobileShell>
      <AppHeader />

      <div className="space-y-6 px-4 pt-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services..."
              className="h-11 rounded-xl pl-9"
            />
          </div>
          <button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <h1 className="text-xl font-bold leading-snug">
            Find, Hire & Work with the best freelancers
          </h1>
          <p className="mt-1 text-sm opacity-90">Connect. Work. Earn. Grow Together.</p>
          <a
            href="#gigs"
            className="mt-4 inline-flex rounded-lg bg-primary-foreground px-4 py-2 text-xs font-semibold text-primary"
          >
            Explore Now
          </a>
        </div>

        <section>
          <SectionTitle title="Popular Services" />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            <CategoryChip
              label="All"
              sub="Services"
              active={category === null}
              onClick={() => setCategory(null)}
            />
            {CATEGORIES.map((c) => (
              <CategoryChip
                key={c.slug}
                label={c.label}
                sub={c.sub}
                active={category === c.slug}
                onClick={() => setCategory(category === c.slug ? null : c.slug)}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title="Top Freelancers" />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {freelancers.isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-24 rounded-xl" />
                ))
              : (freelancers.data ?? []).map((f) => (
                  <FreelancerCard key={f.id} freelancerId={f.id} />
                ))}
            {!freelancers.isLoading && (freelancers.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No freelancers yet.</p>
            )}
          </div>
        </section>

        <section id="gigs">
          <SectionTitle title={category ? "Filtered Gigs" : "Gigs Online"} />
          {gigs.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : (gigs.data ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No gigs match your search.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(gigs.data ?? []).map((gig) => (
                <GigCard
                  key={gig.id}
                  gig={gig}
                  sellerName={sellers.data?.[gig.freelancer_id]?.profile?.full_name ?? null}
                  rating={sellers.data?.[gig.freelancer_id]?.freelancer?.rating ?? null}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </MobileShell>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-3 text-base font-semibold">{title}</h2>;
}

function CategoryChip({
  label,
  sub,
  active,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-20 shrink-0 rounded-xl border p-3 text-center transition-colors ${
        active ? "border-primary bg-primary/10" : "border-border bg-card"
      }`}
    >
      <span className="block text-xs font-semibold leading-tight">{label}</span>
      <span className="mt-0.5 block text-[10px] text-muted-foreground">{sub}</span>
    </button>
  );
}

function FreelancerCard({ freelancerId }: { freelancerId: string }) {
  const q = useQuery(freelancerProfilesQuery([freelancerId]));
  const entry = q.data?.[freelancerId];
  const p = entry?.profile;
  return (
    <div className="w-24 shrink-0 rounded-xl border border-border bg-card p-3 text-center">
      <Avatar className="mx-auto h-12 w-12">
        <AvatarImage src={p?.profile_image_url ?? undefined} alt="" />
        <AvatarFallback className="text-xs">{initials(p?.full_name)}</AvatarFallback>
      </Avatar>
      <p className="mt-2 truncate text-[11px] font-semibold">{p?.full_name ?? "Freelancer"}</p>
      <p className="truncate text-[10px] text-muted-foreground">
        {entry?.freelancer?.professional_title ?? "Seller"}
      </p>
      <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium">
        <Star className="h-3 w-3 fill-warning text-warning" />
        {Number(entry?.freelancer?.rating ?? 0).toFixed(1)}
      </p>
    </div>
  );
}

