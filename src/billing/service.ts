import type Stripe from "stripe";
import { getStripe, getPriceId } from "@/billing/stripe.js";
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";

type Plan = "lite" | "pro" | "business";

export async function createCheckoutSession(
  tenantId: string,
  plan: Plan,
): Promise<{ checkoutUrl: string }> {
  const db = getPrisma();
  const stripe = getStripe();

  const subscription = await db.subscription.findUniqueOrThrow({ where: { tenantId } });

  // Reusar customer existente ou criar novo
  let customerId = subscription.stripeCustomerId ?? undefined;
  if (!customerId) {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const customer = await stripe.customers.create({ name: tenant.name, metadata: { tenantId } });
    customerId = customer.id;
    await db.subscription.update({
      where: { tenantId },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: getPriceId(plan), quantity: 1 }],
    success_url: `${process.env.APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.APP_URL}/billing/cancel`,
    metadata: { tenantId, plan },
    subscription_data: { metadata: { tenantId, plan } },
  });

  return { checkoutUrl: session.url! };
}

export async function createPortalSession(tenantId: string): Promise<{ portalUrl: string }> {
  const db = getPrisma();
  const stripe = getStripe();

  const subscription = await db.subscription.findUniqueOrThrow({ where: { tenantId } });
  if (!subscription.stripeCustomerId) {
    throw Object.assign(new Error("Nenhuma assinatura ativa para gerenciar"), { statusCode: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${process.env.APP_URL}/settings/billing`,
  });

  return { portalUrl: session.url };
}

export async function getSubscription(tenantId: string) {
  const db = getPrisma();
  return db.subscription.findUniqueOrThrow({
    where: { tenantId },
    select: {
      plan: true,
      mode: true,
      status: true,
      trialEndsAt: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });
}

// Stripe envia o plano como string; mapear para o enum do Prisma
function toPlan(stripePlan: string | null | undefined): Plan | null {
  if (!stripePlan) return null;
  const valid: Plan[] = ["lite", "pro", "business"];
  const found = valid.find((p) => stripePlan.toLowerCase().includes(p));
  return found ?? null;
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  const db = getPrisma();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const plan = toPlan(session.metadata?.plan);
      if (!tenantId || !plan) break;

      await db.subscription.update({
        where: { tenantId },
        data: {
          stripeSubscriptionId: session.subscription as string,
          plan,
          status: "active",
          currentPeriodStart: new Date(),
        },
      });
      logger.info({ tenantId, plan }, "Checkout concluído");
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = (invoice as { subscription_details?: { metadata?: { tenantId?: string } } })
        .subscription_details?.metadata?.tenantId;
      if (!tenantId) break;

      await db.subscription.update({
        where: { tenantId },
        data: {
          status: "active",
          currentPeriodStart: new Date((invoice.period_start ?? 0) * 1000),
          currentPeriodEnd: new Date((invoice.period_end ?? 0) * 1000),
        },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const tenantId = (invoice as { subscription_details?: { metadata?: { tenantId?: string } } })
        .subscription_details?.metadata?.tenantId;
      if (!tenantId) break;

      await db.subscription.update({ where: { tenantId }, data: { status: "past_due" } });
      logger.warn({ tenantId }, "Pagamento falhou");
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;

      const plan = toPlan(sub.metadata?.plan);
      await db.subscription.update({
        where: { tenantId },
        data: {
          ...(plan ? { plan } : {}),
          status: sub.status === "active" ? "active" : "past_due",
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;

      await db.subscription.update({
        where: { tenantId },
        data: { status: "canceled", canceledAt: new Date() },
      });
      logger.info({ tenantId }, "Assinatura cancelada");
      break;
    }

    default:
      // Eventos não mapeados são ignorados silenciosamente
      break;
  }
}
