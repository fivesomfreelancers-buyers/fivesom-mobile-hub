import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Image as ImageIcon, Megaphone, Users, LayoutGrid, ClipboardList } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsAdmin } from "@/hooks/use-admin";
import { allAdsQuery } from "@/lib/ads";
import { allBannersQuery } from "@/lib/banners";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — FIVESOM" },
      {
        name: "description",
        content: "FIVESOM admin control centre: home banners, in-app ads and platform content.",
      },
      { property: "og:title", content: "FIVESOM Admin Dashboard" },
      { property: "og:description", content: "Manage FIVESOM banners, ads and platform content." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const { isAdmin, loading } = useIsAdmin();
  const banners = useQuery({ ...allBannersQuery(), enabled: isAdmin, retry: false });
  const ads = useQuery({ ...allAdsQuery(), enabled: isAdmin, retry: false });

  if (loading) {
    return (
      <MobileShell>
        <AppHeader title="Admin" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </MobileShell>
    );
  }

  if (!isAdmin) {
    return (
      <MobileShell>
        <AppHeader title="Admin" />
        <div className="p-6">
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            This area is for FIVESOM administrators only.
          </p>
        </div>
      </MobileShell>
    );
  }

  const adList = ads.data ?? [];
  const liveAds = adList.filter((a) => a.is_active).length;
  const impressions = adList.reduce((n, a) => n + (a.impressions ?? 0), 0);
  const clicks = adList.reduce((n, a) => n + (a.clicks ?? 0), 0);

  return (
    <MobileShell>
      <AppHeader title="Admin" />
      <div className="space-y-6 px-4 py-4">
        <section className="grid grid-cols-3 gap-3">
          <Stat label="Live ads" value={liveAds} />
          <Stat label="Impressions" value={impressions} />
          <Stat label="Clicks" value={clicks} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Manage</h2>
          <Tile
            to="/admin/ads"
            icon={Megaphone}
            title="Ads & Promotions"
            sub={`${adList.length} ad${adList.length === 1 ? "" : "s"} • home, search & gig placements`}
          />
          <Tile
            to="/admin/banners"
            icon={ImageIcon}
            title="Home Hero Banners"
            sub={`${(banners.data ?? []).length} banner${(banners.data ?? []).length === 1 ? "" : "s"} • crop, schedule, reorder`}
          />
          <Tile to="/gigs/manage" icon={LayoutGrid} title="Gigs" sub="Review and manage gigs" />
          <Tile to="/orders" icon={ClipboardList} title="Orders" sub="Order activity and disputes" />
          <Tile to="/search" icon={Users} title="Freelancers" sub="Browse the marketplace" />
        </section>
      </div>
    </MobileShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <p className="text-lg font-bold">{value.toLocaleString()}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Tile({
  to,
  icon: Icon,
  title,
  sub,
}: {
  to: string;
  icon: typeof Megaphone;
  title: string;
  sub: string;
}) {
  return (
    <Link
      to={to as never}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
    </Link>
  );
}
