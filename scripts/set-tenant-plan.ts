/**
 * Altera o plano da subscription de um tenant (por telefone WhatsApp ou e-mail).
 * Lê e imprime o plano atual ANTES de alterar, e imprime o comando de revert.
 *
 * Uso: npx tsx --env-file=.env scripts/set-tenant-plan.ts <whatsappPhone|email> <student|trial|lite|pro|business>
 * Requer DATABASE_URL apontando para o banco correto (cuidado: produção).
 */
import { PrismaClient, SubscriptionPlan } from "@prisma/client";

const VALID = ["student", "trial", "lite", "pro", "business"] as const;
const prisma = new PrismaClient();

async function main() {
  const [, , identifier, plan] = process.argv;
  if (!identifier || !plan || !VALID.includes(plan as (typeof VALID)[number])) {
    console.error(`Uso: npx tsx scripts/set-tenant-plan.ts <whatsappPhone|email> <${VALID.join("|")}>`);
    process.exit(1);
  }

  const candidates = identifier.startsWith("+") ? [identifier] : [`+${identifier}`, identifier];
  let tenant = await prisma.tenant.findFirst({
    where: { whatsappPhone: { in: candidates } },
    select: { id: true, name: true, whatsappPhone: true },
  });
  if (!tenant) {
    const user = await prisma.user.findUnique({ where: { email: identifier }, select: { tenantId: true } });
    if (user) {
      tenant = await prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, name: true, whatsappPhone: true },
      });
    }
  }
  if (!tenant) {
    console.error(`Tenant não encontrado para: ${identifier}`);
    process.exit(1);
  }

  const sub = await prisma.subscription.findUnique({
    where: { tenantId: tenant.id },
    select: { plan: true },
  });
  console.log(`Tenant: ${tenant.name} (${tenant.id}) | whatsappPhone: ${tenant.whatsappPhone}`);
  console.log(`Plano atual: ${sub?.plan ?? "(sem subscription)"}`);

  await prisma.subscription.update({
    where: { tenantId: tenant.id },
    data: { plan: plan as SubscriptionPlan },
  });
  console.log(`Plano alterado para: ${plan}`);
  console.log(`Reverter: npx tsx --env-file=.env scripts/set-tenant-plan.ts ${identifier} ${sub?.plan ?? "trial"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
