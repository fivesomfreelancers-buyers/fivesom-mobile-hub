import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { BANNER_RATIO, activeBannersQuery, bannerTarget, type HeroBanner } from "@/lib/banners";
import { cn } from "@/lib/utils";

const FALLBACK: HeroBanner = {
  id: "default",
  media_url: "",
  media_type: "image",
  fallback_image_url: null,
  title: "Find, Hire & Work with the best freelancers",
  description: "Connect. Work. Earn. Grow Together.",
  button_text: "Explore Now",
  button_type: "internal",
  button_url: "/search",
  is_active: true,
  display_order: 0,
  starts_at: null,
  ends_at: null,
  created_at: "",
  updated_at: "",
};

export function HeroBannerSlider() {
  const { data } = useQuery(activeBannersQuery());
  const banners = data && data.length > 0 ? data : [FALLBACK];
  return <BannerCarousel banners={banners} />;
}

/** Shared by the Home screen and the admin live preview. */
export function BannerCarousel({
  banners,
  interactive = true,
}: {
  banners: HeroBanner[];
  interactive?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const count = banners.length;
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (index > count - 1) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % count), 3000);
    return () => clearTimeout(t);
  }, [index, count]);

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + count) % count);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-primary"
      style={{ aspectRatio: String(BANNER_RATIO) }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX ?? null;
        touchX.current = null;
        if (start === null || end === null || count < 2) return;
        const dx = end - start;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      <div
        className="flex h-full w-full transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((b, i) => (
          <BannerSlide key={b.id || i} banner={b} active={i === index} interactive={interactive} />
        ))}
      </div>

      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={`dot-${b.id || i}`}
              type="button"
              aria-label={`Show banner ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full bg-primary-foreground transition-all",
                i === index ? "w-4 opacity-100" : "w-1.5 opacity-50",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BannerSlide({
  banner,
  active,
  interactive,
}: {
  banner: HeroBanner;
  active: boolean;
  interactive: boolean;
}) {
  const [videoFailed, setVideoFailed] = useState(false);
  const target = bannerTarget(banner);
  const showVideo = banner.media_type === "video" && !!banner.media_url && !videoFailed;

  return (
    <div className="relative h-full w-full shrink-0 overflow-hidden bg-primary">
      {showVideo ? (
        <video
          src={banner.media_url}
          poster={banner.fallback_image_url ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : banner.media_url || banner.fallback_image_url ? (
        <img
          src={
            banner.media_type === "video"
              ? (banner.fallback_image_url ?? "")
              : banner.media_url || (banner.fallback_image_url ?? "")
          }
          alt={banner.title ?? "FIVESOM banner"}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
      ) : null}

      {banner.media_url || banner.fallback_image_url ? (
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
      ) : null}

      <div className="relative flex h-full flex-col justify-center gap-1 p-4 text-primary-foreground">
        {banner.title ? (
          <p className="line-clamp-2 text-base font-bold leading-snug sm:text-lg">{banner.title}</p>
        ) : null}
        {banner.description ? (
          <p className="line-clamp-1 text-xs opacity-90 sm:text-sm">{banner.description}</p>
        ) : null}
        {banner.button_text && target ? (
          interactive && target.kind === "internal" ? (
            <Link
              to={target.to as never}
              tabIndex={active ? 0 : -1}
              className="mt-2 inline-flex w-fit rounded-lg bg-primary-foreground px-3 py-1.5 text-[11px] font-semibold text-primary"
            >
              {banner.button_text}
            </Link>
          ) : interactive && target.kind === "external" ? (
            <a
              href={target.href}
              target="_blank"
              rel="noreferrer noopener"
              tabIndex={active ? 0 : -1}
              className="mt-2 inline-flex w-fit rounded-lg bg-primary-foreground px-3 py-1.5 text-[11px] font-semibold text-primary"
            >
              {banner.button_text}
            </a>
          ) : (
            <span className="mt-2 inline-flex w-fit rounded-lg bg-primary-foreground px-3 py-1.5 text-[11px] font-semibold text-primary">
              {banner.button_text}
            </span>
          )
        ) : null}
      </div>
    </div>
  );
}
