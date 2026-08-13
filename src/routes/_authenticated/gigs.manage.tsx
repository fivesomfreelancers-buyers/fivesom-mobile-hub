import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, LayoutGrid, Pause, Play, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/hooks/use-role";
import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/fivesom";

export const Route = createFileRoute("/_authenticated/gigs/manage")({
  head: () => ({
    meta: [
      { title: "Manage Your Gigs — FIVESOM" },
      {
        name: "description",
        content: "Pause, activate and review the performance of every gig you sell on FIVESOM.",
      },
      { property: "og:title", content: "Manage Your Gigs — FIVESOM" },
      { property: "og:description", content: "Freelancer gig management on the FIVESOM app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ManageGigsPage,
});

type ManagedGig = {
  id: string;
  title: string;
  base_price: number;
  status: string | null;
  thumbnail_url: string | null;
  images: string[] | null;
};

function ManageGigsPage() {
  const { freelancerId, isFreelancer, loading } = useRole();
  const qc = useQueryClient();

  const gigs = useQuery({
    queryKey: ["my-gigs", freelancerId],
    enabled: !!freelancerId,
    queryFn: async (): Promise<ManagedGig[]> => {
      const { data, error } = await supabase
        .from("gigs")
        .select("id, title, base_price, status, thumbnail_url, images")
        .eq("freelancer_id", freelancerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ManagedGig[];
    },
  });

  const gigIds = (gigs.data ?? []).map((g) => g.id);

  /** Real order + review counts per gig, straight from the shared database. */
  const stats = useQuery({
    queryKey: ["my-gig-stats", gigIds.slice().sort()],
    enabled: gigIds.length > 0,
    queryFn: async () => {
      const [{ data: orders }, { data: reviews }] = await Promise.all([
        supabase.from("orders").select("gig_id, status, amount").in("gig_id", gigIds),
        supabase.from("public_gig_reviews").select("gig_id, rating").in("gig_id", gigIds),
      ]);
      const map = new Map<string, { orders: number; earned: number; rating: number | null }>();
      for (const id of gigIds) map.set(id, { orders: 0, earned: 0, rating: null });
      for (const o of orders ?? []) {
        const row = map.get(o.gig_id as string);
        if (!row) continue;
        row.orders += 1;
        if (o.status === "completed") row.earned += Number(o.amount ?? 0);
      }
      const byGig = new Map<string, number[]>();
      for (const r of reviews ?? []) {
        const list = byGig.get(r.gig_id as string) ?? [];
        list.push(Number(r.rating ?? 0));
        byGig.set(r.gig_id as string, list);
      }
      for (const [id, list] of byGig) {
        const row = map.get(id);
        if (row && list.length) row.rating = list.reduce((a, b) => a + b, 0) / list.length;
      }
      return map;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("gigs")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gig updated — the change is live on the website too.");
      void qc.invalidateQueries({ queryKey: ["my-gigs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gigs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gig deleted.");
      void qc.invalidateQueries({ queryKey: ["my-gigs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!loading && !isFreelancer) {
    return (
      <MobileShell>
        <AppHeader title="My Gigs" />
        <div className="p-6 text-center">
          <LayoutGrid className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">This area is for freelancers</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a freelancer profile on the FIVESOM website to start selling.
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link to="/">Browse services</Link>
          </Button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <AppHeader title="My Gigs" />
      <div className="space-y-3 p-4">
        {gigs.isLoading || loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (gigs.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center">
            <LayoutGrid className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">No gigs yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Gigs you publish on the FIVESOM website appear here automatically.
            </p>
          </div>
        ) : (
          (gigs.data ?? []).map((g) => {
            const s = stats.data?.get(g.id);
            const paused = g.status !== "active";
            return (
              <div key={g.id} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex gap-3 p-3">
                  <img
                    src={g.thumbnail_url ?? g.images?.[0] ?? ""}
                    alt={g.title}
                    loading="lazy"
                    className="h-16 w-20 shrink-0 rounded-lg bg-muted object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold">{g.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold capitalize ${
                          paused ? "bg-muted" : "bg-success/15 text-success"
                        }`}
                      >
                        {g.status ?? "draft"}
                      </span>
                      <span className="font-semibold text-foreground">{money(g.base_price)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border px-3 py-2 text-center text-[11px]">
                  <div>
                    <p className="text-sm font-bold">{s?.orders ?? 0}</p>
                    <p className="text-muted-foreground">Orders</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold">{money(s?.earned ?? 0)}</p>
                    <p className="text-muted-foreground">Earned</p>
                  </div>
                  <div>
                    <p className="flex items-center justify-center gap-1 text-sm font-bold">
                      <Star className="h-3 w-3 fill-warning text-warning" />
                      {s?.rating ? s.rating.toFixed(1) : "—"}
                    </p>
                    <p className="text-muted-foreground">Rating</p>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-border p-3">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to="/gigs/$gigId" params={{ gigId: g.id }}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> View
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={setStatus.isPending}
                    onClick={() =>
                      setStatus.mutate({ id: g.id, status: paused ? "active" : "paused" })
                    }
                  >
                    {paused ? (
                      <>
                        <Play className="mr-1 h-3.5 w-3.5" /> Activate
                      </>
                    ) : (
                      <>
                        <Pause className="mr-1 h-3.5 w-3.5" /> Pause
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm("Delete this gig permanently?")) remove.mutate(g.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </MobileShell>
  );
}
