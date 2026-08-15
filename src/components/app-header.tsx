import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { Logo } from "@/components/logo";
import { SideMenu } from "@/components/side-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/use-session";
import { initials } from "@/lib/fivesom";

export function AppHeader({ title }: { title?: string }) {
  const { data: profile } = useProfile();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="flex items-center gap-2">
        <SideMenu />
        {title ? (
          <h1 className="text-lg font-semibold">{title}</h1>
        ) : (
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">FIVESOM</span>
          </Link>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link to="/notifications" aria-label="Notifications" className="grid h-8 w-8 place-items-center rounded-lg">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </Link>
        <Link to="/settings" aria-label="Your profile">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.profile_image_url ?? undefined} alt="" />
            <AvatarFallback className="text-xs">{initials(profile?.full_name)}</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </header>
  );
}
