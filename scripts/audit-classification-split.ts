// READ-ONLY: estima a fração de lançamentos classificados pelo LLM (camada 4) vs
// resolvidos deterministicamente (origem/flywheel/regra — camadas 1-3) por trace.
//
// Uso:  tsx --env-file=.env scripts/audit-classification-split.ts [dias=7]
//
// Método: por trace_id, total = nº de entries no output do nó `normalize`;
// llm = nº de entries no input do nó `dre-classification` (só os ambíguos vão ao LLM).
// rule/confirmado = total − llm. Conta SÓ tamanhos de array — nenhum conteúdo é lido (LGPD).
// O número exato vive no log Pino (ruleClassified/llmClassified/total); isto é uma
// aproximação via telemetria enquanto esses contadores não vão ao metadata do trace.

import { Client } from "langsmith";

const days = Number(process.argv[2] ?? 7);
if (!process.env.LANGSMITH_API_KEY && !process.env.LANGCHAIN_API_KEY) {
  console.error("ERRO: LANGSMITH_API_KEY ausente no .env.");
  process.exit(1);
}
const projectName = process.env.LANGSMITH_PROJECT ?? "aicfo";
const since = new Date(Date.now() - days * 24 * 3600 * 1000);

interface Run {
  trace_id?: string;
  id?: string;
  name?: string;
  inputs?: unknown;
  outputs?: unknown;
}

// Maior array encontrado recursivamente num objeto (robusto à forma do payload).
function largestArrayLen(obj: unknown, depth = 0): number {
  if (depth > 6 || obj == null) return 0;
  if (Array.isArray(obj)) {
    let best = obj.length;
    for (const v of obj) best = Math.max(best, largestArrayLen(v, depth + 1));
    return best;
  }
  if (typeof obj === "object") {
    let best = 0;
    for (const v of Object.values(obj as Record<string, unknown>)) {
      best = Math.max(best, largestArrayLen(v, depth + 1));
    }
    return best;
  }
  return 0;
}

async function main() {
  const client = new Client();
  // total[trace] = entries do normalize; llm[trace] = entries enviados ao dre-classification
  const totalByTrace = new Map<string, number>();
  const llmByTrace = new Map<string, number>();
  let scanned = 0;

  for await (const raw of client.listRuns({ projectName, startTime: since })) {
    const run = raw as Run;
    scanned += 1;
    const name = (run.name ?? "").toLowerCase();
    const tid = run.trace_id ?? run.id ?? "?";
    if (name === "normalize" || name === "normalization") {
      const n = largestArrayLen(run.outputs) || largestArrayLen(run.inputs);
      if (n > 0) totalByTrace.set(tid, Math.max(totalByTrace.get(tid) ?? 0, n));
    } else if (name === "dre-classification" || name === "dre_classifier" || name === "classification") {
      const n = largestArrayLen(run.inputs);
      if (n > 0) llmByTrace.set(tid, (llmByTrace.get(tid) ?? 0) + n); // soma chunks
    }
    if (scanned >= 20000) break;
  }

  // Pareia por trace: só traces com total conhecido contam para a fração.
  const perTrace: { trace: string; total: number; llm: number; rulePct: number }[] = [];
  let sumTotal = 0;
  let sumLlm = 0;
  for (const [tid, total] of totalByTrace.entries()) {
    const llm = Math.min(llmByTrace.get(tid) ?? 0, total);
    sumTotal += total;
    sumLlm += llm;
    perTrace.push({
      trace: tid.slice(0, 8),
      total,
      llm,
      rulePct: total > 0 ? Number((((total - llm) / total) * 100).toFixed(1)) : 0,
    });
  }
  perTrace.sort((a, b) => b.total - a.total);

  // Bucket "regra disparou" (rulePct>0): exclui datasets sintéticos onde nada casa
  // (assinatura do eval). Sinal mais próximo de dados reais de cliente.
  const fired = perTrace.filter((t) => t.llm < t.total);
  const firedTotal = fired.reduce((s, t) => s + t.total, 0);
  const firedLlm = fired.reduce((s, t) => s + t.llm, 0);

  // Distribuição de tamanhos (revela o cluster sintético, ex: muitos traces de 77).
  const sizeHist: Record<string, number> = {};
  for (const t of perTrace) sizeHist[String(t.total)] = (sizeHist[String(t.total)] ?? 0) + 1;
  const topSizes = Object.entries(sizeHist)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([size, n]) => ({ entries_per_trace: Number(size), traces: n }));

  const result = {
    window_days: days,
    project: projectName,
    pii: "none — counts only",
    all_traces: {
      traces: perTrace.length,
      entries_total: sumTotal,
      pct_to_llm: sumTotal > 0 ? Number(((sumLlm / sumTotal) * 100).toFixed(1)) : null,
    },
    rules_fired_only: {
      traces: fired.length,
      entries_total: firedTotal,
      entries_llm: firedLlm,
      pct_to_llm: firedTotal > 0 ? Number(((firedLlm / firedTotal) * 100).toFixed(1)) : null,
      pct_deterministic: firedTotal > 0 ? Number((((firedTotal - firedLlm) / firedTotal) * 100).toFixed(1)) : null,
    },
    pure_llm_traces: {
      traces: perTrace.length - fired.length,
      entries_total: sumTotal - firedTotal,
      note: "rulePct=0 — provável dataset sintético/eval (nada casou nas regras)",
    },
    size_distribution_top: topSizes,
    note: "Aproximação via telemetria. Exato está no log Pino (ruleClassified/llmClassified). 'rules_fired_only' aproxima dados reais.",
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error("Falha:", e?.message ?? e);
  process.exit(1);
});
