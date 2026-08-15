import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Search as SearchIcon, SlidersHorizontal, Star, X } from "lucide-react";
import { useState } from "react";

import { GigCard } from "@/components/gig-card";
import { MobileShell } from "@/components/mobile-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useRecentSearches } from "@/hooks/use-favorites";
import {
  CATEGORIES,
  freelancerProfilesQuery,
  freelancerSearchQuery,
  gigsQuery,
  initials,
} from "@/lib/fivesom";
import { cn } from "@/lib/utils";

type SearchParams = { q?: string; category?: string; view?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (raw: Record<string, unknown>): SearchParams => ({
    ...(typeof raw['q'] === "string" && raw['q'] ? { q: raw['q'] } : {}),
    ...(typeof raw['category'] === "string" && raw['category'] ? { category: raw['category'] } : {}),
    ...(typeof raw['view'] === "string" && raw['view'] ? { view: raw['view'] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Search Services & Freelancers — FIVESOM" },
      {
        name: "description",
        content: "Search FIVESOM gigs, services and freelancers, then filter by price, delivery time and rating.",
      },
      { property: "og:title", content: "Search FIVESOM" },
      { property: "og:description", content: "Find the right freelancer for your project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

const POPULAR = ["Logo Design", "Web Design", "Video Editing", "App UI", "Content Writing"];
const DELIVERY_OPTIONS = [
  { label: "Any", value: 0 },
  { label: "1 day", value: 1 },
  { label: "3 days", value: 3 },
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
];

function SearchPage() {
  const params = Route.useSearch();
  const navigate = useNavigate();
  const recent = useRecentSearches();

  const [term, setTerm] = useState(params.q ?? "");
  const [category, setCategory] = useState<string | null>(params.category ?? null);
  const [price, setPrice] = useState<[number, number]>([0, 1000]);
  const [minRating, setMinRating] = useState(0);
  const [maxDays, setMaxDays] = useState(0);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [location, setLocation] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Applied filters (only change when "Apply" is pressed)
  const [applied, setApplied] = useState({
    price: [0, 1000] as [number, number],
    minRating: 0,
    maxDays: 0,
    onlineOnly: false,
    verifiedOnly: false,
    location: "",
  });

  const query = params.q ?? "";

  const gigs = useQuery(
    gigsQuery({
      ...(category ? { category } : {}),
      ...(query.trim() ? { search: query.trim() } : {}),
      minPrice: applied.price[0],
      maxPrice: applied.price[1],
      ...(applied.maxDays ? { maxDeliveryDays: applied.maxDays } : {}),
      limit: 60,
    }),
  );
  const ids = [...new Set((gigs.data ?? []).map((g) => g.freelancer_id))];
  const sellers = useQuery(freelancerProfilesQuery(ids));
  const people = useQuery(freelancerSearchQuery(query));

  const results = (gigs.data ?? []).filter((g) => {
    const s = sellers.data?.[g.freelancer_id];
    if (!s) return applied.minRating === 0 && !applied.onlineOnly && !applied.verifiedOnly && !applied.location;
    if (applied.minRating && (s.freelancer.rating ?? 0) < applied.minRating) return false;
    if (applied.verifiedOnly && !(s.freelancer.is_verified || s.freelancer.has_blue_tick)) return false;
    if (applied.location && !(s.profile?.location ?? "").toLowerCase().includes(applied.location.toLowerCase()))
      return false;
    if (applied.onlineOnly) {
      const seen = s.profile?.last_seen ? new Date(s.profile.last_seen).getTime() : 0;
      if (Date.now() - seen > 5 * 60 * 1000) return false;
    }
    return true;
  });

  function runSearch(value: string) {
    const v = value.trim();
    recent.push(v);
    navigate({
      to: "/search",
      search: { ...(v ? { q: v } : {}), ...(category ? { category } : {}) },
      replace: true,
    });
  }

  function applyFilters() {
    setApplied({ price, minRating, maxDays, onlineOnly, verifiedOnly, location });
    setFiltersOpen(false);
  }

  function clearAll() {
    setPrice([0, 1000]);
    setMinRating(0);
    setMaxDays(0);
    setOnlineOnly(false);
    setVerifiedOnly(false);
    setLocation("");
    setApplied({ price: [0, 1000], minRating: 0, maxDays: 0, onlineOnly: false, verifiedOnly: false, location: "" });
  }

  const activeFilterCount =
    (applied.price[0] > 0 || applied.price[1] < 1000 ? 1 : 0) +
    (applied.minRating ? 1 : 0) +
    (applied.maxDays ? 1 : 0) +
    (applied.onlineOnly ? 1 : 0) +
    (applied.verifiedOnly ? 1 : 0) +
    (applied.location ? 1 : 0);

  return (
    <MobileShell>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <Link to="/" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-lg">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(term);
          }}
        >
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus={!query}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search gigs, services, freelancers"
            className="h-11 rounded-xl pl-9 pr-9"
          />
          {term ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setTerm("");
                navigate({ to: "/search", search: {}, replace: true });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </form>
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger
            aria-label="Filters"
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card"
          >
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            {activeFilterCount ? (
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="space-y-6 py-4">
              <div>
                <Label className="mb-2 block">Category</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => setCategory(category === c.slug ? null : c.slug)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium",
                        category === c.slug ? "border-primary bg-primary/10 text-primary" : "border-border",
                      )}
                    >
                      {c.label} {c.sub}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">
                  Price: ${price[0]} – ${price[1]}
                </Label>
                <Slider
                  value={price}
                  min={0}
                  max={1000}
                  step={10}
                  onValueChange={(v) => setPrice([v[0] ?? 0, v[1] ?? 1000])}
                />
              </div>

              <div>
                <Label className="mb-2 block">Minimum rating</Label>
                <div className="flex gap-2">
                  {[0, 3, 4, 4.5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setMinRating(r)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium",
                        minRating === r ? "border-primary bg-primary/10 text-primary" : "border-border",
                      )}
                    >
                      {r === 0 ? "Any" : <><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{r}+</>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Delivery time</Label>
                <div className="flex flex-wrap gap-2">
                  {DELIVERY_OPTIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setMaxDays(d.value)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium",
                        maxDays === d.value ? "border-primary bg-primary/10 text-primary" : "border-border",
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="loc" className="mb-2 block">
                  Seller location
                </Label>
                <Input
                  id="loc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Addis Ababa"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="online">Online sellers only</Label>
                <Switch id="online" checked={onlineOnly} onCheckedChange={setOnlineOnly} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="verified">Verified sellers only</Label>
                <Switch id="verified" checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
              </div>

              <div className="flex gap-3 pb-4">
                <Button variant="outline" className="h-12 flex-1 rounded-xl" onClick={clearAll}>
                  Clear All
                </Button>
                <Button className="h-12 flex-1 rounded-xl" onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <h1 className="px-4 pt-4 text-xl font-bold tracking-tight">Search Freelance Services</h1>

      <div className="space-y-6 px-4 pt-4">
        {!query ? (
          <>
            {recent.items.length ? (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Recent searches</h2>
                  <button onClick={recent.clear} className="text-xs font-medium text-primary">
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.items.map((r) => (
                    <button
                      key={r}
                      onClick={() => {
                        setTerm(r);
                        runSearch(r);
                      }}
                      className="rounded-full border border-border px-3 py-1.5 text-xs"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            <section>
              <h2 className="mb-2 text-sm font-semibold">Popular searches</h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setTerm(p);
                      runSearch(p);
                    }}
                    className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold">Browse categories</h2>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => {
                      setCategory(c.slug);
                      navigate({ to: "/search", search: { q: c.label, category: c.slug } });
                      setTerm(c.label);
                    }}
                    className="rounded-xl border border-border bg-card p-3 text-left text-xs font-semibold"
                  >
                    {c.label} <span className="text-muted-foreground">{c.sub}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <>
            {people.data?.length ? (
              <section>
                <h2 className="mb-2 text-sm font-semibold">Freelancers</h2>
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
                  {people.data.map((p) => (
                    <div key={p.id} className="w-28 shrink-0 rounded-xl border border-border bg-card p-3 text-center">
                      <Avatar className="mx-auto h-12 w-12">
                        <AvatarImage src={p.profile_image_url ?? undefined} alt="" />
                        <AvatarFallback>{initials(p.full_name)}</AvatarFallback>
                      </Avatar>
                      <p className="mt-2 truncate text-[11px] font-semibold">{p.full_name ?? p.username}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {p.professional_title ?? p.role ?? ""}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h2 className="mb-3 text-sm font-semibold">
                {gigs.isLoading ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"} for "${query}"`}
              </h2>
              {gigs.isLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 rounded-xl" />
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                  <SearchIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold">No results found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try a different keyword or clear your filters.
                  </p>
                  <Button variant="outline" className="mt-4 rounded-xl" onClick={clearAll}>
                    Clear All Filters
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {results.map((gig) => (
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
          </>
        )}
      </div>
    </MobileShell>
  );
}
