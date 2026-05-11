import { z } from "zod";

export const CheckoutBody = z.object({
  plan: z.enum(["lite", "pro", "business"]),
});

export const CheckoutResponse = z.object({
  checkoutUrl: z.string().url(),
});

export const PortalResponse = z.object({
  portalUrl: z.string().url(),
});

export const SubscriptionResponse = z.object({
  plan: z.string(),
  mode: z.string(),
  status: z.string(),
  trialEndsAt: z.string().nullable(),
  currentPeriodStart: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
});
