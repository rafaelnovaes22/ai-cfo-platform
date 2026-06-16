// READ-ONLY: custo real por análise (monthly-analysis) a partir dos tokens no
// LangSmith × tabela de preços (espelha src/llm/cost.ts). Mede o impacto do
// chunking no input. Uso: node --env-file=.env scripts/measure-cost.mjs [n_análises]

import { Client } from "langsmith";

const BRL_PER_USD = 5.7;
const PRICE = {
  "gemini-2.0-flash": { in: 0.075, out: 0.30 },
  "gemini-2.5-flash-lite": { in: 0.10, out: 0.40 },
  "gemini-2.5-flash": { in: 0.15, out: 0.60 },
  "gpt-4.1-mini": { in: 0.40, out: 1.60 },
  "gpt-4.1-nano": { in: 0.10, out: 0.40 },
};
const DEFAULT = { in: 0.15, out: 0.60 };

function costBRL(model, inTok, outTok) {
  const p = PRICE[model] ?? DEFAULT;
  return ((inTok / 1e6) * p.in + (outTok / 1e6) * p.out) * BRL_PER_USD;
}

const n = Number(process.argv[2] ?? 5);
const project = process.env.LANGSMITH_PROJECT ?? "Aicfo";
const since = new Date(Date.now() - 6 * 3600 * 1000);
const client = new Client();
const runs = [];
for await (const r of client.listRuns({ projectName: project, startTime: since })) {
  runs.push(r);
  if (runs.length >= 2000) break;
}
const ms = (r) => (r.start_time && r.end_time ? new Date(r.end_time) - new Date(r.start_time) : null);
const roots = runs
  .filter((r) => r.name === "LangGraph" && r.run_type === "chain")
  .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
  .slice(0, n);

let grand = 0;
for (const root of roots) {
  const start = new Date(root.start_time).getTime();
  const end = root.end_time ? new Date(root.end_time).getTime() : start + 6 * 60 * 1000;
  const llm = runs.filter((r) => {
    const t = r.start_time ? new Date(r.start_time).getTime() : 0;
    return r.run_type === "llm" && t >= start - 2000 && t <= end + 2000;
  });
  const byNode = {};
  let inTot = 0, outTot = 0, cost = 0;
  for (const r of llm) {
    const model = r.extra?.metadata?.model ?? "?";
    const um = r.extra?.metadata?.usage_metadata ?? {};
    const i = um.input_tokens ?? 0, o = um.output_tokens ?? 0;
    const c = costBRL(model, i, o);
    inTot += i; outTot += o; cost += c;
    byNode[r.name] = byNode[r.name] ?? { n: 0, in: 0, out: 0, cost: 0, model };
    byNode[r.name].n++; byNode[r.name].in += i; byNode[r.name].out += o; byNode[r.name].cost += c;
  }
  grand += cost;
  console.log(`\n=== ${root.start_time?.slice(0, 19)}Z | total ${(ms(root) / 1000).toFixed(0)}s | ${llm.length} chamadas LLM ===`);
  console.log(`  input=${inTot} tok  output=${outTot} tok  →  CUSTO R$ ${cost.toFixed(4)}`);
  for (const [name, b] of Object.entries(byNode).sort((a, b) => b[1].cost - a[1].cost)) {
    console.log(`    ${name.padEnd(22)} ${b.n}× ${b.model.padEnd(22)} in=${String(b.in).padStart(6)} out=${String(b.out).padStart(5)} R$ ${b.cost.toFixed(4)}`);
  }
}
if (roots.length) console.log(`\nCUSTO MÉDIO por análise (${roots.length} análises): R$ ${(grand / roots.length).toFixed(4)}`);
