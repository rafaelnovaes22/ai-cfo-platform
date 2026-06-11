// Critério único de "quem acessa o app web". Lead (plan student/trial) tem a
// conta criada — dados capturados — mas só assinante pago ativo entra no site.
// O WhatsApp (free tier, plan student) segue por outro fluxo e NÃO usa este gate.

/** Planos pagos que concedem acesso ao app web. student/trial = lead. */
export const SUBSCRIBER_PLANS = ["lite", "pro", "business"] as const;

export type SubscriberPlan = (typeof SUBSCRIBER_PLANS)[number];

/** Assinante = plano pago com assinatura ativa. Demais combinações = lead. */
export function isSubscriber(
  plan: string | null | undefined,
  status: string | null | undefined,
): boolean {
  return (
    plan != null &&
    (SUBSCRIBER_PLANS as readonly string[]).includes(plan) &&
    status === "active"
  );
}
