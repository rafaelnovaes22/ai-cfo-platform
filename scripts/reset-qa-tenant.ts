// Reset de tenant de QA — limpa SÓ análises e lançamentos (MonthlyAnalysis +
// LedgerEntry; NarrativeCard/ActionPlanItem somem em cascade). PRESERVA tenant,
// usuários, subscription, memória e métricas.
//
// Uso (dry-run por padrão — NÃO apaga sem --confirm):
//   tsx --env-file=.env scripts/reset-qa-tenant.ts --email=qa@example.com
//   tsx --env-file=.env scripts/reset-qa-tenant.ts --email=qa@example.com --confirm
//   tsx --env-file=.env scripts/reset-qa-tenant.ts --tenant=<uuid> --confirm
//
// Conexão: RESET_DATABASE_URL > DATABASE_URL (precisa ser uma URL com ESCRITA —
// a role de auditoria read-only não serve). Recusa rodar se apontar para a role
// somente-leitura (AUDIT_DATABASE_URL).

import { PrismaClient } from "@prisma/client";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const email = arg("email");
const tenantArg = arg("tenant");
const confirm = process.argv.includes("--confirm");

if (!email && !tenantArg) {
  console.error("Informe --email=<user> ou --tenant=<uuid>. (dry-run sem --confirm)");
  process.exit(1);
}

const url = process.env.RESET_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("ERRO: defina RESET_DATABASE_URL ou DATABASE_URL (conexão com ESCRITA).");
  process.exit(1);
}
if (process.env.AUDIT_DATABASE_URL && url === process.env.AUDIT_DATABASE_URL) {
  console.error("ERRO: a URL aponta para a role de auditoria (read-only). Use uma conexão com escrita.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url, log: ["error"] });

async function resolveTenantId(): Promise<string> {
  if (tenantArg) return tenantArg;
  const users = await prisma.user.findMany({
    where: { email },
    select: { tenantId: true },
  });
  const tenantIds = [...new Set(users.map((u) => u.tenantId))];
  if (tenantIds.length === 0) throw new Error(`Nenhum usuário com email ${email}`);
  if (tenantIds.length > 1) throw new Error(`Email ${email} em múltiplos tenants: ${tenantIds.join(", ")} — use --tenant`);
  return tenantIds[0]!;
}

async function counts(tenantId: string) {
  const [ledger, analyses, cards, actions] = await Promise.all([
    prisma.ledgerEntry.count({ where: { tenantId } }),
    prisma.monthlyAnalysis.count({ where: { tenantId } }),
    prisma.narrativeCard.count({ where: { analysis: { tenantId } } }),
    prisma.actionPlanItem.count({ where: { analysis: { tenantId } } }),
  ]);
  return { ledger, analyses, cards, actions };
}

async function main() {
  const tenantId = await resolveTenantId();
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
  if (!tenant) throw new Error(`Tenant ${tenantId} não existe`);

  const before = await counts(tenantId);
  console.log(`Tenant alvo: "${tenant.name}" (${tenantId})`);
  console.log(`A limpar: ${before.ledger} lançamentos, ${before.analyses} análises (cascade: ${before.cards} cards, ${before.actions} ações)`);
  console.log("Preservado: tenant, usuários, subscription, memória, métricas.");

  if (!confirm) {
    console.log("\n[DRY-RUN] nada foi apagado. Rode de novo com --confirm para executar.");
    return;
  }

  // Lançamentos primeiro (evita SET NULL); análises depois (cascade cards/ações).
  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany({ where: { tenantId } }),
    prisma.monthlyAnalysis.deleteMany({ where: { tenantId } }),
  ]);

  const after = await counts(tenantId);
  console.log(`\n✔ Limpo. Agora: ${after.ledger} lançamentos, ${after.analyses} análises, ${after.cards} cards, ${after.actions} ações.`);
  if (after.ledger !== 0 || after.analyses !== 0) {
    console.error("ATENÇÃO: contagem pós-limpeza não zerou — investigue.");
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error("Falha:", e?.message ?? e); process.exit(1); }).finally(() => prisma.$disconnect());
