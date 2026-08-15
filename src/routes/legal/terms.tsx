import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { LegalDoc } from "@/components/legal-doc";
import { MobileShell } from "@/components/mobile-shell";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — FIVESOM" },
      {
        name: "description",
        content:
          "The official rules governing use of the FIVESOM freelance marketplace — payments, escrow, orders, disputes and conduct.",
      },
      { property: "og:title", content: "Terms of Service — FIVESOM" },
      { property: "og:description", content: "FIVESOM marketplace terms for buyers and freelancers." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <MobileShell>
      <AppHeader title="Terms & Conditions" />
      <LegalDoc doc="terms" />
    </MobileShell>
  );
}
