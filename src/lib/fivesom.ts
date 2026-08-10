import { supabase } from "@/integrations/supabase/client";

export type PublicProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  profile_image_url: string | null;
  professional_title: string | null;
  bio: string | null;
  location: string | null;
  role: string | null;
  last_seen: string | null;
};

export type PublicFreelancer = {
  id: string;
  user_id: string;
  bio: string | null;
  skills: string[] | null;
  rating: number | null;
  completed_orders: number | null;
  is_verified: boolean | null;
  has_blue_tick: boolean | null;
  professional_title: string | null;
};

export type Gig = {
  id: string;
  freelancer_id: string;
  title: string;
  description: string | null;
  base_price: number;
  delivery_time_days: number | null;
  images: string[] | null;
  thumbnail_url: string | null;
  status: string | null;
  category_slug: string | null;
  subcategory_slug: string | null;
  tags: string[] | null;
  is_vip: boolean | null;
  created_at: string;
};

export type GigPackage = {
  id: string;
  gig_id: string;
  package_type: string;
  name: string | null;
  price: number;
  delivery_time: string | null;
  revisions: string | null;
  features: string[] | null;
  is_active: boolean | null;
};

export const CATEGORIES = [
  { slug: "website-development", label: "Website", sub: "Development" },
  { slug: "logo-design", label: "Logo", sub: "Design" },
  { slug: "ui-ux-design", label: "UI/UX", sub: "Design" },
  { slug: "content-writing", label: "Content", sub: "Writing" },
  { slug: "video-editing", label: "Video", sub: "Editing" },
  { slug: "ai-services", label: "AI", sub: "Services" },
  { slug: "mobile-app-development", label: "Mobile App", sub: "Development" },
  { slug: "graphics-design", label: "Graphics", sub: "Design" },
];

export const gigsQuery = (opts: { category?: string; search?: string; limit?: number } = {}) => ({
  queryKey: ["gigs", opts.category ?? null, opts.search ?? null, opts.limit ?? 30],
  queryFn: async (): Promise<Gig[]> => {
    let q = supabase
      .from("gigs")
      .select(
        "id, freelancer_id, title, description, base_price, delivery_time_days, images, thumbnail_url, status, category_slug, subcategory_slug, tags, is_vip, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 30);
    if (opts.category) q = q.eq("category_slug", opts.category);
    if (opts.search) q = q.ilike("title", `%${opts.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as Gig[];
  },
});

export const gigQuery = (id: string) => ({
  queryKey: ["gig", id],
  queryFn: async () => {
    const { data, error } = await supabase.from("gigs").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Gig | null;
  },
});

export const gigPackagesQuery = (gigId: string) => ({
  queryKey: ["gig-packages", gigId],
  queryFn: async (): Promise<GigPackage[]> => {
    const { data, error } = await supabase
      .from("gig_packages")
      .select("*")
      .eq("gig_id", gigId)
      .eq("is_active", true);
    if (error) throw error;
    const order = { basic: 0, standard: 1, premium: 2 } as Record<string, number>;
    return ((data ?? []) as GigPackage[]).sort(
      (a, b) => (order[a.package_type] ?? 9) - (order[b.package_type] ?? 9),
    );
  },
});

export const freelancersQuery = (limit = 20) => ({
  queryKey: ["freelancers", limit],
  queryFn: async (): Promise<PublicFreelancer[]> => {
    const { data, error } = await supabase
      .from("public_freelancers")
      .select("id, user_id, bio, skills, rating, completed_orders, is_verified, has_blue_tick, professional_title")
      .order("rating", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as PublicFreelancer[];
  },
});

/** Map freelancer row ids -> their public profile (via user_id). */
export const freelancerProfilesQuery = (freelancerIds: string[]) => ({
  queryKey: ["freelancer-profiles", [...freelancerIds].sort()],
  enabled: freelancerIds.length > 0,
  queryFn: async () => {
    const { data: fl, error: e1 } = await supabase
      .from("public_freelancers")
      .select("id, user_id, rating, completed_orders, is_verified, has_blue_tick, professional_title")
      .in("id", freelancerIds);
    if (e1) throw e1;
    const userIds = (fl ?? []).map((f) => f.user_id as string);
    let profiles: PublicProfile[] = [];
    if (userIds.length) {
      const { data: pr, error: e2 } = await supabase
        .from("public_profiles")
        .select("id, full_name, username, profile_image_url, professional_title, bio, location, role, last_seen")
        .in("id", userIds);
      if (e2) throw e2;
      profiles = (pr ?? []) as PublicProfile[];
    }
    const byUser = new Map(profiles.map((p) => [p.id, p]));
    const map: Record<string, { freelancer: PublicFreelancer; profile?: PublicProfile }> = {};
    for (const f of fl ?? []) {
      map[f.id as string] = {
        freelancer: f as unknown as PublicFreelancer,
        profile: byUser.get(f.user_id as string),
      };
    }
    return map;
  },
});

export function gigImage(gig: Pick<Gig, "images" | "thumbnail_url">) {
  return gig.thumbnail_url ?? gig.images?.[0] ?? null;
}

export function money(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "FS";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}
