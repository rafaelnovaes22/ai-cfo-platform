/**
 * Promove o modo de subscription de um tenant no banco de produção.
 * Uso: npx tsx scripts/promote-tenant.ts <email|tenantId> [shadow|assisted|autonomous]
 *
 * Requer DATABASE_URL no ambiente apontando para o banco correto.
 * Para produção: conecte via Railway CLI antes de rodar.
 */
import { PrismaClient } from "@prisma/client";

const VALID_MODES = ["shadow", "assisted", "autonomous"] as const;
type Mode = (typeof VALID_MODES)[number];

const prisma = new PrismaClient();

async function main() {
  const [, , identifier, targetMode = "assisted"] = process.argv;

  if (!identifier) {
    console.error("Uso: npx tsx scripts/promote-tenant.ts <email|tenantId> [shadow|assisted|autonomous]");
    process.exit(1);
  }

  if (!VALID_MODES.includes(targetMode as Mode)) {
    console.error(`Modo inválido: ${targetMode}. Use: ${VALID_MODES.join(" | ")}`);
    process.exit(1);
  }

  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { id: identifier },
        { users: { some: { email: identifier } } },
      ],
    },
    include: { subscription: true },
  });

  if (!tenant) {
    console.error(`Tenant não encontrado: ${identifier}`);
    process.exit(1);
  }

  if (!tenant.subscription) {
    console.error(`Tenant "${tenant.name}" não tem subscription. Crie primeiro via /workspace/setup.`);
    process.exit(1);
  }

  const prev = tenant.subscription.mode;
  await prisma.subscription.update({
    where: { tenantId: tenant.id },
    data: { mode: targetMode as Mode },
  });

  console.log(`✓ Tenant "${tenant.name}" (${tenant.id})`);
  console.log(`  ${prev} → ${targetMode}`);
  console.log(`  Subscription ID: ${tenant.subscription.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
