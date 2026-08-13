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
 * Starts a checkout. This creates NOTHING in the database — only a Stripe
 * PaymentIntent that carries the gig/buyer details in its metadata. If the
 * buyer cancels, closes the page or the card fails, no order ever exists and
 * the freelancer is never notified.
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

    const intent = await stripeRequest("/payment_intents", key, {
      amount: String(amountCents),
      currency: "usd",
      description: `${String(gig['title'] ?? "FIVESOM order")} — ${packageName}`.slice(0, 200),
      "automatic_payment_methods[enabled]": "true",
      "automatic_payment_methods[allow_redirects]": "never",
      "metadata[gig_id]": String(gig['id']),
      "metadata[buyer_id]": buyerId,
      "metadata[package_name]": packageName,
      ...(data.packageId ? { "metadata[package_id]": data.packageId } : {}),
      "metadata[price]": String(price),
    });

    return {
      paymentIntentId: String(intent['id']),
      clientSecret: String(intent['client_secret']),
      amount: total,
      packageName,
      price,
      fee: 1,
    };
  });

/**
 * Verifies the payment directly with Stripe and only then creates the order.
 * The client never supplies the status — only the intent id, which is checked
 * against Stripe and against the caller's own session.
 */
export const finalizeOrderPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        paymentIntentId: z.string().min(4),
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

    const intent = await stripeRequest(`/payment_intents/${data.paymentIntentId}`, key);
    const meta = (intent['metadata'] ?? {}) as { buyer_id?: string };
    if (meta.buyer_id !== auth.user.id) throw new Error("This payment belongs to another account.");
    if (String(intent['status']) !== "succeeded") return { paid: false, orderId: null };

    const { createPaidOrderFromIntent } = await import("@/lib/orders.server");
    const { orderId } = await createPaidOrderFromIntent(admin, intent);
    return { paid: true, orderId };
  });
