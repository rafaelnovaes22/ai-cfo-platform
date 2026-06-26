// Load test — semeia N tenants ISOLADOS no banco (cada um = 1 "usuária" distinta,
// para não consolidar uploads no mesmo tenant). Cada tenant: business/active + 1
// user admin com senha conhecida. Idempotente por email.
//
// Uso: tsx --env-file=.env scripts/loadtest-seed.mjs --count=10 [--password=LoadTest@2026]
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const arg = (n, d) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d; };
const COUNT = Number(arg("count", "10"));
const PASSWORD = arg("password", "LoadTest@2026");
const PREFIX = "loadtest";

const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL, log: ["error"] });

async function main() {
  const host = (process.env.DATABASE_URL ?? "").replace(/:\/\/[^@]*@/, "://***@").replace(/\?.*/, "");
  console.log(`Semeando ${COUNT} tenants em ${host}`);
  if (/ballast\.proxy/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("ABORTADO: DATABASE_URL aponta para PRODUÇÃO (ballast). Use staging.");
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const emails = [];
  for (let i = 1; i <= COUNT; i++) {
    const email = `${PREFIX}+${i}@acme.test`;
    emails.push(email);
    const existing = await prisma.user.findUnique({ where: { email }, select: { tenantId: true } });
    if (existing) {
      await prisma.user.update({ where: { email }, data: { passwordHash } });
      await prisma.subscription.update({ where: { tenantId: existing.tenantId }, data: { plan: "business", status: "active" } }).catch(() => {});
      continue;
    }
    const tenant = await prisma.tenant.create({ data: { name: `LoadTest ${i}` } });
    await prisma.user.create({ data: { tenantId: tenant.id, email, passwordHash, name: `LoadTest ${i}`, role: "admin", emailVerified: true } });
    await prisma.subscription.create({ data: { tenantId: tenant.id, plan: "business", mode: "assisted", status: "active" } });
  }
  console.log(`✔ ${COUNT} tenants prontos. Senha: ${PASSWORD}`);
  console.log(`Emails: ${PREFIX}+1@acme.test .. ${PREFIX}+${COUNT}@acme.test`);
}
main().catch((e) => { console.error("Falha:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
