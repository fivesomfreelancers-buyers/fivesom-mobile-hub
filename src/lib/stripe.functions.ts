import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STRIPE_API = "https://api.stripe.com/v1";

async function stripeRequest(path: string, key: string, body?: Record<string, string>) {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    ...(body ? { body: new URLSearchParams(body).toString() } : {}),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json['error'] as { message?: string } | undefined;
    throw new Error(err?.message ?? "Stripe request failed");
  }
  return json;
}

/** Publishable key for Stripe Elements in the browser (safe to expose). */
export const getStripePublishableKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publishableKey: process.env['STRIPE_PUBLISHABLE_KEY'] ?? null };
});

/**
 * Starts a checkout: verifies the buyer's access token, creates the pending
 * order with the service role (the database blocks client-side card orders),
 * then returns a Stripe PaymentIntent client secret for Stripe Elements.
 */
export const startGigCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        gigId: z.string().uuid(),
        packageId: z.string().uuid().optional(),
        accessToken: z.string().min(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error("Stripe is not configured yet (STRIPE_SECRET_KEY missing).");

    const { getServiceRoleClient } = await import("@/integrations/supabase/client.server");
    const admin = getServiceRoleClient();

    const { data: auth, error: authError } = await admin.auth.getUser(data.accessToken);
    if (authError || !auth?.user) throw new Error("Please sign in again to continue.");
    const buyerId = auth.user.id;

    const { data: gig, error: gigError } = await admin
      .from("gigs")
      .select("id, title, freelancer_id, base_price")
      .eq("id", data.gigId)
      .maybeSingle();
    if (gigError) throw gigError;
    if (!gig) throw new Error("This gig is no longer available.");

    let packageName = "basic";
    let price = Number(gig['base_price'] ?? 0);
    if (data.packageId) {
      const { data: pkg } = await admin
        .from("gig_packages")
        .select("id, name, package_type, price")
        .eq("id", data.packageId)
        .eq("gig_id", data.gigId)
        .maybeSingle();
      if (pkg) {
        price = Number(pkg['price'] ?? price);
        packageName = String(pkg['name'] ?? pkg['package_type'] ?? "basic");
      }
    }

    // Buyer's flat service fee — the amount is always computed server-side.
    const total = Math.round((price + 1) * 100) / 100;
    const amountCents = Math.round(total * 100);
    if (amountCents < 50) throw new Error("Order amount is too low for card payment.");

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        gig_id: gig['id'],
        buyer_id: buyerId,
        freelancer_id: gig['freelancer_id'],
        amount: total,
        package_name: packageName,
        status: "pending",
        payment_method: "stripe",
        payment_status: "pending",
      })
      .select("id")
      .single();
    if (orderError) throw orderError;
    const orderId = String(order['id']);

    const intent = await stripeRequest("/payment_intents", key, {
      amount: String(amountCents),
      currency: "usd",
      description: `${String(gig['title'] ?? "FIVESOM order")} — ${packageName}`.slice(0, 200),
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
      "metadata[order_id]": orderId,
      "metadata[buyer_id]": buyerId,
    });

    await admin
      .from("orders")
      .update({ stripe_payment_intent_id: String(intent['id']) })
      .eq("id", orderId);

    return {
      orderId,
      clientSecret: String(intent['client_secret']),
      amount: total,
      packageName,
      price,
      fee: 1,
    };
  });


/** Creates (or reuses) a PaymentIntent for a pending order — used by Stripe Elements. */
export const createOrderPaymentIntent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ orderId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error("Stripe is not configured yet (STRIPE_SECRET_KEY missing).");

    const { getServiceRoleClient } = await import("@/integrations/supabase/client.server");
    const admin = getServiceRoleClient();

    const { data: order, error } = await admin
      .from("orders")
      .select("id, amount, package_name, payment_status, buyer_id, stripe_payment_intent_id, gigs(title)")
      .eq("id", data.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) throw new Error("Order not found");
    if (order['payment_status'] === "paid") throw new Error("This order is already paid");

    const amountCents = Math.round(Number(order['amount'] ?? 0) * 100);
    if (amountCents < 50) throw new Error("Order amount is too low for card payment");

    // Reuse an existing intent when it is still usable.
    const existingId = order['stripe_payment_intent_id'];
    if (typeof existingId === "string" && existingId.startsWith("pi_")) {
      const existing = await stripeRequest(`/payment_intents/${existingId}`, key);
      const status = String(existing['status']);
      if (
        Number(existing['amount']) === amountCents &&
        ["requires_payment_method", "requires_confirmation", "requires_action"].includes(status)
      ) {
        return { clientSecret: String(existing['client_secret']), amount: amountCents };
      }
    }

    const title =
      ((order['gigs'] as { title?: string } | null)?.title ?? "FIVESOM order") +
      (order['package_name'] ? ` — ${String(order['package_name'])}` : "");

    const intent = await stripeRequest("/payment_intents", key, {
      amount: String(amountCents),
      currency: "usd",
      description: title.slice(0, 200),
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
      "metadata[order_id]": String(order['id']),
      "metadata[buyer_id]": String(order['buyer_id'] ?? ""),
    });

    await admin
      .from("orders")
      .update({
        stripe_payment_intent_id: String(intent['id']),
        payment_method: "stripe",
        payment_status: "processing",
      })
      .eq("id", data.orderId);

    return { clientSecret: String(intent['client_secret']), amount: amountCents };
  });

/** Verifies payment server-side and marks the order paid. Never trust the client alone. */
export const confirmOrderPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        paymentIntentId: z.string().min(4).optional(),
        sessionId: z.string().min(4).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env['STRIPE_SECRET_KEY'];
    if (!key) throw new Error("Stripe is not configured yet (STRIPE_SECRET_KEY missing).");

    let paid = false;
    let intentId: string | null = null;
    let orderIdFromStripe: string | undefined;

    if (data.sessionId) {
      const session = await stripeRequest(`/checkout/sessions/${data.sessionId}`, key);
      paid = session['payment_status'] === "paid";
      orderIdFromStripe = (session['metadata'] as { order_id?: string } | null)?.order_id;
      intentId = typeof session['payment_intent'] === "string" ? session['payment_intent'] : null;
    } else if (data.paymentIntentId) {
      const intent = await stripeRequest(`/payment_intents/${data.paymentIntentId}`, key);
      paid = intent['status'] === "succeeded";
      orderIdFromStripe = (intent['metadata'] as { order_id?: string } | null)?.order_id;
      intentId = String(intent['id']);
    } else {
      throw new Error("Missing payment reference");
    }

    if (orderIdFromStripe !== data.orderId) throw new Error("Payment does not belong to this order");
    if (!paid) return { paid: false };

    const { getServiceRoleClient } = await import("@/integrations/supabase/client.server");
    const admin = getServiceRoleClient();
    await admin
      .from("orders")
      .update({
        payment_status: "paid",
        payment_method: "stripe",
        stripe_payment_intent_id: intentId,
      })
      .eq("id", data.orderId);

    return { paid: true };
  });
