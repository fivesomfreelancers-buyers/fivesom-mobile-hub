import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Compass,
  Grid3x3,
  Heart,
  HelpCircle,
  Home,
  LifeBuoy,
  ClipboardList,
  LogOut,
  MessageSquare,
  Menu,
  Settings,
  Shield,
  User,
  Wallet,
  FileText,
} from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/logo";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

const LINKS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Explore", icon: Compass },
  { to: "/search", label: "Categories", icon: Grid3x3, search: { view: "categories" } },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/settings", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help Center", icon: HelpCircle },
  { to: "/help", label: "Contact Support", icon: LifeBuoy, search: { section: "contact" } },
  { to: "/legal/terms", label: "Terms & Conditions", icon: FileText },
  { to: "/legal/privacy", label: "Privacy Policy", icon: Shield },
] as const;

export function SideMenu() {
  const [open, setOpen] = useState(false);
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

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
          <div>
            <p className="text-base font-bold tracking-tight">FIVESOM</p>
            <p className="text-[11px] text-muted-foreground">
              {user?.email ?? "Browsing as guest"}
            </p>
          </div>
        </div>
        <nav className="flex flex-col py-2">
          {LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={`${l.to}-${l.label}`}
                to={l.to}
                {...("search" in l ? { search: l.search as never } : {})}
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
