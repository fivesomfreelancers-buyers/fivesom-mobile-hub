import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — FIVESOM" },
      { name: "description", content: "The terms that govern buying, selling and payments on the FIVESOM marketplace." },
      { property: "og:title", content: "Terms & Conditions — FIVESOM" },
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
      <article className="space-y-4 px-4 pb-8 pt-4 text-sm leading-relaxed text-muted-foreground">
        <h1 className="text-lg font-bold text-foreground">FIVESOM Terms & Conditions</h1>
        <section>
          <h2 className="font-semibold text-foreground">1. Accounts</h2>
          <p>
            Your FIVESOM app account is the same account you use on the FIVESOM website. You are
            responsible for keeping your credentials secure and for all activity on your account.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">2. Orders and payments</h2>
          <p>
            Payments are processed by Stripe. Funds for an order are held until the buyer accepts the
            delivery or the acceptance window closes, after which they are released to the
            freelancer's wallet minus platform fees.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">3. Deliveries and revisions</h2>
          <p>
            Freelancers must deliver within the agreed delivery time. Buyers may request the number of
            revisions included in the purchased package before accepting a delivery.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">4. Cancellations and disputes</h2>
          <p>
            Either party may raise a dispute from the order page. FIVESOM support reviews the order
            history, messages and deliverables before deciding an outcome.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">5. Prohibited conduct</h2>
          <p>
            Off-platform payments, fraudulent listings, harassment and infringing content are not
            permitted and may result in account suspension.
          </p>
        </section>
        <p className="pt-2 text-xs">
          Questions? Contact FIVESOM support from the Help Center.
        </p>
      </article>
    </MobileShell>
  );
}
