// READ-ONLY: analisa a execução mais recente do grafo monthly-analysis no
// LangSmith. Mostra wall-clock por nó e nº de lotes LLM por nó — o "fingerprint"
// do chunking (vários spans LLM por nó lite = chunking ativo).
// Uso: node --env-file=.env scripts/analyze-latest-run.mjs [horas]

import { Client } from "langsmith";

const hours = Number(process.argv[2] ?? 3);
const project = process.env.LANGSMITH_PROJECT ?? "Aicfo";
const since = new Date(Date.now() - hours * 3600 * 1000);
const client = new Client();

const LITE_NODES = ["normalize", "clarity_judge", "dre_classifier"];
const LLM_BY_NODE = { normalize: "normalization", clarity_judge: "clarity-judge", dre_classifier: "dre-classification" };
// Baseline pré-chunking (análise de 55 lançamentos, 2026-06-03 12:10).
const BASELINE = { normalize: 89340, clarity_judge: 98330, dre_classifier: 44414, LangGraph: 276115 };

const runs = [];
for await (const r of client.listRuns({ projectName: project, startTime: since })) {
  runs.push(r);
  if (runs.length >= 1500) break;
}
const ms = (r) => (r.start_time && r.end_time ? new Date(r.end_time) - new Date(r.start_time) : null);

const roots = runs
  .filter((r) => r.name === "LangGraph" && r.run_type === "chain")
  .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

if (roots.length === 0) {
  console.log(`Nenhuma execução "LangGraph" nas últimas ${hours}h no projeto ${project}.`);
  console.log("→ A análise pode ainda estar rodando, ou os traces ainda não foram ingeridos (aguarde ~1-2 min).");
  process.exit(0);
}

console.log(`Execuções recentes do grafo (últimas ${hours}h):`);
roots.slice(0, 6).forEach((r, i) =>
  console.log(`  [${i}] ${r.start_time?.slice(0, 19)}Z  total=${ms(r) != null ? (ms(r) / 1000).toFixed(1) + "s" : "—(rodando?)"}  ${r.status ?? "-"}`),
);

const latest = roots[0];
// Identifica os runs da análise pela JANELA DE TEMPO do root (robusto: o filtro
// por trace_id no objeto do listRuns nem sempre vem populado nos spans filhos).
const start = new Date(latest.start_time).getTime();
const end = latest.end_time ? new Date(latest.end_time).getTime() : start + 6 * 60 * 1000;
const inAnalysis = runs.filter((r) => {
  const t = r.start_time ? new Date(r.start_time).getTime() : 0;
  return t >= start - 2000 && t <= end + 2000;
});

const totalMs = ms(latest);
console.log(`\n=== análise mais recente (${latest.start_time?.slice(0, 19)}Z) ===`);
console.log(`total grafo: ${totalMs != null ? (totalMs / 1000).toFixed(1) + "s" : "ainda rodando"}  (baseline ${(BASELINE.LangGraph / 1000).toFixed(0)}s)\n`);

console.log("nó              wall-clock   lotes LLM   tokens out   baseline   Δ");
console.log("-".repeat(74));
let anyChunked = false;
for (const node of LITE_NODES) {
  const chain = inAnalysis.find((r) => r.name === node && r.run_type === "chain");
  const llmSpans = inAnalysis.filter((r) => r.name === LLM_BY_NODE[node] && r.run_type === "llm");
  if (llmSpans.length > 1) anyChunked = true;
  const wall = chain ? ms(chain) : null;
  const outTok = llmSpans.reduce((s, r) => s + (r.extra?.metadata?.usage_metadata?.output_tokens ?? 0), 0);
  const base = BASELINE[node];
  const delta = wall != null ? `${(((wall - base) / base) * 100).toFixed(0)}%` : "—";
  const wallStr = wall != null ? `${(wall / 1000).toFixed(1)}s` : "—";
  console.log(
    `${node.padEnd(15)} ${wallStr.padStart(9)} ${String(llmSpans.length).padStart(10)} ${String(outTok).padStart(12)} ${((base / 1000).toFixed(0) + "s").padStart(10)} ${delta.padStart(6)}`,
  );
}

// action_planning roda 1× normalmente; >1 indica retry (qa_gate).
const apRuns = inAnalysis.filter((r) => r.name === "action_planning" && r.run_type === "chain");
console.log(`\naction_planning: ${apRuns.length}× ${apRuns.length > 1 ? "(retry disparou)" : "(sem retry)"}`);
console.log(`chunking ativo (>1 lote em algum nó lite): ${anyChunked ? "SIM ✅" : "NÃO ⚠️ (1 lote/nó — deploy antigo OU ≤ chunkSize lançamentos)"}`);
