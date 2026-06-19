// Coletor READ-ONLY para /acme:audit-monthly (estágio 1 — coleta de dados).
//
// Uso:  tsx --env-file=.env scripts/audit-collect-runtime.ts 2026-05
//
// Lê AUDIT_DATABASE_URL (role somente-leitura — GRANT SELECT). NUNCA escreve:
// força `SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` no Postgres como guarda
// extra além do GRANT. Emite SÓ AGREGADOS (counts, %, percentis de custo) — nenhum
// campo de conteúdo, tenantId, narrativa ou edição do cliente é carregado (LGPD/C6).
//
// Saída: JSON estruturado no stdout (seguro p/ colar — sem PII). Opcionalmente cruza
// com LangSmith se LANGSMITH_API_KEY estiver presente (latência p50/p95).

import { PrismaClient } from "@prisma/client";

const month = process.argv[2];
if (!month || !/^\d{4}-\d{2}$/.test(month)) {
  console.error("Uso: tsx --env-file=.env scripts/audit-collect-runtime.ts YYYY-MM");
  process.exit(1);
}

// Guard de mês fechado: não auditar o mês corrente (números ainda mudam).
const now = new Date();
const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
if (month >= currentMonth) {
  console.error(`ERRO: ${month} não é um mês fechado (corrente=${currentMonth}). Audite só meses fechados.`);
  process.exit(1);
}

const url = process.env.AUDIT_DATABASE_URL;
if (!url) {
  console.error("ERRO: AUDIT_DATABASE_URL ausente no .env. Configure a role read-only (ver instruções).");
  process.exit(1);
}

const prisma = new PrismaClient({ datasourceUrl: url, log: ["error"] });

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? null;
}

async function main() {
  // Cinto + suspensório: sessão read-only no nível do PG. SET é permitido p/ role read-only.
  await prisma.$executeRawUnsafe("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");

  // ── Subscriptions: distribuição por modo × status ──
  const subsGrouped = await prisma.subscription.groupBy({
    by: ["mode", "status"],
    _count: { _all: true },
  });
  const subscriptions = subsGrouped.map((g) => ({
    mode: g.mode,
    status: g.status,
    count: g._count._all,
  }));
  const activeAssistedOrAutonomous = subsGrouped
    .filter((g) => g.status === "active" && (g.mode === "assisted" || g.mode === "autonomous"))
    .reduce((s, g) => s + g._count._all, 0);

  // ── Diagnóstico: onde estão TODAS as análises (distribuição por referenceMonth) ──
  // Sanidade: detecta se o mês auditado tem 0 porque não houve runs OU porque os dados
  // estão em outro mês / formato divergente. Sem PII (só mês + contagem).
  const allByMonthRaw = await prisma.monthlyAnalysis.groupBy({
    by: ["referenceMonth"],
    _count: { _all: true },
  });
  const analyses_by_reference_month = allByMonthRaw
    .map((g) => ({ referenceMonth: g.referenceMonth, count: g._count._all }))
    .sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
  const analyses_total_all_time = analyses_by_reference_month.reduce((s, g) => s + g.count, 0);

  // ── MonthlyAnalysis do mês: só campos não-PII (status/modo/custo/timestamps/traceId) ──
  const rows = await prisma.monthlyAnalysis.findMany({
    where: { referenceMonth: month },
    select: {
      status: true,
      mode: true,
      costCents: true,
      traceId: true,
      createdAt: true,
      generatedAt: true,
      deliveredAt: true,
      approvedAt: true,
    },
  });

  const total = rows.length;
  const byStatus: Record<string, number> = {};
  const byMode: Record<string, number> = {};
  let withTrace = 0;
  let delivered = 0;
  let approved = 0;
  const costs: number[] = [];
  const genLatenciesSec: number[] = [];

  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byMode[r.mode] = (byMode[r.mode] ?? 0) + 1;
    if (r.traceId) withTrace += 1;
    if (r.deliveredAt) delivered += 1;
    if (r.approvedAt) approved += 1;
    if (typeof r.costCents === "number") costs.push(r.costCents);
    if (r.createdAt && r.generatedAt) {
      genLatenciesSec.push((r.generatedAt.getTime() - r.createdAt.getTime()) / 1000);
    }
  }

  // ── Agreement proxy (C4): em ASSISTED, % de análises entregues SEM edição do cliente. ──
  // Conta presença de edição sem carregar o texto (where ... not null).
  const editedNarrative = await prisma.monthlyAnalysis.count({
    where: { referenceMonth: month, NOT: { clientEditedNarrative: null } },
  });
  const editedActionPlan = await prisma.monthlyAnalysis.count({
    where: { referenceMonth: month, NOT: { clientEditedActionPlan: null } },
  });
  const editedAny = await prisma.monthlyAnalysis.count({
    where: {
      referenceMonth: month,
      OR: [{ NOT: { clientEditedNarrative: null } }, { NOT: { clientEditedActionPlan: null } }],
    },
  });

  costs.sort((a, b) => a - b);
  genLatenciesSec.sort((a, b) => a - b);

  const deliveredOrApproved = Math.max(delivered, approved);
  const agreementRate =
    deliveredOrApproved > 0 ? (deliveredOrApproved - editedAny) / deliveredOrApproved : null;

  const result = {
    audit_period: month,
    generated_by: "scripts/audit-collect-runtime.ts",
    data_source: "production-db (read-only)",
    pii: "none — aggregates only",
    subscriptions: {
      by_mode_status: subscriptions,
      active_assisted_or_autonomous: activeAssistedOrAutonomous,
    },
    diagnostics: {
      analyses_total_all_time,
      analyses_by_reference_month,
    },
    monthly_analyses: {
      total,
      by_status: byStatus,
      by_mode: byMode,
      delivered,
      approved,
    },
    c3_cost: {
      analyses_with_cost: costs.length,
      cost_cents_p50: percentile(costs, 50),
      cost_cents_p95: percentile(costs, 95),
      cost_cents_avg: costs.length ? Math.round(costs.reduce((a, b) => a + b, 0) / costs.length) : null,
      cost_cents_max: costs.length ? costs[costs.length - 1] : null,
    },
    c4_agreement: {
      delivered_or_approved: deliveredOrApproved,
      edited_narrative: editedNarrative,
      edited_action_plan: editedActionPlan,
      edited_any: editedAny,
      agreement_rate_proxy: agreementRate,
      note: "proxy = (entregues − editadas) / entregues. Edição do cliente = sinal de disagreement.",
    },
    c6_telemetry: {
      analyses_total: total,
      analyses_with_traceid: withTrace,
      trace_coverage_pct: total > 0 ? Number(((withTrace / total) * 100).toFixed(1)) : null,
      target_pct: 100,
    },
    latency: {
      generation_latency_sec_p50: percentile(genLatenciesSec, 50),
      generation_latency_sec_p95: percentile(genLatenciesSec, 95),
      sample: genLatenciesSec.length,
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error("Falha na coleta:", e?.message ?? e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
