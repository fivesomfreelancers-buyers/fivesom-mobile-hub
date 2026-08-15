import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, Star } from "lucide-react";
import { useState } from "react";

import { AppHeader } from "@/components/app-header";
import { GigCard } from "@/components/gig-card";
import { MobileShell } from "@/components/mobile-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CATEGORIES,
  freelancerProfilesQuery,
  freelancersQuery,
  gigsQuery,
  initials,
  isOnline,
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
  const navigate = useNavigate();
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
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const q = search.trim();
            navigate({ to: "/search", search: { ...(q ? { q } : {}), ...(category ? { category } : {}) } });
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services..."
              className="h-11 rounded-xl pl-9"
            />
          </div>
          <Link
            to="/search"
            search={category ? { category } : {}}
            aria-label="Filters"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card"
          >
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </Link>
        </form>


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
          {freelancers.isLoading ? (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-hidden px-4 pb-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-24 shrink-0 rounded-xl" />
              ))}
            </div>
          ) : (freelancers.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No freelancers yet.</p>
          ) : (
            <FreelancerMarquee ids={(freelancers.data ?? []).map((f) => f.id)} />
          )}
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

/**
 * Auto-scrolling rail: the list is rendered twice so the CSS marquee can loop
 * seamlessly right-to-left, no matter how many freelancers exist.
 * Speed scales with the number of cards; hovering/holding pauses it.
 */
function FreelancerMarquee({ ids }: { ids: string[] }) {
  const duration = Math.max(18, ids.length * 5);
  return (
    <div className="-mx-4 overflow-hidden px-4">
      <div
        className="marquee-track gap-3 pb-1"
        style={{ ["--marquee-duration" as string]: `${duration}s` }}
      >
        {[...ids, ...ids].map((id, i) => (
          <FreelancerCard key={`${id}-${i}`} freelancerId={id} ariaHidden={i >= ids.length} />
        ))}
      </div>
    </div>
  );
}

function FreelancerCard({
  freelancerId,
  ariaHidden,
}: {
  freelancerId: string;
  ariaHidden?: boolean;
}) {
  const q = useQuery(freelancerProfilesQuery([freelancerId]));
  const entry = q.data?.[freelancerId];
  const p = entry?.profile;
  const online = isOnline(p?.last_seen);
  return (
    <Link
      to="/freelancers/$freelancerId"
      params={{ freelancerId }}
      aria-hidden={ariaHidden ? true : undefined}
      className="w-24 shrink-0 rounded-xl border border-border bg-card p-3 text-center active:scale-95 transition-transform"
    >
      <div className="relative mx-auto h-12 w-12">
        <Avatar className="h-12 w-12">
          <AvatarImage src={p?.profile_image_url ?? undefined} alt="" className="object-cover" />
          <AvatarFallback className="text-xs">{initials(p?.full_name)}</AvatarFallback>
        </Avatar>
        <span
          title={online ? "Online" : "Offline"}
          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
            online ? "bg-success" : "bg-muted-foreground/50"
          }`}
        />
      </div>
      <p className="mt-2 truncate text-[11px] font-semibold">{p?.full_name ?? "Freelancer"}</p>
      <p className="truncate text-[10px] text-muted-foreground">
        {entry?.freelancer?.professional_title ?? "Seller"}
      </p>
      <p className={`text-[9px] font-medium ${online ? "text-success" : "text-muted-foreground"}`}>
        {online ? "Online" : "Offline"}
      </p>
      <p className="mt-1 flex items-center justify-center gap-1 text-[10px] font-medium">
        <Star className="h-3 w-3 fill-warning text-warning" />
        {Number(entry?.freelancer?.rating ?? 0).toFixed(1)}
      </p>
    </Link>
  );
}


