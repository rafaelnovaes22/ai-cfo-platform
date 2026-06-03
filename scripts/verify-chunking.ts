// Verificação dirigida do chunking contra LLM real (AI Studio via GOOGLE_API_KEY).
// Uso: tsx --env-file=.env scripts/verify-chunking.ts
// Compara dre-classification em LOTES paralelos vs CHAMADA ÚNICA sobre os mesmos
// lançamentos. Confirma: (1) todos os entryId voltam, (2) categorias válidas,
// (3) taxa de concordância chunked↔single (risco de inconsistência entre lotes).

import { runChunkedWithTelemetry } from "@/monthly-analysis/agents/chunk-runner.js";
import { runDreClassificationAgentWithTelemetry } from "@/monthly-analysis/agents/classification.js";
import { DRE_CATEGORIES } from "@/classification/taxonomy.js";
import type { EntryForClassification } from "@/classification/prompts.js";

const TEMPLATES: Array<{ desc: string; cents: number; dir: "credit" | "debit" }> = [
  { desc: "PIX RECEBIDO CLIENTE REF NF", cents: 480000, dir: "credit" },
  { desc: "PAGAMENTO FORNECEDOR MATERIA PRIMA", cents: 120000, dir: "debit" },
  { desc: "FOLHA SALARIO FUNCIONARIO", cents: 350000, dir: "debit" },
  { desc: "ALUGUEL LOJA MENSAL", cents: 90000, dir: "debit" },
  { desc: "TARIFA BANCARIA MANUTENCAO CONTA", cents: 4500, dir: "debit" },
  { desc: "CONTA DE ENERGIA ELETRICA", cents: 38000, dir: "debit" },
];

const N = 24;
const entries: EntryForClassification[] = Array.from({ length: N }, (_, i) => {
  const t = TEMPLATES[i % TEMPLATES.length]!;
  return {
    entryId: `e-${String(i + 1).padStart(3, "0")}`,
    date: "2026-04-10",
    description: `${t.desc} ${1000 + i}`,
    amountCents: t.cents,
    direction: t.dir,
  };
});

const options = { tenantId: "verify-chunking", segment: "comercio_varejo" };

function validate(label: string, data: { entryId: string; category: string }[]): Map<string, string> {
  const byId = new Map(data.map((d) => [d.entryId, d.category]));
  const missing = entries.filter((e) => !byId.has(e.entryId)).map((e) => e.entryId);
  const invalid = data.filter((d) => !DRE_CATEGORIES.includes(d.category as never));
  console.log(`\n[${label}] devolvidos=${data.length}/${N} | faltando=${missing.length} | categorias inválidas=${invalid.length}`);
  if (missing.length) console.log(`  FALTANDO: ${missing.join(", ")}`);
  if (invalid.length) console.log(`  INVÁLIDAS: ${invalid.map((d) => `${d.entryId}=${d.category}`).join(", ")}`);
  return byId;
}

async function main(): Promise<void> {
  console.log(`Verificando chunking: ${N} lançamentos, chunkSize=8 (3 lotes) vs chamada única\n`);

  const tChunked = Date.now();
  const chunked = await runChunkedWithTelemetry(
    entries,
    options,
    runDreClassificationAgentWithTelemetry,
    { chunkSize: 8, concurrency: 3 },
  );
  const chunkedMs = Date.now() - tChunked;

  const tSingle = Date.now();
  const single = await runChunkedWithTelemetry(
    entries,
    options,
    runDreClassificationAgentWithTelemetry,
    { chunkSize: 100 }, // força 1 lote = comportamento pré-mudança
  );
  const singleMs = Date.now() - tSingle;

  const chunkedById = validate("CHUNKED (3 lotes)", chunked.data);
  const singleById = validate("SINGLE (1 lote)", single.data);

  // Concordância de categoria entre as duas estratégias.
  let agree = 0;
  const diffs: string[] = [];
  for (const e of entries) {
    const c = chunkedById.get(e.entryId);
    const s = singleById.get(e.entryId);
    if (c && s && c === s) agree += 1;
    else if (c && s) diffs.push(`${e.entryId}: chunked=${c} single=${s}`);
  }
  const agreement = ((agree / N) * 100).toFixed(1);

  console.log(`\n────────── resultado ──────────`);
  console.log(`  wall-clock chunked: ${(chunkedMs / 1000).toFixed(1)}s | single: ${(singleMs / 1000).toFixed(1)}s`);
  console.log(`  tokens chunked: in=${chunked.response.inputTokens} out=${chunked.response.outputTokens} | single: in=${single.response.inputTokens} out=${single.response.outputTokens}`);
  console.log(`  concordância de categoria chunked↔single: ${agreement}% (${agree}/${N})`);
  if (diffs.length) {
    console.log(`  divergências (${diffs.length}):`);
    for (const d of diffs) console.log(`    · ${d}`);
  }
}

main().catch((err) => {
  console.error("erro:", err);
  process.exit(1);
});
