import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

import { adTarget, adsQuery, trackAd, type AdPlacement, type AppAd } from "@/lib/ads";
import { cn } from "@/lib/utils";

/** Renders the live ads for a placement. Silent when there are none. */
export function AdSlot({
  placement,
  limit = 1,
  className,
}: {
  placement: AdPlacement;
  limit?: number;
  className?: string;
}) {
  const { data } = useQuery(adsQuery(placement));
  const ads = (data ?? []).slice(0, limit);
  if (ads.length === 0) return null;
  return (
    <div className={cn("space-y-3", className)}>
      {ads.map((ad) => (
        <AdCard key={ad.id} ad={ad} />
      ))}
    </div>
  );
}

export function AdCard({ ad, preview = false }: { ad: AppAd; preview?: boolean }) {
  const target = adTarget(ad);

  useEffect(() => {
    if (!preview && ad.id) trackAd(ad.id, "impression");
  }, [ad.id, preview]);

  const body = (
    <div className="flex gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3">
      {ad.image_url ? (
        <img
          src={ad.image_url}
          alt=""
          loading="lazy"
          className="h-20 w-20 shrink-0 rounded-xl object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ad
        </span>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{ad.title}</p>
        {ad.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{ad.description}</p>
        ) : null}
        {ad.cta_text ? (
          <span className="mt-2 inline-flex rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground">
            {ad.cta_text}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (preview || !target) return body;

  if (target.kind === "external") {
    return (
      <a
        href={target.href}
        target="_blank"
        rel="noreferrer noopener"
        onClick={() => trackAd(ad.id, "click")}
      >
        {body}
      </a>
    );
  }
  return (
    <Link to={target.to as never} onClick={() => trackAd(ad.id, "click")}>
      {body}
    </Link>
  );
}
