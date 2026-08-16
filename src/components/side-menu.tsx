import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Compass,
  Grid3x3,
  Heart,
  Home,
  LayoutGrid,
  ClipboardList,
  Image as ImageIcon,
  LogOut,
  Megaphone,
  MessageSquare,

  Menu,
  Settings,
  Shield,
  User,
  Wallet,
  FileText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsAdmin } from "@/hooks/use-admin";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

type MenuLink = {
  to: string;
  label: string;
  icon: LucideIcon;
  search?: Record<string, string>;
};

const COMMON_TOP: MenuLink[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Explore", icon: Compass },
  { to: "/search", label: "Categories", icon: Grid3x3, search: { view: "categories" } },
];

const BUYER_LINKS: MenuLink[] = [
  { to: "/orders", label: "My Orders", icon: ClipboardList },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/wallet", label: "Payments", icon: Wallet },
];

const FREELANCER_LINKS: MenuLink[] = [
  { to: "/gigs/manage", label: "My Gigs", icon: LayoutGrid },
  { to: "/orders", label: "Sales & Deliveries", icon: ClipboardList },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/wallet", label: "Earnings & Withdrawals", icon: Wallet },
];

const COMMON_BOTTOM: MenuLink[] = [
  { to: "/settings", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },

  { to: "/legal/terms", label: "Terms & Conditions", icon: FileText },
  { to: "/legal/privacy", label: "Privacy Policy", icon: Shield },
];

const ADMIN_LINKS: MenuLink[] = [
  { to: "/admin", label: "Admin Dashboard", icon: Shield },
  { to: "/admin/ads", label: "Ads & Promotions", icon: Megaphone },
  { to: "/admin/banners", label: "Home Banner Management", icon: ImageIcon },
];


export function SideMenu() {
  const [open, setOpen] = useState(false);
  const { user } = useSession();
  const { isFreelancer } = useRole();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const links: MenuLink[] = [
    ...COMMON_TOP,
    ...(isFreelancer ? FREELANCER_LINKS : BUYER_LINKS),
    ...(isAdmin ? ADMIN_LINKS : []),
    ...COMMON_BOTTOM,
  ];


  async function signOut() {
    setOpen(false);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger aria-label="Open menu" className="grid h-8 w-8 place-items-center rounded-lg">
        <Menu className="h-5 w-5 text-muted-foreground" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[85vw] max-w-xs overflow-y-auto p-0">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Logo className="h-9 w-9" />
          <div className="min-w-0">
            <p className="text-base font-bold tracking-tight">FIVESOM</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {user?.email ?? "Browsing as guest"}
            </p>
            {user ? (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                {isFreelancer ? "Freelancer account" : "Buyer account"}
              </p>
            ) : null}
          </div>
        </div>
        <nav className="flex flex-col py-2">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={`${l.to}-${l.label}`}
                to={l.to as never}
                {...(l.search ? { search: l.search as never } : {})}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Icon className="h-4.5 w-4.5 text-muted-foreground" />
                {l.label}

              </Link>
            );
          })}
          {user ? (
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-5 py-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-accent"
            >
              <LogOut className="h-4.5 w-4.5" />
              Logout
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-primary transition-colors hover:bg-accent"
            >
              <LogOut className="h-4.5 w-4.5" />
              Sign in
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
