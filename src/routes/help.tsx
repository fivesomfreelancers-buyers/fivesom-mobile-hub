import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, Mail, MessageSquare, Newspaper } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/app-header";
import { MobileShell } from "@/components/mobile-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center & Support — FIVESOM" },
      {
        name: "description",
        content: "Get answers about orders, payments and deliveries, or contact FIVESOM support.",
      },
      { property: "og:title", content: "Help Center — FIVESOM" },
      { property: "og:description", content: "Support for buyers and freelancers on FIVESOM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HelpPage,
});

const FAQS = [
  {
    q: "How do I place an order?",
    a: "Open a gig, pick Basic, Standard or Premium, submit your requirements and complete checkout. The order appears instantly under Orders.",
  },
  {
    q: "When is the freelancer paid?",
    a: "Funds are held until you accept the delivery. Once accepted, the amount is released to the freelancer's wallet.",
  },
  {
    q: "Can I request a revision?",
    a: "Yes — open the order, review the delivery and choose Request Revision within the revision count of your package.",
  },
  {
    q: "Is my FIVESOM website account the same here?",
    a: "Yes. The app uses the same accounts, gigs, orders and messages as the website — everything stays in sync.",
  },
];

const schema = z.object({
  subject: z.string().trim().min(3, "Subject is too short").max(120),
  message: z.string().trim().min(10, "Please describe your issue").max(2000),
});

function HelpPage() {
  const { user } = useSession();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ subject, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (!user) {
      toast.error("Please sign in to contact support");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user.id,
      subject: parsed.data.subject,
      message: parsed.data.message,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubject("");
    setMessage("");
    void qc.invalidateQueries({ queryKey: ["support-tickets"] });
    toast.success("Support ticket sent — we'll reply by email.");
  }

  return (
    <MobileShell>
      <AppHeader title="Help Center" />
      <div className="space-y-6 px-4 pt-4">
        <div className="rounded-2xl bg-accent-pink/10 p-5">
          <LifeBuoy className="h-6 w-6 text-accent-pink" />
          <h1 className="mt-2 text-lg font-bold">How can we help?</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Browse common questions, track your tickets or send our team a message.
          </p>
        </div>

        <section>
          <h2 className="mb-2 text-sm font-semibold">Frequently asked</h2>
          <Accordion
            type="single"
            collapsible
            className="rounded-xl border border-border bg-card px-3"
          >
            {FAQS.map((f) => (
              <AccordionItem key={f.q} value={f.q}>
                <AccordionTrigger className="text-left text-sm">{f.q}</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <TicketHistory />

        <section id="contact">
          <h2 className="mb-2 text-sm font-semibold">Contact support</h2>

          <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                placeholder="Order issue, payment, account…"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="Tell us what happened…"
                className="rounded-xl"
              />
            </div>
            <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
              <Mail className="h-4 w-4" />
              {busy ? "Sending…" : "Send message"}
            </Button>
            {!user ? (
              <p className="text-center text-xs text-muted-foreground">
                <Link to="/auth" className="font-medium text-primary">
                  Sign in
                </Link>{" "}
                to send a ticket.
              </p>
            ) : null}
          </form>
        </section>

        <section>
          <Link
            to="/messages"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Message a seller instead</p>
              <p className="text-xs text-muted-foreground">
                Order-specific questions belong in chat.
              </p>
            </div>
          </Link>
        </section>
      </div>
    </MobileShell>
  );
}

/** Real support tickets for the signed-in user, with their live status. */
function TicketHistory() {
  const { user } = useSession();
  const tickets = useQuery({
    queryKey: ["support-tickets", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, subject, message, status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        subject: string | null;
        message: string | null;
        status: string | null;
        created_at: string;
      }[];
    },
  });

  if (!user || (tickets.data ?? []).length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold">Your support requests</h2>
      <div className="space-y-2">
        {(tickets.data ?? []).map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                {t.subject ?? "Support request"}
              </p>
              <span className="shrink-0 rounded-full bg-accent-pink/15 px-2 py-0.5 text-[10px] font-semibold capitalize text-accent-pink">
                {(t.status ?? "open").replace("_", " ")}
              </span>
            </div>
            {t.message ? (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.message}</p>
            ) : null}
            <p className="mt-1 text-[10px] text-muted-foreground">
              Sent {timeAgo(t.created_at)} ago
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
