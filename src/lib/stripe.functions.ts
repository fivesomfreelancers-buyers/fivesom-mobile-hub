import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STRIPE_API = "https://api.stripe.com/v1";

function form(params: Record<string, string>) {
  return new URLSearchParams(params).toString();
}

async function stripeRequest(path: string, key: string, body?: Record<string, string>) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(body ? { body: form(body) } : {}),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json['error'] as { message?: string } | undefined;
    throw new Error(err?.message ?? "Stripe request failed");
  }
  return json;
}

/** Creates a Stripe Checkout Session for an existing pending order. */
export const createOrderCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ orderId: z.string().uuid(), origin: z.string().url() }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error("Stripe is not configured yet (STRIPE_SECRET_KEY missing).");

    const { getServiceRoleClient } = await import("@/integrations/supabase/client.server");
    const admin = getServiceRoleClient();

    const { data: order, error } = await admin
      .from("orders")
      .select("id, amount, package_name, payment_status, gig_id, gigs(title)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Order not found");
    if (order['payment_status'] === "paid") throw new Error("This order is already paid");

    const title =
      ((order['gigs'] as { title?: string } | null)?.title ?? "FIVESOM order") +
      (order['package_name'] ? ` — ${String(order['package_name'])}` : "");
    const amountCents = Math.round(Number(order['amount'] ?? 0) * 100);
    if (amountCents < 50) throw new Error("Order amount is too low for card payment");

    const session = await stripeRequest("/checkout/sessions", key, {
      mode: "payment",
      "payment_method_types[0]": "card",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(amountCents),
      "line_items[0][price_data][product_data][name]": title.slice(0, 120),
      "metadata[order_id]": String(order['id']),
      client_reference_id: String(order['id']),
      success_url: `${data.origin}/orders/${data.orderId}/requirements?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${data.origin}/orders/${data.orderId}?payment=cancelled`,
    });

    await admin
      .from("orders")
      .update({ stripe_session_id: String(session['id']) })
      .eq("id", data.orderId);

    return { url: String(session['url']) };
  });

/** Confirms a Checkout Session and marks the order paid. */
export const confirmOrderPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ orderId: z.string().uuid(), sessionId: z.string().min(4) }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error("Stripe is not configured yet (STRIPE_SECRET_KEY missing).");

    const session = await stripeRequest(`/checkout/sessions/${data.sessionId}`, key);
    const paid = session['payment_status'] === "paid";
    const orderId = (session['metadata'] as { order_id?: string } | null)?.order_id;
    if (orderId !== data.orderId) throw new Error("Session does not belong to this order");
    if (!paid) return { paid: false };

    const { getServiceRoleClient } = await import("@/integrations/supabase/client.server");
    const admin = getServiceRoleClient();
    await admin
      .from("orders")
      .update({
        payment_status: "paid",
        payment_method: "stripe",
        stripe_payment_intent_id:
          typeof session['payment_intent'] === "string" ? session['payment_intent'] : null,
      })
      .eq("id", data.orderId);

    return { paid: true };
  });
