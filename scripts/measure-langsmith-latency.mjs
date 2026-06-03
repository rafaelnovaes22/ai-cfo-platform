// Ferramenta de diagnóstico READ-ONLY: mede latência por nó (run LLM) no LangSmith.
// Uso: node --env-file=.env scripts/measure-langsmith-latency.mjs [dias]
// Lê LANGSMITH_API_KEY / LANGSMITH_ENDPOINT / LANGSMITH_PROJECT do .env.
// Não escreve nada — apenas lista runs e agrega latência/tokens por nome de nó.

import { Client } from "langsmith";

const days = Number(process.argv[2] ?? 4);
const projectName = process.env.LANGSMITH_PROJECT ?? "aicfo";
const sinceMs = Date.now() - days * 24 * 3600 * 1000;

const client = new Client();

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function tokensOf(run) {
  const direct =
    (run.prompt_tokens ?? 0) + (run.completion_tokens ?? 0) || (run.total_tokens ?? 0);
  if (direct) return direct;
  const um = run.extra?.metadata?.usage_metadata;
  if (um) return (um.input_tokens ?? 0) + (um.output_tokens ?? 0);
  return 0;
}

const groups = new Map(); // name -> { lat: number[], tokens: number[], errors: number }
let total = 0;

console.log(`Projeto: ${projectName} | janela: últimos ${days} dias | endpoint: ${process.env.LANGSMITH_ENDPOINT ?? "default"}`);

const iter = client.listRuns({
  projectName,
  runType: "llm",
  startTime: new Date(sinceMs),
});

for await (const run of iter) {
  total += 1;
  const name = run.name ?? "(sem nome)";
  if (!groups.has(name)) groups.set(name, { lat: [], tokens: [], errors: 0 });
  const g = groups.get(name);
  if (run.error) g.errors += 1;
  if (run.start_time && run.end_time) {
    const start = new Date(run.start_time).getTime();
    const end = new Date(run.end_time).getTime();
    if (end >= start) g.lat.push(end - start);
  }
  const t = tokensOf(run);
  if (t) g.tokens.push(t);
  if (total >= 5000) break; // guarda contra projetos enormes
}

console.log(`\nTotal de runs LLM coletados: ${total}\n`);

const rows = [...groups.entries()]
  .map(([name, g]) => {
    const sorted = [...g.lat].sort((a, b) => a - b);
    const tokSorted = [...g.tokens].sort((a, b) => a - b);
    return {
      name,
      n: g.lat.length,
      errors: g.errors,
      p50: Math.round(pct(sorted, 50)),
      p95: Math.round(pct(sorted, 95)),
      max: sorted.length ? sorted[sorted.length - 1] : 0,
      medTokens: Math.round(pct(tokSorted, 50)),
    };
  })
  .sort((a, b) => b.p95 - a.p95);

const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
console.log(
  pad("nó (name)", 24) + padL("n", 6) + padL("erros", 7) +
  padL("p50 ms", 9) + padL("p95 ms", 9) + padL("max ms", 9) + padL("tok p50", 9),
);
console.log("-".repeat(73));
for (const r of rows) {
  console.log(
    pad(r.name, 24) + padL(r.n, 6) + padL(r.errors, 7) +
    padL(r.p50, 9) + padL(r.p95, 9) + padL(r.max, 9) + padL(r.medTokens, 9),
  );
}

// Soma dos p50/p95 dos nós do caminho crítico do grafo (sequencial).
const CRITICAL = [
  "normalization", "clarity-judge", "dre-classification",
  "narrative-synthesis", "action-planning", "financial-qa-review",
];
const byName = new Map(rows.map((r) => [r.name, r]));
let sumP50 = 0, sumP95 = 0, missing = [];
for (const n of CRITICAL) {
  const r = byName.get(n);
  if (r) { sumP50 += r.p50; sumP95 += r.p95; } else missing.push(n);
}
console.log("\n--- caminho crítico sequencial (soma dos nós, fan-out conta 1x via narrative) ---");
console.log(`soma p50 ≈ ${(sumP50 / 1000).toFixed(1)}s | soma p95 ≈ ${(sumP95 / 1000).toFixed(1)}s`);
if (missing.length) console.log(`AVISO: nós sem dados (possível colisão de traceId derrubando traces): ${missing.join(", ")}`);
