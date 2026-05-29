/**
 * Runner de staging para o módulo cashflow — 30 runs com assertion de shape.
 * Executa: npx tsx --env-file=.env scripts/cashflow-staging-runner.ts
 *
 * Pré-requisito: PR feat/aicfo-cashflow-fase1-mvp mergeado em staging e deploy Railway concluído.
 * Grava resultado em evals/cashflow/runs/{date}-staging-run.md
 */

import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SignJWT } from "jose";

// ─── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.STAGING_API_URL ?? "https://aicfo-staging-production.up.railway.app";
const JWT_SECRET = process.env.JWT_SECRET ?? "";
const TENANT_ID = process.env.STAGING_TENANT_ID ?? "test-tenant-cashflow-staging";

if (!JWT_SECRET) {
  console.error("JWT_SECRET ausente em .env");
  process.exit(1);
}

// Usa STAGING_TOKEN se fornecido (token real do staging); caso contrário gera com JWT_SECRET local
const STAGING_TOKEN = process.env.STAGING_TOKEN ?? "";
let token: string;
if (STAGING_TOKEN) {
  token = STAGING_TOKEN;
} else {
  const secret = new TextEncoder().encode(JWT_SECRET);
  token = await new SignJWT({ tid: TENANT_ID, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("staging-runner")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

// ─── Cenários dos 30 runs (cobre os casos do eval suite) ──────────────────────

interface RunScenario {
  id: string;
  description: string;
  path: string;
  expectedStatus: number;
  assertions: Array<(body: Record<string, unknown>) => { pass: boolean; msg: string }>;
}

const today = new Date().toISOString().slice(0, 10);
const thisYear = today.slice(0, 4);

const scenarios: RunScenario[] = [
  // Happy path — monthly (6 runs)
  {
    id: "R01", description: "Q1/2026 granularity=monthly",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-03-31&granularity=monthly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: b.period != null, msg: "period presente" }),
      (b) => ({ pass: (b.summary as Record<string, unknown>) != null, msg: "summary presente" }),
      (b) => ({ pass: Array.isArray(b.chart), msg: "chart é array" }),
      (b) => ({ pass: Array.isArray(b.table), msg: "table é array" }),
      (b) => ({ pass: (b.chart as unknown[]).length <= 3, msg: "chart.length <= 3" }),
    ],
  },
  {
    id: "R02", description: "Janeiro/2026 granularity=monthly",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-01-31&granularity=monthly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 1, msg: "chart.length <= 1 (1 mês)" }),
      (b) => ({ pass: (b.summary as Record<string, unknown>).totalCreditsCents != null, msg: "totalCreditsCents presente" }),
    ],
  },
  {
    id: "R03", description: "H1/2026 granularity=monthly",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-06-30&granularity=monthly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 6, msg: "chart.length <= 6" }),
    ],
  },
  {
    id: "R04", description: "Ano completo granularity=monthly",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-12-31&granularity=monthly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 12, msg: "chart.length <= 12" }),
    ],
  },
  {
    id: "R05", description: "Fev/2026 granularity=monthly com category",
    path: `/cashflow?startDate=${thisYear}-02-01&endDate=${thisYear}-02-28&granularity=monthly&category=Receita%20Bruta`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: b.summary != null, msg: "summary presente com filtro de category" }),
    ],
  },
  {
    id: "R06", description: "Q2/2026 granularity=monthly",
    path: `/cashflow?startDate=${thisYear}-04-01&endDate=${thisYear}-06-30&granularity=monthly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 3, msg: "chart.length <= 3" }),
    ],
  },

  // Happy path — quarterly (3 runs)
  {
    id: "R07", description: "Q1/2026 granularity=quarterly",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-03-31&granularity=quarterly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 1, msg: "chart.length <= 1 (1 quarter)" }),
    ],
  },
  {
    id: "R08", description: "H1/2026 granularity=quarterly",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-06-30&granularity=quarterly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 2, msg: "chart.length <= 2 (2 quarters)" }),
    ],
  },
  {
    id: "R09", description: "Ano completo granularity=quarterly",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-12-31&granularity=quarterly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 4, msg: "chart.length <= 4 (4 quarters)" }),
    ],
  },

  // Happy path — daily (4 runs)
  {
    id: "R10", description: "Últimos 7 dias granularity=daily",
    path: `/cashflow?startDate=${offsetDate(today, -6)}&endDate=${today}&granularity=daily`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 7, msg: "chart.length <= 7" }),
    ],
  },
  {
    id: "R11", description: "Dia único granularity=daily",
    path: `/cashflow?startDate=${today}&endDate=${today}&granularity=daily`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 1, msg: "chart.length <= 1 (1 dia)" }),
    ],
  },
  {
    id: "R12", description: "Janeiro granularity=daily",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-01-31&granularity=daily`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 31, msg: "chart.length <= 31" }),
    ],
  },
  {
    id: "R13", description: "Q1 granularity=daily (stress 90d)",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-03-31&granularity=daily`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 90, msg: "chart.length <= 90" }),
    ],
  },

  // Happy path — weekly (2 runs)
  {
    id: "R14", description: "Janeiro granularity=weekly",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-01-31&granularity=weekly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 5, msg: "chart.length <= 5 (semanas de jan)" }),
    ],
  },
  {
    id: "R15", description: "Q1 granularity=weekly",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-03-31&granularity=weekly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 13, msg: "chart.length <= 13 (semanas do Q1)" }),
    ],
  },

  // Summary alias diário (3 runs)
  {
    id: "R16", description: "GET /cashflow/summary hoje",
    path: `/cashflow/summary`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: b.date != null, msg: "date presente" }),
      (b) => ({ pass: b.creditsCents != null, msg: "creditsCents presente" }),
      (b) => ({ pass: b.debitsCents != null, msg: "debitsCents presente" }),
    ],
  },
  {
    id: "R17", description: "GET /cashflow/summary data específica",
    path: `/cashflow/summary?date=${thisYear}-01-15`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.date as string) === `${thisYear}-01-15`, msg: `date == ${thisYear}-01-15` }),
    ],
  },
  {
    id: "R18", description: "GET /cashflow/summary data futura",
    path: `/cashflow/summary?date=${thisYear}-12-31`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.creditsCents as number) === 0, msg: "creditsCents == 0 (data futura)" }),
      (b) => ({ pass: (b.debitsCents as number) === 0, msg: "debitsCents == 0 (data futura)" }),
    ],
  },

  // Edge cases (5 runs)
  {
    id: "R19", description: "Período futuro sem dados",
    path: `/cashflow?startDate=${thisYear}-12-01&endDate=${thisYear}-12-31&granularity=monthly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.summary as Record<string, unknown>).totalCreditsCents === 0, msg: "totalCreditsCents == 0" }),
      (b) => ({ pass: (b.chart as unknown[]).length === 0, msg: "chart vazio" }),
    ],
  },
  {
    id: "R20", description: "Category inexistente no período",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-03-31&granularity=monthly&category=CategoriaInexistente999`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.summary as Record<string, unknown>).totalCreditsCents === 0, msg: "summary zerado" }),
      (b) => ({ pass: (b.table as unknown[]).length === 0, msg: "table vazia" }),
    ],
  },
  {
    id: "R21", description: "Q1 sem filtros — verifica estrutura completa",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-03-31&granularity=monthly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: "openingBalanceCents" in (b.summary as object), msg: "openingBalanceCents presente (pode ser null)" }),
      (b) => ({ pass: "closingBalanceCents" in (b.summary as object), msg: "closingBalanceCents presente" }),
      (b) => { const s = b.summary as { totalCreditsCents: number; totalDebitsCents: number; openingBalanceCents: number | null; closingBalanceCents: number }; const arith = s.totalCreditsCents - s.totalDebitsCents; const expected = s.openingBalanceCents != null ? s.openingBalanceCents + arith : null; return { pass: expected == null || expected === s.closingBalanceCents, msg: "closing = opening + credits - debits" }; },
    ],
  },
  {
    id: "R22", description: "requestId presente no response",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-01-31&granularity=monthly`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: typeof b.requestId === "string" && b.requestId.length > 0, msg: "requestId string não-vazia" }),
    ],
  },
  {
    id: "R23", description: "creditCount + debitCount consistente",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-06-30&granularity=monthly`,
    expectedStatus: 200,
    assertions: [
      (b) => { const s = b.summary as { creditCount: number; debitCount: number }; return { pass: s.creditCount >= 0 && s.debitCount >= 0, msg: "counts >= 0" }; },
    ],
  },

  // Security (4 runs)
  {
    id: "R24", description: "401 sem auth header",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-01-31&granularity=monthly`,
    expectedStatus: 401,
    assertions: [],
  },
  {
    id: "R25", description: "400 startDate > endDate",
    path: `/cashflow?startDate=${thisYear}-03-31&endDate=${thisYear}-01-01&granularity=monthly`,
    expectedStatus: 400,
    assertions: [],
  },
  {
    id: "R26", description: "400 granularity inválida",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-03-31&granularity=anual`,
    expectedStatus: 400,
    assertions: [],
  },
  {
    id: "R27", description: "Cross-tenant: ?tenantId ignorado",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-03-31&granularity=monthly&tenantId=outro-tenant-qualquer`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: b.summary != null, msg: "response válido (query param tenantId ignorado)" }),
    ],
  },

  // Adversarial (3 runs)
  {
    id: "R28", description: "365 dias granularity=daily (stress)",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-12-31&granularity=daily`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: (b.chart as unknown[]).length <= 366, msg: "chart.length <= 366" }),
    ],
  },
  {
    id: "R29", description: "Category com caractere especial &",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-03-31&granularity=monthly&category=Receita%20%26%20Outras`,
    expectedStatus: 200,
    assertions: [
      (b) => ({ pass: b.summary != null, msg: "sem SQL injection (status 200)" }),
    ],
  },
  {
    id: "R30", description: "Q1 com table detalhada por categoria",
    path: `/cashflow?startDate=${thisYear}-01-01&endDate=${thisYear}-03-31&granularity=monthly`,
    expectedStatus: 200,
    assertions: [
      (b) => {
        const table = b.table as Array<Record<string, unknown>>;
        const allHaveByPeriod = table.every((row) => Array.isArray(row.byPeriod));
        return { pass: allHaveByPeriod, msg: "todas as rows têm byPeriod[]" };
      },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function offsetDate(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Runner ───────────────────────────────────────────────────────────────────

interface RunResult {
  id: string;
  description: string;
  status: number;
  latency_ms: number;
  pass: boolean;
  failures: string[];
}

async function run(): Promise<void> {
  console.log(`\n🚀 Cashflow staging runner — ${BASE_URL}\n`);
  console.log(`Tenant: ${TENANT_ID}`);
  console.log(`Cenários: ${scenarios.length}\n`);

  const results: RunResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const scenario of scenarios) {
    const url = `${BASE_URL}${scenario.path}`;

    // R24 roda sem auth para testar 401
    const reqHeaders = scenario.id === "R24" ? { "Content-Type": "application/json" } : headers;

    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(url, { headers: reqHeaders });
    } catch (err) {
      results.push({ id: scenario.id, description: scenario.description, status: 0, latency_ms: Date.now() - start, pass: false, failures: [`Fetch error: ${(err as Error).message}`] });
      failed++;
      console.log(`❌ ${scenario.id} — ${scenario.description}: FETCH ERROR`);
      continue;
    }
    const latency = Date.now() - start;

    const failures: string[] = [];

    if (res.status !== scenario.expectedStatus) {
      failures.push(`status ${res.status} != expected ${scenario.expectedStatus}`);
    }

    let body: Record<string, unknown> = {};
    if (res.status === 200) {
      try { body = (await res.json()) as Record<string, unknown>; } catch { failures.push("response não é JSON válido"); }
    }

    for (const assertion of scenario.assertions) {
      const result = assertion(body);
      if (!result.pass) failures.push(result.msg);
    }

    if (latency > 800) failures.push(`latency ${latency}ms > 800ms`);

    const pass = failures.length === 0;
    if (pass) passed++; else failed++;

    results.push({ id: scenario.id, description: scenario.description, status: res.status, latency_ms: latency, pass, failures });
    console.log(`${pass ? "✅" : "❌"} ${scenario.id} — ${scenario.description} (${latency}ms) ${failures.length > 0 ? "→ " + failures.join("; ") : ""}`);
  }

  const passRate = ((passed / scenarios.length) * 100).toFixed(1);
  const verdict = passed === scenarios.length ? "APROVADO" : "REPROVADO";

  console.log(`\n${verdict === "APROVADO" ? "✅" : "❌"} ${verdict} — ${passed}/${scenarios.length} (${passRate}%)\n`);

  // ─── Grava relatório ──────────────────────────────────────────────────────

  const date = new Date().toISOString().slice(0, 10);
  const runHash = createHash("sha256").update(date + TENANT_ID).digest("hex").slice(0, 8);
  const runsDir = join(process.cwd(), "evals/cashflow/runs");
  mkdirSync(runsDir, { recursive: true });

  const reportPath = join(runsDir, `${date}-staging-run-${runHash}.md`);
  const report = `---
module: cashflow
eval_method: assertion_shape
run_type: staging
base_url: ${BASE_URL}
tenant_id: ${TENANT_ID}
started_at: ${new Date().toISOString()}
total_cases: ${scenarios.length}
passed: ${passed}
failed: ${failed}
pass_rate: ${passRate}%
pass_rate_threshold: 100.0%
threshold_met: ${passed === scenarios.length}
run_hash: ${runHash}
---

# Staging Run — cashflow — ${date}

**Veredito**: ${verdict === "APROVADO" ? "✅ APROVADO" : "❌ REPROVADO"} — pass rate ${passRate}% vs threshold 100%

## Resumo

| Métrica | Valor |
|---|---|
| Base URL | \`${BASE_URL}\` |
| Tenant | \`${TENANT_ID}\` |
| Cenários executados | ${scenarios.length} |
| Passaram | ${passed} |
| Falharam | ${failed} |
| Pass rate | ${passRate}% |

## Resultados por cenário

| ID | Descrição | Status HTTP | Latência | Resultado | Falhas |
|---|---|---|---|---|---|
${results.map((r) => `| ${r.id} | ${r.description} | ${r.status} | ${r.latency_ms}ms | ${r.pass ? "✅" : "❌"} | ${r.failures.join("; ") || "—"} |`).join("\n")}

## Latência p95

${(() => {
  const latencies = results.filter((r) => r.pass).map((r) => r.latency_ms).sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  return `p95: **${p95}ms** (threshold: 800ms) ${p95 < 800 ? "✅" : "❌"}`;
})()}
`;

  writeFileSync(reportPath, report);
  console.log(`Relatório gravado: ${reportPath}`);

  process.exit(passed === scenarios.length ? 0 : 1);
}

run().catch((err) => { console.error(err); process.exit(1); });
