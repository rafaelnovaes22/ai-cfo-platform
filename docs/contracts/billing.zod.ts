import { z } from "zod";

export const CheckoutBody = z.object({
  plan: z.enum(["lite", "pro", "business"]),
});
export type CheckoutBody = z.infer<typeof CheckoutBody>;

export const CheckoutResponse = z.object({
  checkoutUrl: z.string().url(),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponse>;

export const PortalResponse = z.object({
  portalUrl: z.string().url(),
});
export type PortalResponse = z.infer<typeof PortalResponse>;

export const SubscriptionResponse = z.object({
  plan: z.string(),
  mode: z.string(),
  status: z.string(),
  trialEndsAt: z.string().nullable(),
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
});
export type SubscriptionResponse = z.infer<typeof SubscriptionResponse>;
