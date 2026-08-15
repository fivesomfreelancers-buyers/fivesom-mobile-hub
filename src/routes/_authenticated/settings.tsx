import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  CreditCard,
  LogOut,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFreelancer, useProfile, useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { uploadAvatar } from "@/lib/avatar";
import { initials, money } from "@/lib/fivesom";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Profile — FIVESOM" },
      {
        name: "description",
        content: "Update your FIVESOM profile, review earnings and manage your account settings.",
      },
      { property: "og:title", content: "Settings & Profile — FIVESOM" },
      { property: "og:description", content: "Manage your FIVESOM account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const profile = useProfile();
  const freelancer = useFreelancer();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", professional_title: "", location: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onPickPhoto(file: File | undefined): Promise<void> {
    if (!file || !user) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadAvatar(user.id, file);
      const { error } = await supabase
        .from("profiles")
        .update({ profile_image_url: url })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Profile photo updated");
      void qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload photo");
    } finally {
      setUploadingPhoto(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }


  useEffect(() => {
    if (profile.data) {
      setForm({
        full_name: profile.data.full_name ?? "",
        professional_title: profile.data.professional_title ?? "",
        location: profile.data.location ?? "",
        bio: profile.data.bio ?? "",
      });
    }
  }, [profile.data]);

  const wallet = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { balance: number } | null;
    },
  });

  const orderStats = useQuery({
    queryKey: ["order-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status, amount, buyer_id")
        .eq("buyer_id", user!.id);
      if (error) throw error;
      const rows = data ?? [];
      return {
        active: rows.filter((r) => ["pending", "in_progress", "delivered"].includes(r.status ?? ""))
          .length,
        completed: rows.filter((r) => r.status === "completed").length,
        spent: rows
          .filter((r) => r.status === "completed")
          .reduce((s, r) => s + Number(r.amount ?? 0), 0),
      };
    },
  });

  async function save(): Promise<void> {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    setEditing(false);
    void qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function signOut(): Promise<void> {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isFreelancer = !!freelancer.data;

  return (
    <MobileShell>
      <AppHeader title="Settings" />
      <div className="space-y-5 p-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  src={profile.data?.profile_image_url ?? undefined}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <AvatarFallback>{initials(profile.data?.full_name)}</AvatarFallback>
              </Avatar>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPickPhoto(e.target.files?.[0])}
              />
              <button
                type="button"
                aria-label="Change profile photo"
                disabled={uploadingPhoto}
                onClick={() => fileInput.current?.click()}
                className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground"
              >
                {uploadingPhoto ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-base font-semibold">
                {profile.data?.full_name ?? "Your name"}
                {freelancer.data?.has_blue_tick ? (
                  <BadgeCheck className="h-4 w-4 text-primary" />
                ) : null}
              </p>
              <p className="text-xs font-medium capitalize text-primary">
                {profile.data?.role ?? (isFreelancer ? "freelancer" : "buyer")}
              </p>
              <p className="truncate text-xs text-muted-foreground">{profile.data?.email ?? user?.email}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Active Orders" value={String(orderStats.data?.active ?? 0)} />
            <Stat
              label={isFreelancer ? "Earnings" : "Total Spent"}
              value={money(
                isFreelancer
                  ? Number(wallet.data?.balance ?? freelancer.data?.total_earnings ?? 0)
                  : (orderStats.data?.spent ?? 0),
              )}
            />
            <Stat
              label="Completed"
              value={String(
                isFreelancer
                  ? (freelancer.data?.completed_orders ?? 0)
                  : (orderStats.data?.completed ?? 0),
              )}
            />
          </div>
        </div>

        {editing ? (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Edit Profile</p>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Professional Title</Label>
              <Input
                id="title"
                value={form.professional_title}
                onChange={(e) => setForm({ ...form, professional_title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={4}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" disabled={saving} onClick={save}>
                Save
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <p className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Account
            </p>
            <Row
              icon={User}
              title="Edit Profile"
              subtitle="Update your personal information"
              onClick={() => setEditing(true)}
            />
            <Row
              icon={ShieldCheck}
              title="Account Verification"
              subtitle="Verify your identity"
              trailing={freelancer.data?.is_verified ? "Verified" : "Not verified"}
            />
            <Row
              icon={Wallet}
              title={isFreelancer ? "Earnings" : "Wallet"}
              subtitle="Balance and payouts"
              trailing={money(Number(wallet.data?.balance ?? 0))}
            />
            <Row icon={CreditCard} title="Payment Methods" subtitle="Manage your payment methods" />
            <Row icon={Bell} title="Notifications" subtitle="Manage notification preferences" />
          </div>
        )}

        <Button variant="outline" className="w-full text-destructive" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>
    </MobileShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-2.5">
      <p className="text-sm font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  trailing?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left last:border-b-0"
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle ? (
          <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{trailing}</span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
