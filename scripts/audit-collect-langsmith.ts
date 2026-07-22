// Coletor READ-ONLY de runtime via LangSmith para /novais-digital:audit-monthly (estágio 1).
//
// Uso:  tsx --env-file=.env scripts/audit-collect-langsmith.ts 2026-05
//
// Lê LANGSMITH_API_KEY / LANGSMITH_PROJECT / LANGSMITH_ENDPOINT do .env. Não escreve nada.
// Agrega os runs do MÊS (janela UTC [mês-01, próximo-mês-01)): volume, latência por nó,
// custo por análise (tabela espelha src/llm/cost.ts) e erros. Emite só AGREGADOS — nenhum
// input/output de run é carregado (LGPD). Complementa o coletor de DB (audit-collect-runtime).

import { Client } from "langsmith";

const month = process.argv[2];
if (!month || !/^\d{4}-\d{2}$/.test(month)) {
  console.error("Uso: tsx --env-file=.env scripts/audit-collect-langsmith.ts YYYY-MM");
  process.exit(1);
}
if (!process.env.LANGSMITH_API_KEY && !process.env.LANGCHAIN_API_KEY) {
  console.error("ERRO: LANGSMITH_API_KEY ausente no .env.");
  process.exit(1);
}

const parts = month.split("-");
const yy = Number(parts[0]);
const mm = Number(parts[1]);
const start = new Date(Date.UTC(yy, mm - 1, 1));
const end = new Date(Date.UTC(yy, mm, 1)); // exclusivo
const now = new Date();
if (start > now) {
  console.error(`ERRO: ${month} é futuro.`);
  process.exit(1);
}

const projectName = process.env.LANGSMITH_PROJECT ?? "aicfo";

