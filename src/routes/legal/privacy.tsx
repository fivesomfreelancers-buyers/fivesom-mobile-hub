import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — FIVESOM" },
      { name: "description", content: "How FIVESOM collects, stores and protects your account, order and payment data." },
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
      <article className="space-y-4 px-4 pb-8 pt-4 text-sm leading-relaxed text-muted-foreground">
        <h1 className="text-lg font-bold text-foreground">FIVESOM Privacy Policy</h1>
        <section>
          <h2 className="font-semibold text-foreground">What we collect</h2>
          <p>
            Account details (name, email, profile photo), gig and order data, messages and
            attachments, and payment metadata returned by Stripe. Card details never touch FIVESOM
            servers.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">How we use it</h2>
          <p>
            To operate the marketplace: showing your profile and gigs, matching buyers with
            freelancers, delivering messages and notifications, processing payments and payouts, and
            preventing fraud.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Sharing</h2>
          <p>
            Your public profile, gigs and reviews are visible to other users. Private data is shared
            only with the counterpart of an order, and with processors such as Stripe where required
            to complete a payment.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Your controls</h2>
          <p>
            You can edit your profile, change your password, and request account deletion from
            Settings. Deleting your account removes your profile and gigs; order records may be kept
            where required for accounting and dispute resolution.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-foreground">Security</h2>
          <p>
            Data is stored in FIVESOM's Supabase project with row-level security so users can only
            read the records they are entitled to. Files are stored in access-controlled buckets.
          </p>
        </section>
      </article>
    </MobileShell>
  );
}
