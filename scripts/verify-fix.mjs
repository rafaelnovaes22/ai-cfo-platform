// READ-ONLY: verifica 3 sinais de saúde da execução mais recente do monthly-analysis:
// (1) títulos do plano em PT-BR, (2) needsReview/publishable, (3) nº de execuções
// do action_planning (retry). Use para validar o pipeline pós-deploy.
// Uso: node --env-file=.env scripts/verify-fix.mjs
import { Client } from "langsmith";
const client = new Client();
const project = process.env.LANGSMITH_PROJECT ?? "Aicfo";
const since = new Date(Date.now() - 2 * 3600 * 1000);
const ms = (r) => (r.start_time && r.end_time ? new Date(r.end_time) - new Date(r.start_time) : null);

const all = [];
const roots = [];
for await (const r of client.listRuns({ projectName: project, startTime: since })) {
  all.push(r);
  if (r.name === "LangGraph" && r.run_type === "chain") roots.push(r);
  if (all.length >= 1500) break;
}
roots.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
if (!roots.length) { console.log("Nenhuma execução nas últimas 2h. Aguarde o deploy/ingestão."); process.exit(0); }

console.log("Execuções recentes do grafo:");
roots.slice(0, 5).forEach((r, i) => console.log(`  [${i}] ${r.start_time?.slice(0, 19)}Z  total=${ms(r) != null ? (ms(r) / 1000).toFixed(1) + "s" : "—"}`));

const latest = roots[0];
const traceId = latest.trace_id ?? latest.id;
const inTrace = all.filter((r) => (r.trace_id ?? r.id) === traceId);
console.log(`\n=== análise mais recente (${latest.start_time?.slice(0, 19)}Z, total ${(ms(latest) / 1000).toFixed(1)}s) ===`);

async function out(run) { try { return (await client.readRun(run.id)).outputs ?? run.outputs ?? {}; } catch { return run.outputs ?? {}; } }
const byTime = (a, b) => new Date(a.start_time) - new Date(b.start_time);

// Sinal 3 — retry
const apChains = inTrace.filter((r) => r.name === "action_planning" && r.run_type === "chain").sort(byTime);
console.log(`\n[Sinal 3 — retry] action_planning rodou ${apChains.length}× ${apChains.length === 1 ? "✅ (sem retry espúrio)" : "⚠️ (retry disparou)"}`);

// Sinal 2 — QA
const gates = inTrace.filter((r) => r.name === "qa_gate" && r.run_type === "chain").sort(byTime);
const reviews = inTrace.filter((r) => r.name === "qa_review" && r.run_type === "chain").sort(byTime);
const lastGate = gates[gates.length - 1];
const lastReview = reviews[reviews.length - 1];
const gateOut = lastGate ? await out(lastGate) : {};
const revOut = lastReview ? await out(lastReview) : {};
console.log(`\n[Sinal 2 — QA] needsReview=${gateOut.needsReview} | qaGateDecision=${gateOut.qaGateDecision}`);
console.log(`             publishable=${revOut.qaReview?.publishable} | issues=${JSON.stringify(revOut.qaReview?.issues?.map((i) => i.code) ?? [])}`);
console.log(`             ${gateOut.needsReview === false ? "✅ entrega automática" : "⚠️ caiu em revisão humana"}`);

// Sinal 1 — títulos PT-BR
const lastAp = apChains[apChains.length - 1];
const apOut = lastAp ? await out(lastAp) : {};
const actions = apOut.actionPlan?.actions ?? [];
const englishFirst = /^(suspend|reduce|cut|negotiate|implement|review|cancel|renegotiate|increase|defer|optimize|launch|hire|raise)\b/i;
console.log(`\n[Sinal 1 — títulos PT-BR]`);
let anyEnglish = false;
actions.forEach((a, i) => {
  const eng = englishFirst.test(a.title.trim());
  if (eng) anyEnglish = true;
  console.log(`  [${i + 1}] ${a.title}${eng ? "  ⚠️ VERBO EM INGLÊS" : ""}`);
});
console.log(`             ${actions.length && !anyEnglish ? "✅ todos os títulos em PT-BR" : anyEnglish ? "⚠️ há verbo em inglês" : "(sem ações no output)"}`);
