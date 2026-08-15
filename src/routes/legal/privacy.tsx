import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { LegalDoc } from "@/components/legal-doc";
import { MobileShell } from "@/components/mobile-shell";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — FIVESOM" },
      {
        name: "description",
        content:
          "What data FIVESOM collects, why we collect it, how it is secured, and the rights you have over it.",
      },
      { property: "og:title", content: "Privacy Policy — FIVESOM" },
      { property: "og:description", content: "Your data and privacy on the FIVESOM marketplace." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <MobileShell>
      <AppHeader title="Privacy Policy" />
      <LegalDoc doc="privacy" />
    </MobileShell>
  );
}
