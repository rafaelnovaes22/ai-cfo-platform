// READ-ONLY: mostra outputs de qa_review e qa_gate (publishable, retryTargets,
// qaGateDecision, needsReview) da execução mais recente do grafo monthly-analysis.
// Use para diagnosticar por que uma análise caiu em needsReview / disparou retry.
// Uso: node --env-file=.env scripts/dump-qa.mjs
import { Client } from "langsmith";
const client = new Client();
const project = process.env.LANGSMITH_PROJECT ?? "Aicfo";
const since = new Date(Date.now() - 3 * 3600 * 1000);
const all = [];
const roots = [];
for await (const r of client.listRuns({ projectName: project, startTime: since })) {
  all.push(r);
  if (r.name === "LangGraph" && r.run_type === "chain") roots.push(r);
  if (all.length >= 1500) break;
}
roots.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
const traceId = roots[0].trace_id ?? roots[0].id;
const runs = all
  .filter((r) => (r.trace_id ?? r.id) === traceId && ["qa_review", "qa_gate"].includes(r.name) && r.run_type === "chain")
  .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
for (const r of runs) {
  let full = r;
  try { full = await client.readRun(r.id, { loadChildRuns: false }); } catch { /* */ }
  const o = full.outputs ?? r.outputs ?? {};
  const summary = {
    publishable: o.qaReview?.publishable,
    retryTargets: o.qaReview?.retryTargets,
    issueCodes: o.qaReview?.issues?.map((i) => i.code),
    qaGateDecision: o.qaGateDecision,
    needsReview: o.needsReview,
    retryCount: o.retryCount,
  };
  console.log(`${r.name} (${r.start_time?.slice(11, 19)}):`, JSON.stringify(summary));
}