// Preços (USD por 1M tokens) — espelha src/llm/cost.ts via scripts/measure-cost.mjs.
const BRL_PER_USD = 5.7;
const PRICE: Record<string, { in: number; out: number }> = {
  "gemini-2.0-flash": { in: 0.075, out: 0.3 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "gemini-2.5-flash": { in: 0.15, out: 0.6 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1-nano": { in: 0.1, out: 0.4 },
};
const DEFAULT_PRICE = { in: 0.15, out: 0.6 };

interface Run {
  id?: string;
  trace_id?: string;
  name?: string;
  run_type?: string;
  start_time?: string | Date;
  end_time?: string | Date;
  error?: unknown;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  extra?: { metadata?: Record<string, unknown>; invocation_params?: Record<string, unknown> };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? null;
}
function latencyMs(r: Run): number | null {
  if (!r.start_time || !r.end_time) return null;
  const s = new Date(r.start_time).getTime();
  const e = new Date(r.end_time).getTime();
  return e >= s ? e - s : null;
}
function tokensOf(r: Run): { input: number; output: number } {
  const meta = r.extra?.metadata as { usage_metadata?: { input_tokens?: number; output_tokens?: number } } | undefined;
  const um = meta?.usage_metadata;
  if (um && (um.input_tokens || um.output_tokens)) {
    return { input: um.input_tokens ?? 0, output: um.output_tokens ?? 0 };
  }
  if (r.prompt_tokens || r.completion_tokens) {
    return { input: r.prompt_tokens ?? 0, output: r.completion_tokens ?? 0 };
  }
  return { input: 0, output: 0 };
}
function modelOf(r: Run): string {
  const m = r.extra?.metadata as Record<string, unknown> | undefined;
  const ip = r.extra?.invocation_params as Record<string, unknown> | undefined;
  return String(m?.ls_model_name ?? ip?.model ?? ip?.model_name ?? "unknown");
}
function costBRL(model: string, inTok: number, outTok: number): number {
  const p = PRICE[model] ?? DEFAULT_PRICE;
  return ((inTok / 1e6) * p.in + (outTok / 1e6) * p.out) * BRL_PER_USD;
}

async function main() {
  const client = new Client();

  const byNode = new Map<string, { lat: number[]; errors: number; n: number; tokIn: number; tokOut: number }>();
  const byTraceCost = new Map<string, number>(); // trace_id -> custo BRL acumulado
  const rootLatencies: number[] = [];
  const rootNames: Record<string, number> = {};
  const byRunType: Record<string, number> = {};
  const modelsSeen: Record<string, number> = {};
  let totalRuns = 0;
  let erroredRuns = 0;
  let totalCostBRL = 0;
  let capped = false;

  const iter = client.listRuns({ projectName, startTime: start });
  for await (const raw of iter) {
    const run = raw as Run;
    // Filtro client-side da borda superior (janela exclusiva no fim do mês).
    if (run.start_time && new Date(run.start_time) >= end) continue;
    totalRuns += 1;
    if (run.error) erroredRuns += 1;
    byRunType[run.run_type ?? "?"] = (byRunType[run.run_type ?? "?"] ?? 0) + 1;

    const isRoot = run.id && run.trace_id && run.id === run.trace_id;
    if (isRoot) {
      const name = run.name ?? "(sem nome)";
      rootNames[name] = (rootNames[name] ?? 0) + 1;
      const lat = latencyMs(run);
      if (lat !== null) rootLatencies.push(lat);
    }

    if (run.run_type === "llm") {
      const name = run.name ?? "(sem nome)";
      if (!byNode.has(name)) byNode.set(name, { lat: [], errors: 0, n: 0, tokIn: 0, tokOut: 0 });
      const g = byNode.get(name)!;
      g.n += 1;
      if (run.error) g.errors += 1;
      const lat = latencyMs(run);
      if (lat !== null) g.lat.push(lat);
      const { input, output } = tokensOf(run);
      g.tokIn += input;
      g.tokOut += output;
      const model = modelOf(run);
      modelsSeen[model] = (modelsSeen[model] ?? 0) + 1;
      const c = costBRL(model, input, output);
      totalCostBRL += c;
      const tid = run.trace_id ?? run.id ?? "?";
      byTraceCost.set(tid, (byTraceCost.get(tid) ?? 0) + c);
    }

    if (totalRuns >= 20000) {
      capped = true;
      break;
    }
  }

  rootLatencies.sort((a, b) => a - b);
  const perTraceCosts = [...byTraceCost.values()].sort((a, b) => a - b);
  const nodes = [...byNode.entries()]
    .map(([name, g]) => {
      const s = [...g.lat].sort((a, b) => a - b);
      return {
        node: name,
        n: g.n,
        errors: g.errors,
        latency_ms_p50: percentile(s, 50),
        latency_ms_p95: percentile(s, 95),
        tokens_in_total: g.tokIn,
        tokens_out_total: g.tokOut,
      };
    })
    .sort((a, b) => (b.latency_ms_p95 ?? 0) - (a.latency_ms_p95 ?? 0));

  const result = {
    audit_period: month,
    generated_by: "scripts/audit-collect-langsmith.ts",
    data_source: `langsmith project="${projectName}" (read-only)`,
    window_utc: { start: start.toISOString(), end: end.toISOString() },
    pii: "none — aggregates only",
    capped_at_20000: capped,
    volume: {
      total_runs: totalRuns,
      by_run_type: byRunType,
      trace_roots: Object.values(rootNames).reduce((a, b) => a + b, 0),
      root_names: rootNames,
    },
    errors: {
      errored_runs: erroredRuns,
      error_rate: totalRuns > 0 ? Number(((erroredRuns / totalRuns) * 100).toFixed(2)) : null,
    },
    latency_root_ms: {
      p50: percentile(rootLatencies, 50),
      p95: percentile(rootLatencies, 95),
      max: rootLatencies.length ? (rootLatencies[rootLatencies.length - 1] ?? null) : null,
      sample: rootLatencies.length,
    },
    c3_cost_brl: {
      total: Number(totalCostBRL.toFixed(2)),
      per_trace_p50: perTraceCosts.length ? Number((percentile(perTraceCosts, 50) ?? 0).toFixed(4)) : null,
      per_trace_p95: perTraceCosts.length ? Number((percentile(perTraceCosts, 95) ?? 0).toFixed(4)) : null,
      per_trace_max: perTraceCosts.length ? Number((perTraceCosts[perTraceCosts.length - 1] ?? 0).toFixed(4)) : null,
      traces_with_cost: perTraceCosts.length,
    },
    models_seen: modelsSeen,
    per_node_llm: nodes,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error("Falha na coleta LangSmith:", e?.message ?? e);
  process.exit(1);
});
