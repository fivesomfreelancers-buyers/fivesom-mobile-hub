import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SERVER ONLY. Single place where a paid order row is created.
 *
 * An order NEVER exists before Stripe confirms the payment. Both the
 * client-side confirmation call and the Stripe webhook funnel through this
 * helper, and both are idempotent: the PaymentIntent id is the natural key, so
 * refreshes, retries and duplicate webhook deliveries can never fan out into
 * multiple freelancer-visible orders.
 */

export type IntentMetadata = {
  gig_id?: string;
  buyer_id?: string;
  package_id?: string;
  package_name?: string;
  price?: string;
};

export async function findOrderByIntent(admin: SupabaseClient, intentId: string) {
  const { data } = await admin
    .from("orders")
    .select("id, payment_status, buyer_id")
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();
  return data ?? null;
}

/** Creates (or returns the existing) paid order for a succeeded PaymentIntent. */
export async function createPaidOrderFromIntent(
  admin: SupabaseClient,
  intent: Record<string, unknown>,
): Promise<{ orderId: string; created: boolean }> {
  const intentId = String(intent['id']);
  if (String(intent['status']) !== "succeeded") {
    throw new Error("Payment has not succeeded.");
  }

  const existing = await findOrderByIntent(admin, intentId);
  if (existing) {
    if (existing['payment_status'] !== "paid") {
      await admin.from("orders").update({ payment_status: "paid" }).eq("id", existing['id']);
    }
    return { orderId: String(existing['id']), created: false };
  }

  const meta = (intent['metadata'] ?? {}) as IntentMetadata;
  if (!meta.gig_id || !meta.buyer_id) throw new Error("Payment is missing order details.");

  const { data: gig, error: gigError } = await admin
    .from("gigs")
    .select("id, freelancer_id")
    .eq("id", meta.gig_id)
    .maybeSingle();
  if (gigError) throw gigError;
  if (!gig) throw new Error("This gig is no longer available.");

  const amount = Math.round(Number(intent['amount_received'] ?? intent['amount'] ?? 0)) / 100;

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      gig_id: gig['id'],
      buyer_id: meta.buyer_id,
      freelancer_id: gig['freelancer_id'],
      amount,
      package_name: meta.package_name ?? "basic",
      status: "pending",
      payment_method: "stripe",
      payment_status: "paid",
      stripe_payment_intent_id: intentId,
    })
    .select("id")
    .single();

  if (error) {
    // Lost a race with the webhook (or vice versa) — reuse the row that won.
    const raced = await findOrderByIntent(admin, intentId);
    if (raced) return { orderId: String(raced['id']), created: false };
    throw error;
  }

  return { orderId: String(order['id']), created: true };
}
