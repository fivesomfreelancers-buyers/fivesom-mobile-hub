import { supabase } from "@/integrations/supabase/client";

export type AdPlacement = "home_top" | "home_feed" | "search" | "gig_detail";
export type AdLinkType = "none" | "internal" | "external";

export const AD_PLACEMENTS: { value: AdPlacement; label: string }[] = [
  { value: "home_top", label: "Home — under the hero banner" },
  { value: "home_feed", label: "Home — inside the gig feed" },
  { value: "search", label: "Search results" },
  { value: "gig_detail", label: "Gig detail page" },
];

export type AppAd = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_text: string | null;
  link_type: AdLinkType;
  link_url: string | null;
  placement: AdPlacement;
  is_active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, title, description, image_url, cta_text, link_type, link_url, placement, is_active, priority, starts_at, ends_at, impressions, clicks, created_at, updated_at";

/** Live ads for one placement (published + inside their schedule). */
export const adsQuery = (placement: AdPlacement) => ({
  queryKey: ["app-ads", placement],
  staleTime: 60_000,
  queryFn: async (): Promise<AppAd[]> => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("app_ads")
      .select(COLUMNS)
      .eq("placement", placement)
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) {
      // Table not provisioned yet — render nothing.
      if (error.code === "PGRST205" || error.code === "42P01") return [];
      throw error;
    }
    return (data ?? []) as AppAd[];
  },
});

/** Every ad — admin only (RLS enforced server-side). */
export const allAdsQuery = () => ({
  queryKey: ["app-ads", "all"],
  queryFn: async (): Promise<AppAd[]> => {
    const { data, error } = await supabase
      .from("app_ads")
      .select(COLUMNS)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as AppAd[];
  },
});

export type AdInput = Omit<
  AppAd,
  "id" | "created_at" | "updated_at" | "impressions" | "clicks"
>;

export async function createAd(input: AdInput) {
  const { error } = await supabase.from("app_ads").insert(input as never);
  if (error) throw error;
}

export async function updateAd(id: string, patch: Partial<AdInput>) {
  const { error } = await supabase.from("app_ads").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteAd(id: string) {
  const { error } = await supabase.from("app_ads").delete().eq("id", id);
  if (error) throw error;
}

/** Fire-and-forget analytics counter. */
export function trackAd(id: string, kind: "impression" | "click") {
  void supabase.rpc("track_ad_event", { _ad_id: id, _kind: kind } as never);
}

export function adTarget(
  ad: Pick<AppAd, "link_type" | "link_url">,
): { kind: "internal"; to: string } | { kind: "external"; href: string } | null {
  const value = (ad.link_url ?? "").trim();
  if (!value) return null;
  if (ad.link_type === "external") return { kind: "external", href: value };
  if (ad.link_type === "internal")
    return { kind: "internal", to: value.startsWith("/") ? value : `/${value}` };
  return null;
}
