import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  MessageSquare,
  ClipboardList,
  Settings,
  Wallet,
  LayoutGrid,
} from "lucide-react";

import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";

const BUYER_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/messages", label: "Message", icon: MessageSquare },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const FREELANCER_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/gigs/manage", label: "My Gigs", icon: LayoutGrid },
  { to: "/orders", label: "Sales", icon: ClipboardList },
  { to: "/messages", label: "Message", icon: MessageSquare },
  { to: "/wallet", label: "Earnings", icon: Wallet },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isFreelancer } = useRole();
  const items = isFreelancer ? FREELANCER_ITEMS : BUYER_ITEMS;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "fill-primary/15")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function MobileShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className={cn("mx-auto max-w-md pb-24", className)}>{children}</div>
      <BottomNav />
    </div>
  );
}
