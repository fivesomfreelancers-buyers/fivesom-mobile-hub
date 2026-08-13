import { createFileRoute } from "@tanstack/react-router";

/**
 * Stripe webhook — the source of truth for payment status.
 * Configure it in Stripe → Developers → Webhooks with events:
 * payment_intent.succeeded, payment_intent.payment_failed,
 * charge.refunded, checkout.session.completed.
 */

function hexToBytes(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function verifySignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim() ?? "", v ?? ""];
    }),
  ) as { t?: string; v1?: string };
  if (!parts.t || !parts.v1) return false;

  // Reject events older than 5 minutes (replay protection).
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    hexToBytes(parts.v1),
    new TextEncoder().encode(`${parts.t}.${payload}`),
  );
}

export const Route = createFileRoute("/api/public/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['STRIPE_WEBHOOK_SECRET'];
        if (!secret) return new Response("Webhook not configured", { status: 500 });

        const signature = request.headers.get("stripe-signature");
        const body = await request.text();
        if (!signature || !(await verifySignature(body, signature, secret))) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as {
          type: string;
          data: { object: Record<string, unknown> };
        };
        const object = event.data.object;

        const statusByEvent: Record<string, string> = {
          "payment_intent.succeeded": "paid",
          "payment_intent.processing": "processing",
          "payment_intent.payment_failed": "failed",
          "payment_intent.canceled": "cancelled",
          "charge.refunded": "refunded",
        };
        const paymentStatus = statusByEvent[event.type];
        if (!paymentStatus) return new Response("ok (ignored)", { status: 200 });

        const intentId =
          typeof object['payment_intent'] === "string"
            ? object['payment_intent']
            : typeof object['id'] === "string" && String(object['id']).startsWith("pi_")
              ? String(object['id'])
              : null;
        if (!intentId) return new Response("ok (no intent)", { status: 200 });

        const { getServiceRoleClient } = await import("@/integrations/supabase/client.server");
        const admin = getServiceRoleClient();
        const { createPaidOrderFromIntent, findOrderByIntent } = await import("@/lib/orders.server");

        // Only a genuinely succeeded payment may bring an order into existence.
        if (paymentStatus === "paid") {
          const intent = String(object['id']).startsWith("pi_")
            ? object
            : { ...object, id: intentId, status: "succeeded" };
          await createPaidOrderFromIntent(admin, { ...intent, status: "succeeded" });
          return new Response("ok", { status: 200 });
        }

        // Failed / cancelled / processing / refunded: never create anything.
        const current = await findOrderByIntent(admin, intentId);
        if (!current) return new Response("ok (no order)", { status: 200 });
        const currentStatus = (current['payment_status'] as string | undefined) ?? null;
        if (currentStatus === paymentStatus) return new Response("ok (duplicate)", { status: 200 });
        if (currentStatus === "paid" && paymentStatus !== "refunded") {
          return new Response("ok (already settled)", { status: 200 });
        }

        await admin
          .from("orders")
          .update({
            payment_status: paymentStatus,
            ...(paymentStatus === "refunded" ? { status: "cancelled" } : {}),
          })
          .eq("id", current['id']);

        return new Response("ok", { status: 200 });

      },
    },
  },
});
