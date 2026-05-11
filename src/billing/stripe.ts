import Stripe from "stripe";

let _client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY não configurada");
    _client = new Stripe(key, { apiVersion: "2025-01-27.acacia" });
  }
  return _client;
}

// Price IDs em env vars — nunca hardcode por plano no código (C8)
export function getPriceId(plan: "lite" | "pro" | "business"): string {
  const map: Record<string, string | undefined> = {
    lite:     process.env.STRIPE_PRICE_LITE,
    pro:      process.env.STRIPE_PRICE_PRO,
    business: process.env.STRIPE_PRICE_BUSINESS,
  };
  const id = map[plan];
  if (!id) throw new Error(`STRIPE_PRICE_${plan.toUpperCase()} não configurada`);
  return id;
}
