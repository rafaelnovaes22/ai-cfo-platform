// Remove os tenants de load test (cascade apaga users/subscriptions/lançamentos/análises).
// Uso: tsx --env-file=.env scripts/loadtest-clean.mjs [--confirm]
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL, log: ["error"] });
const confirm = process.argv.includes("--confirm");

async function main() {
  if (/ballast\.proxy/.test(process.env.DATABASE_URL ?? "")) throw new Error("ABORTADO: aponta para PRODUÇÃO.");
  const users = await prisma.user.findMany({ where: { email: { startsWith: "loadtest+", mode: "insensitive" } }, select: { tenantId: true, email: true } });
  const tenantIds = [...new Set(users.map((u) => u.tenantId))];
  console.log(`${tenantIds.length} tenants de load test (${users.length} users).`);
  if (!confirm) { console.log("[DRY-RUN] rode com --confirm para apagar."); return; }
  const r = await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  console.log(`✔ ${r.count} tenants removidos (cascade).`);
}
main().catch((e) => { console.error("Falha:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
