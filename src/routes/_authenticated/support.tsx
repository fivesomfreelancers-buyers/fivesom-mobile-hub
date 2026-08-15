import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import { SystemChannel } from "@/components/system-channel";
import { useSession } from "@/hooks/use-session";
import { systemChannelIdQuery } from "@/lib/messaging";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "FIVESOM Support" },
      {
        name: "description",
        content: "Chat directly with the FIVESOM support team about orders, payments and your account.",
      },
      { property: "og:title", content: "FIVESOM Support" },
      { property: "og:description", content: "Official FIVESOM support channel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const { user } = useSession();
  const channel = useQuery(systemChannelIdQuery(user?.id, "support"));

  if (channel.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!channel.data) {
    return (
      <MobileShell>
        <AppHeader title="FIVESOM Support" />
        <div className="space-y-3 px-4 pt-6 text-sm text-muted-foreground">
          <p>The support chat is not available for your account yet.</p>
          <Link to="/help" className="inline-block font-semibold text-primary">
            Open the Help Center to send a ticket →
          </Link>
        </div>
      </MobileShell>
    );
  }

  return <SystemChannel channelId={channel.data} fallbackType="support" />;
}
