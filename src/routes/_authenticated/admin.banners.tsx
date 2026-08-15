import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { BannerCropper } from "@/components/banner-cropper";
import { BannerCarousel } from "@/components/hero-banner";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin } from "@/hooks/use-admin";
import {
  BANNER_RATIO,
  BANNER_RECOMMENDED,
  allBannersQuery,
  createBanner,
  deleteBanner,
  reorderBanners,
  updateBanner,
  uploadBannerMedia,
  type BannerButtonType,
  type HeroBanner,
} from "@/lib/banners";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  head: () => ({
    meta: [
      { title: "Home Banner Management — FIVESOM Admin" },
      {
        name: "description",
        content: "Upload, crop, schedule and publish the FIVESOM home hero banners.",
      },
      { property: "og:title", content: "FIVESOM Admin — Home Banner Management" },
      { property: "og:description", content: "Manage the FIVESOM home hero banner carousel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminBannersPage,
});

const BUTTON_TYPES: { value: BannerButtonType; label: string; hint: string }[] = [
  { value: "none", label: "No button", hint: "" },
  { value: "internal", label: "Internal app page", hint: "Path, e.g. /search" },
  { value: "gig", label: "Gig", hint: "Gig ID" },
  { value: "category", label: "Category", hint: "Category slug, e.g. logo-design" },
  { value: "freelancer", label: "Freelancer profile", hint: "Freelancer ID" },
  { value: "search", label: "Search results", hint: "Search term" },
  { value: "orders", label: "Orders", hint: "" },
  { value: "external", label: "External URL", hint: "https://fivesom.net/explore" },
];

type Draft = {
  id?: string;
  media_url: string;
  media_type: "image" | "video";
  fallback_image_url: string;
  title: string;
  description: string;
  button_text: string;
  button_type: BannerButtonType;
  button_url: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
};

const EMPTY: Draft = {
  media_url: "",
  media_type: "image",
  fallback_image_url: "",
  title: "",
  description: "",
  button_text: "",
  button_type: "none",
  button_url: "",
  is_active: true,
  starts_at: "",
  ends_at: "",
};

function toDraft(b: HeroBanner): Draft {
  return {
    id: b.id,
    media_url: b.media_url,
    media_type: b.media_type,
    fallback_image_url: b.fallback_image_url ?? "",
    title: b.title ?? "",
    description: b.description ?? "",
    button_text: b.button_text ?? "",
    button_type: b.button_type,
    button_url: b.button_url ?? "",
    is_active: b.is_active,
    starts_at: b.starts_at ? b.starts_at.slice(0, 16) : "",
    ends_at: b.ends_at ? b.ends_at.slice(0, 16) : "",
  };
}

function draftToBanner(d: Draft, order: number): HeroBanner {
  return {
    id: d.id ?? "preview",
    media_url: d.media_url,
    media_type: d.media_type,
    fallback_image_url: d.fallback_image_url || null,
    title: d.title || null,
    description: d.description || null,
    button_text: d.button_text || null,
    button_type: d.button_type,
    button_url: d.button_url || null,
    is_active: d.is_active,
    display_order: order,
    starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : null,
    ends_at: d.ends_at ? new Date(d.ends_at).toISOString() : null,
    created_at: "",
    updated_at: "",
  };
}

function AdminBannersPage() {
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const banners = useQuery({ ...allBannersQuery(), enabled: isAdmin });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["hero-banners"] });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!d.media_url && d.media_type === "image") throw new Error("Upload a banner image first");
      const payload = draftToBanner(d, banners.data?.length ?? 0);
      const { id, created_at: _c, updated_at: _u, ...fields } = payload;
      if (d.id) await updateBanner(d.id, fields);
      else await createBanner({ ...fields, display_order: banners.data?.length ?? 0 });
      void id;
    },
    onSuccess: () => {
      toast.success("Banner saved");
      setDraft(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBanner(id),
    onSuccess: () => {
      toast.success("Banner deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      updateBanner(id, { is_active: value }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderBanners(ids),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return (
      <MobileShell>
        <AppHeader title="Home Banner Management" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </MobileShell>
    );
  }

  if (!isAdmin) {
    return (
      <MobileShell>
        <AppHeader title="Home Banner Management" />
        <div className="p-6">
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            This page is for FIVESOM administrators only.
          </p>
        </div>
      </MobileShell>
    );
  }

  const list = banners.data ?? [];
  const previewBanners = draft
    ? [draftToBanner(draft, 0)]
    : list.filter((b) => b.is_active);

  async function handleUpload(file: File, kind: "media" | "fallback") {
    setUploading(true);
    try {
      const url = await uploadBannerMedia(file, file.name);
      setDraft((d) =>
        d ? { ...d, ...(kind === "media" ? { media_url: url } : { fallback_image_url: url }) } : d,
      );
      toast.success("Upload complete");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function move(index: number, dir: -1 | 1) {
    const ids = list.map((b) => b.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    reorder.mutate(ids);
  }

  return (
    <MobileShell>
      <AppHeader title="Home Banner Management" />
      <div className="space-y-6 px-4 py-4">
        <section className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          <p className="text-sm font-semibold text-foreground">Banner specifications</p>
          <p className="mt-1">
            Recommended size: <strong>{BANNER_RECOMMENDED.width} × {BANNER_RECOMMENDED.height} px</strong>
          </p>
          <p>Aspect ratio: <strong>{BANNER_RATIO}:1</strong></p>
          <p>Formats: JPG, PNG, WebP, MP4 / WebM (video)</p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Live home preview</h2>
          <div className="rounded-2xl border border-border bg-background p-3">
            <div className="mb-3 h-10 rounded-xl border border-border bg-card px-3 text-xs leading-10 text-muted-foreground">
              Search services...
            </div>
            {previewBanners.length ? (
              <BannerCarousel banners={previewBanners} interactive={false} />
            ) : (
              <div
                className="grid place-items-center rounded-2xl border border-dashed border-border text-xs text-muted-foreground"
                style={{ aspectRatio: String(BANNER_RATIO) }}
              >
                No published banners
              </div>
            )}
            <p className="mt-3 text-sm font-semibold">Popular Services</p>
          </div>
        </section>

        {draft ? (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">{draft.id ? "Edit banner" : "New banner"}</h2>

            <div className="flex gap-2">
              {(["image", "video"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={draft.media_type === t ? "default" : "outline"}
                  onClick={() => setDraft({ ...draft, media_type: t })}
                >
                  {t === "image" ? "Image" : "Video"}
                </Button>
              ))}
            </div>

            {cropFile ? (
              <BannerCropper
                file={cropFile}
                onCancel={() => setCropFile(null)}
                onCropped={async (blob) => {
                  setCropFile(null);
                  await handleUpload(new File([blob], "banner.jpg", { type: "image/jpeg" }), "media");
                }}
              />
            ) : (
              <div className="space-y-2">
                <Label className="text-xs">
                  {draft.media_type === "image" ? "Banner image (crop to 2.45:1)" : "Banner video"}
                </Label>
                <Input
                  type="file"
                  accept={draft.media_type === "image" ? "image/*" : "video/mp4,video/webm"}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (draft.media_type === "image") setCropFile(f);
                    else void handleUpload(f, "media");
                    e.target.value = "";
                  }}
                />
                {draft.media_type === "video" ? (
                  <div>
                    <Label className="text-xs">Fallback image (used when autoplay is blocked)</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUpload(f, "fallback");
                        e.target.value = "";
                      }}
                    />
                  </div>
                ) : null}
                {uploading ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                  </p>
                ) : null}
              </div>
            )}

            <div>
              <Label className="text-xs">Heading</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Find, Hire & Work with the best freelancers"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Connect. Work. Earn. Grow Together."
                rows={2}
              />
            </div>
            <div>
              <Label className="text-xs">Button text</Label>
              <Input
                value={draft.button_text}
                onChange={(e) => setDraft({ ...draft, button_text: e.target.value })}
                placeholder="Explore Now"
              />
            </div>
            <div>
              <Label className="text-xs">Button action</Label>
              <select
                value={draft.button_type}
                onChange={(e) =>
                  setDraft({ ...draft, button_type: e.target.value as BannerButtonType })
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {BUTTON_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            {draft.button_type !== "none" && draft.button_type !== "orders" ? (
              <div>
                <Label className="text-xs">
                  {draft.button_type === "external" ? "Enter URL" : "Target value"}
                </Label>
                <Input
                  value={draft.button_url}
                  onChange={(e) => setDraft({ ...draft, button_url: e.target.value })}
                  placeholder={BUTTON_TYPES.find((t) => t.value === draft.button_type)?.hint}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Start (optional)</Label>
                <Input
                  type="datetime-local"
                  value={draft.starts_at}
                  onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">End (optional)</Label>
                <Input
                  type="datetime-local"
                  value={draft.ends_at}
                  onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-sm">Published</span>
              <Switch
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => save.mutate(draft)} disabled={save.isPending || uploading}>
                {save.isPending ? "Saving…" : "Save banner"}
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </section>
        ) : (
          <Button onClick={() => setDraft({ ...EMPTY })} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> New banner
          </Button>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold">All banners</h2>
          {banners.isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No banners yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((b, i) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div
                    className="h-12 w-28 shrink-0 overflow-hidden rounded-md bg-muted"
                    style={{ aspectRatio: String(BANNER_RATIO) }}
                  >
                    {b.media_url && b.media_type === "image" ? (
                      <img src={b.media_url} alt="" className="h-full w-full object-cover" />
                    ) : b.fallback_image_url ? (
                      <img src={b.fallback_image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full place-items-center text-[10px] text-muted-foreground">
                        {b.media_type}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.title ?? "Untitled"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.media_type} · order {i + 1} · {b.is_active ? "Active" : "Off"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={b.is_active}
                      onCheckedChange={(v) => toggle.mutate({ id: b.id, value: v })}
                      aria-label="Publish"
                    />
                    <Button size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDraft(toDraft(b))} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remove.mutate(b.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </MobileShell>
  );
}
