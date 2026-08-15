import { supabase } from "@/integrations/supabase/client";

/** Home hero banner aspect ratio — 1200 x 490 recommended upload. */
export const BANNER_RATIO = 2.45;
export const BANNER_RECOMMENDED = { width: 1200, height: 490 };
export const BANNER_BUCKET = "hero-banners";

export type BannerButtonType =
  | "none"
  | "internal"
  | "gig"
  | "category"
  | "freelancer"
  | "search"
  | "orders"
  | "external";

export type HeroBanner = {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  fallback_image_url: string | null;
  title: string | null;
  description: string | null;
  button_text: string | null;
  button_type: BannerButtonType;
  button_url: string | null;
  is_active: boolean;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS =
  "id, media_url, media_type, fallback_image_url, title, description, button_text, button_type, button_url, is_active, display_order, starts_at, ends_at, created_at, updated_at";

/** Banners visible on the Home screen (published + inside their schedule). */
export const activeBannersQuery = () => ({
  queryKey: ["hero-banners", "active"],
  staleTime: 30_000,
  queryFn: async (): Promise<HeroBanner[]> => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("hero_banners")
      .select(COLUMNS)
      .eq("is_active", true)
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      // Table not provisioned yet — fall back to the built-in banner.
      if (error.code === "PGRST205" || error.code === "42P01") return [];
      throw error;
    }
    return (data ?? []) as HeroBanner[];
  },
});

/** Every banner, published or not — admin only (RLS enforced server-side). */
export const allBannersQuery = () => ({
  queryKey: ["hero-banners", "all"],
  queryFn: async (): Promise<HeroBanner[]> => {
    const { data, error } = await supabase
      .from("hero_banners")
      .select(COLUMNS)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as HeroBanner[];
  },
});

export type BannerInput = Omit<HeroBanner, "id" | "created_at" | "updated_at">;

export async function createBanner(input: BannerInput) {
  const { error } = await supabase.from("hero_banners").insert(input as never);
  if (error) throw error;
}

export async function updateBanner(id: string, patch: Partial<BannerInput>) {
  const { error } = await supabase.from("hero_banners").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteBanner(id: string) {
  const { error } = await supabase.from("hero_banners").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderBanners(ids: string[]) {
  await Promise.all(ids.map((id, i) => updateBanner(id, { display_order: i })));
}

/** Uploads a banner asset (Blob from the cropper, or a raw video file). */
export async function uploadBannerMedia(file: Blob, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BANNER_BUCKET).upload(path, file, {
    cacheControl: "3600",
    ...(file.type ? { contentType: file.type } : {}),
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Resolves a banner button into either an in-app path or an external URL. */
export function bannerTarget(b: Pick<HeroBanner, "button_type" | "button_url">):
  | { kind: "internal"; to: string }
  | { kind: "external"; href: string }
  | null {
  const value = (b.button_url ?? "").trim();
  switch (b.button_type) {
    case "external":
      return value ? { kind: "external", href: value } : null;
    case "gig":
      return value ? { kind: "internal", to: `/gigs/${value}` } : null;
    case "freelancer":
      return value ? { kind: "internal", to: `/freelancers/${value}` } : null;
    case "category":
      return { kind: "internal", to: `/search?category=${encodeURIComponent(value)}` };
    case "search":
      return { kind: "internal", to: `/search${value ? `?q=${encodeURIComponent(value)}` : ""}` };
    case "orders":
      return { kind: "internal", to: "/orders" };
    case "internal":
      return { kind: "internal", to: value.startsWith("/") ? value : `/${value}` };
    default:
      return null;
  }
}
