import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Star } from "lucide-react";

import { GigCard } from "@/components/gig-card";
import { MobileShell } from "@/components/mobile-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  freelancerProfilesQuery,
  gigsQuery,
  initials,
  isOnline,
  memberSince,
  money,
} from "@/lib/fivesom";

export const Route = createFileRoute("/freelancers/$freelancerId")({
  head: ({ params, loaderData }) => {
    const profile = loaderData?.profile ?? null;
    const name = profile?.full_name ?? profile?.username ?? "Freelancer";
    const title = profile?.professional_title ?? "FIVESOM Seller";
    return {
      meta: [
        { title: `${name} — ${title} | FIVESOM` },
        { name: "description", content: `Hire ${name} on FIVESOM. View their gigs, portfolio, ratings and reviews.` },
        { property: "og:title", content: `${name} — ${title} | FIVESOM` },
        { property: "og:description", content: `Hire ${name} on FIVESOM.` },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `/freelancers/${params.freelancerId}` }],
    };
  },
  loader: async ({ params, context }) => {
    const profile = await context.queryClient.ensureQueryData(
      freelancerProfilesQuery([params.freelancerId]),
    );
    return { profile: profile[params.freelancerId] ?? null };
  },
  component: FreelancerPage,
  notFoundComponent: () => <div className="p-6 text-sm">Freelancer not found.</div>,
});

function FreelancerPage() {
  const { freelancerId } = Route.useParams();
  const profile = Route.useLoaderData()?.profile;

  const gigs = useQuery(gigsQuery({ freelancerId, limit: 60 }));
  const ids = [...new Set((gigs.data ?? []).map((g) => g.freelancer_id))];
  const sellers = useQuery(freelancerProfilesQuery(ids));

  if (!profile) {
    return (
      <MobileShell>
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <Link to="/" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-semibold">Freelancer</span>
        </header>
        <div className="p-6 text-sm text-muted-foreground">Freelancer not found.</div>
      </MobileShell>
    );
  }

  const p = profile.profile;
  const f = profile.freelancer;
  const online = isOnline(p?.last_seen);
  const skills = (f?.skills ?? p?.skills ?? []) as string[];
  const languages = (p?.languages ?? []) as string[];

  return (
    <MobileShell>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Link to="/" aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-semibold">{p?.full_name ?? "Freelancer"}</span>
      </header>

      <div className="space-y-6 px-4 pt-4">
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 border border-border">
                <AvatarImage src={p?.profile_image_url ?? undefined} alt={p?.full_name ?? ""} className="object-cover" />
                <AvatarFallback className="text-lg">{initials(p?.full_name)}</AvatarFallback>
              </Avatar>
              <span
                aria-label={online ? "Online" : "Offline"}
                className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-card ${
                  online ? "bg-success" : "bg-muted-foreground/50"
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold leading-tight">{p?.full_name ?? "Freelancer"}</h1>
              <p className="truncate text-sm text-muted-foreground">
                {f?.professional_title ?? p?.professional_title ?? "Seller"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  {Number(f?.rating ?? 0).toFixed(1)}
                </span>
                {p?.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {p.location}
                  </span>
                ) : null}
                {p?.member_since ? (
                  <span>Member since {memberSince(p.member_since)}</span>
                ) : null}
              </div>
            </div>
          </div>

          {p?.bio ? (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{p.bio}</p>
          ) : null}

          {skills.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {skills.map((s) => (
                <span key={s} className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px]">
                  {s}
                </span>
              ))}
            </div>
          ) : null}

          {languages.length ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Languages: {languages.join(", ")}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-center">
            <div>
              <p className="text-lg font-bold text-primary">{f?.completed_orders ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">Orders Completed</p>
            </div>
            <div>
              <p className="text-lg font-bold text-primary">
                {money(f?.rating ? f.rating * 10 : 0)}
              </p>
              <p className="text-[11px] text-muted-foreground">Hourly from</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold">Gigs by this seller</h2>
          {gigs.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : (gigs.data ?? []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              This freelancer has no active gigs yet.
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
