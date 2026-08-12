import { Link } from "@tanstack/react-router";
import { Heart, Star } from "lucide-react";

import { useFavorites } from "@/hooks/use-favorites";
import { gigImage, money, type Gig } from "@/lib/fivesom";
import { cn } from "@/lib/utils";

export function GigCard({
  gig,
  sellerName,
  rating,
}: {
  gig: Gig;
  sellerName?: string | null;
  rating?: number | null;
}) {
  const { isFavorite, toggle } = useFavorites();
  const img = gigImage(gig);
  const saved = isFavorite(gig.id);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={saved ? "Remove from favorites" : "Save to favorites"}
        onClick={(e) => {
          e.preventDefault();
          toggle(gig.id);
        }}
        className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-background/85 backdrop-blur"
      >
        <Heart className={cn("h-4 w-4", saved ? "fill-primary text-primary" : "text-muted-foreground")} />
      </button>
      <Link
        to="/gigs/$gigId"
        params={{ gigId: gig.id }}
        className="block overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="aspect-[4/3] w-full bg-muted">
          {img ? (
            <img src={img} alt={gig.title} loading="lazy" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="space-y-1 p-2.5">
          <p className="line-clamp-2 text-xs font-medium leading-snug">{gig.title}</p>
          {sellerName ? (
            <p className="truncate text-[11px] text-muted-foreground">{sellerName}</p>
          ) : null}
          <div className="flex items-center justify-between pt-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {(rating ?? 0).toFixed(1)}
            </span>
            <span className="text-sm font-bold text-primary">{money(gig.base_price)}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
