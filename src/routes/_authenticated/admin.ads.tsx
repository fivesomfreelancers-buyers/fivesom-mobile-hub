import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdCard } from "@/components/ad-slot";
import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsAdmin } from "@/hooks/use-admin";
import {
  AD_PLACEMENTS,
  allAdsQuery,
  createAd,
  deleteAd,
  updateAd,
  type AdInput,
  type AdLinkType,
  type AdPlacement,
  type AppAd,
} from "@/lib/ads";
import { uploadBannerMedia } from "@/lib/banners";

export const Route = createFileRoute("/_authenticated/admin/ads")({
  head: () => ({
    meta: [
      { title: "Ads & Promotions — FIVESOM Admin" },
      {
        name: "description",
        content: "Create, schedule and measure the in-app ads shown across the FIVESOM app.",
      },
      { property: "og:title", content: "FIVESOM Admin — Ads & Promotions" },
      { property: "og:description", content: "Manage FIVESOM in-app ads and promotions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminAdsPage,
});

type Draft = AdInput & { id?: string };

const EMPTY: Draft = {
  title: "",
  description: "",
  image_url: null,
  cta_text: "",
  link_type: "none",
  link_url: "",
  placement: "home_feed",
  is_active: true,
  priority: 0,
  starts_at: null,
  ends_at: null,
};

const toLocal = (iso: string | null) => (iso ? iso.slice(0, 16) : "");
const toIso = (v: string) => (v ? new Date(v).toISOString() : null);

function draftToAd(d: Draft): AppAd {
  return {
    id: d.id ?? "preview",
    ...d,
    description: d.description || null,
    cta_text: d.cta_text || null,
    impressions: 0,
    clicks: 0,
    created_at: "",
    updated_at: "",
  };
}

function AdminAdsPage() {
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const ads = useQuery({ ...allAdsQuery(), enabled: isAdmin, retry: false });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["app-ads"] });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload: AdInput = {
        title: d.title.trim(),
        description: d.description?.trim() || null,
        image_url: d.image_url || null,
        cta_text: d.cta_text?.trim() || null,
        link_type: d.link_type,
        link_url: d.link_url?.trim() || null,
        placement: d.placement,
        is_active: d.is_active,
        priority: Number(d.priority) || 0,
        starts_at: d.starts_at,
        ends_at: d.ends_at,
      };
      if (!payload.title) throw new Error("Title is required");
      if (d.id) await updateAd(d.id, payload);
      else await createAd(payload);
    },
    onSuccess: () => {
      toast.success("Ad saved");
      setDraft(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAd(id),
    onSuccess: () => {
      toast.success("Ad deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      updateAd(id, { is_active: value }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return (
      <MobileShell>
        <AppHeader title="Ads & Promotions" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </MobileShell>
    );
  }

  if (!isAdmin) {
    return (
      <MobileShell>
        <AppHeader title="Ads & Promotions" />
        <div className="p-6">
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            This page is for FIVESOM administrators only.
          </p>
        </div>
      </MobileShell>
    );
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadBannerMedia(file, file.name);
      setDraft((d) => (d ? { ...d, image_url: url } : d));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const list = ads.data ?? [];

  return (
    <MobileShell>
      <AppHeader title="Ads & Promotions" />
      <div className="space-y-6 px-4 py-4">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Admin dashboard
        </Link>

        {draft ? (
          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">{draft.id ? "Edit ad" : "New ad"}</h2>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Promote your gig on FIVESOM"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Short supporting line"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Image</Label>
              <Input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
              {uploading ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Placement</Label>
                <select
                  value={draft.placement}
                  onChange={(e) =>
                    setDraft({ ...draft, placement: e.target.value as AdPlacement })
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  {AD_PLACEMENTS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={draft.priority}
                  onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Button text</Label>
                <Input
                  value={draft.cta_text ?? ""}
                  onChange={(e) => setDraft({ ...draft, cta_text: e.target.value })}
                  placeholder="Learn more"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Link type</Label>
                <select
                  value={draft.link_type}
                  onChange={(e) => setDraft({ ...draft, link_type: e.target.value as AdLinkType })}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="none">No link</option>
                  <option value="internal">Internal app page</option>
                  <option value="external">External URL</option>
                </select>
              </div>
            </div>

            {draft.link_type !== "none" ? (
              <div className="space-y-1.5">
                <Label>{draft.link_type === "external" ? "URL" : "App path"}</Label>
                <Input
                  value={draft.link_url ?? ""}
                  onChange={(e) => setDraft({ ...draft, link_url: e.target.value })}
                  placeholder={draft.link_type === "external" ? "https://fivesom.net" : "/search"}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Starts</Label>
                <Input
                  type="datetime-local"
                  value={toLocal(draft.starts_at)}
                  onChange={(e) => setDraft({ ...draft, starts_at: toIso(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ends</Label>
                <Input
                  type="datetime-local"
                  value={toLocal(draft.ends_at)}
                  onChange={(e) => setDraft({ ...draft, ends_at: toIso(e.target.value) })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="text-sm">Published</Label>
              <Switch
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Live preview</p>
              <AdCard ad={draftToAd(draft)} preview />
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={save.isPending || uploading}
                onClick={() => save.mutate(draft)}
              >
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save ad"}
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </section>
        ) : (
          <Button className="w-full" onClick={() => setDraft({ ...EMPTY })}>
            <Plus className="mr-1 h-4 w-4" /> New ad
          </Button>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">All ads</h2>
          {ads.isLoading ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : ads.isError ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              Ads table not found. Run <code>supabase/sql/app_ads.sql</code> in your Supabase SQL
              editor to enable ads.
            </p>
          ) : list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No ads yet.
            </p>
          ) : (
            list.map((ad) => (
              <div key={ad.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
                <AdCard ad={ad} preview />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {AD_PLACEMENTS.find((p) => p.value === ad.placement)?.label ?? ad.placement}
                  </span>
                  <span>
                    {ad.impressions} views • {ad.clicks} clicks
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={ad.is_active}
                    onCheckedChange={(v) => toggle.mutate({ id: ad.id, value: v })}
                  />
                  <span className="text-xs text-muted-foreground">
                    {ad.is_active ? "Published" : "Hidden"}
                  </span>
                  <div className="ml-auto flex gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Edit ad"
                      onClick={() =>
                        setDraft({
                          id: ad.id,
                          title: ad.title,
                          description: ad.description,
                          image_url: ad.image_url,
                          cta_text: ad.cta_text,
                          link_type: ad.link_type,
                          link_url: ad.link_url,
                          placement: ad.placement,
                          is_active: ad.is_active,
                          priority: ad.priority,
                          starts_at: ad.starts_at,
                          ends_at: ad.ends_at,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      aria-label="Delete ad"
                      onClick={() => remove.mutate(ad.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </MobileShell>
  );
}
