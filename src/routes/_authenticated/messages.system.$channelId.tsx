import { createFileRoute } from "@tanstack/react-router";

import { SystemChannel } from "@/components/system-channel";

export const Route = createFileRoute("/_authenticated/messages/system/$channelId")({
  head: () => ({
    meta: [
      { title: "FIVESOM Support & News" },
      {
        name: "description",
        content: "Official FIVESOM Support and News channel — announcements, updates and help.",
      },
      { property: "og:title", content: "FIVESOM Support & News" },
      { property: "og:description", content: "Official FIVESOM announcements and support." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SystemChannelPage,
});

function SystemChannelPage() {
  const { channelId } = Route.useParams();
  return <SystemChannel channelId={channelId} />;
}
