import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { GigCard } from "@/components/gig-card";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavorites } from "@/hooks/use-favorites";
import { freelancerProfilesQuery, gigsByIdsQuery } from "@/lib/fivesom";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Saved Gigs — FIVESOM" },
      { name: "description", content: "The FIVESOM gigs you saved for later, ready to order." },
      { property: "og:title", content: "Saved Gigs — FIVESOM" },
      { property: "og:description", content: "Your shortlist of favourite FIVESOM services." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { ids } = useFavorites();
  const gigs = useQuery(gigsByIdsQuery(ids));
  const sellerIds = [...new Set((gigs.data ?? []).map((g) => g.freelancer_id))];
  const sellers = useQuery(freelancerProfilesQuery(sellerIds));

  return (
    <MobileShell>
      <AppHeader title="Favorites" />
      <div className="px-4 pt-4">
        {ids.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Heart className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No favorites yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tap the heart on any gig to save it here.
            </p>
            <Button asChild className="mt-4 rounded-xl">
              <Link to="/search">Explore gigs</Link>
            </Button>
          </div>
        ) : gigs.isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
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
      </div>
    </MobileShell>
  );
}
