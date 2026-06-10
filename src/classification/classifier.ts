import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { callLlm } from "@/llm/index.js";
import { getPrisma } from "@/persistence/prisma.js";
import { buildSystemPrompt, buildUserPrompt } from "@/classification/prompts.js";
import { DRE_CATEGORIES } from "@/classification/taxonomy.js";
import { resolveDirectionFix } from "@/classification/direction-fix.js";
import { enqueueDreNarrative } from "@/queue/index.js";
import { mapWithConcurrency } from "@/shared/concurrency.js";
import { logger } from "@/observability/logger.js";

// BATCH_SIZE fixo em 20: a composição dos batches é a validada pela eval suite
// (evals/classification). Mudar o tamanho muda o prompt por chamada.
const BATCH_SIZE = 20;
const LOW_CONFIDENCE_THRESHOLD = 0.7;

// Paralelismo dos batches LLM — espelha no caminho BullMQ o chunking que o
// LangGraph ganhou no PR #120. Env próprio (não compartilha
// MONTHLY_ANALYSIS_CHUNK_CONCURRENCY) para tunar os caminhos separadamente.
const DEFAULT_BATCH_CONCURRENCY = 4;

function batchConcurrency(): number {
  const raw = process.env.CLASSIFICATION_BATCH_CONCURRENCY;
  const n = raw === undefined ? DEFAULT_BATCH_CONCURRENCY : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_BATCH_CONCURRENCY;
}

const ClassificationResponseSchema = z.array(
  z.object({
    entryId:    z.string(),
    category:   z.string(),
    confidence: z.number().min(0).max(1),
  }),
);

export async function classifyAnalysis(analysisId: string, tenantId: string): Promise<void> {
  const db = getPrisma();

  const entries = await db.ledgerEntry.findMany({
    where: { analysisId, predictedCategory: null },
    select: { id: true, date: true, description: true, amountCents: true, direction: true, directionInferred: true },
    orderBy: { date: "asc" },
  });

  if (entries.length === 0) {
    logger.warn({ analysisId }, "Nenhuma entrada para classificar");
    return;
  }

  // Segment do tenant no prompt (paridade com o nó LangGraph): sem ele, descrições
  // de serviço prestado ("cobertura jornalística", "assessoria mensal") são
  // ambíguas e o modelo erra a natureza receita/despesa — crítico com direction
  // "unknown", onde a semântica é o único sinal.
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { industrySegment: true },
  });
  const segment = tenant?.industrySegment ?? undefined;

  const systemPrompt = buildSystemPrompt();

  // Batches processados em PARALELO (pool com limite): são independentes entre
  // si — slices disjuntos, prompt próprio, writes escopados por id. O wall-clock
  // cai do somatório para o nº de rondas (batches / concurrency).
  const batches: (typeof entries)[] = [];
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    batches.push(entries.slice(i, i + BATCH_SIZE));
  }

  const lowConfidencePerBatch = await mapWithConcurrency(batches, batchConcurrency(), (batch, batchIdx) =>
    classifyBatch({ db, batch, batchIdx, systemPrompt, segment, analysisId, tenantId }),
  );
  const lowConfidenceCount = lowConfidencePerBatch.reduce((sum, n) => sum + n, 0);

  // Atualizar status da análise
  const totalEntries = entries.length;
  const classified   = totalEntries - lowConfidenceCount;
  const accuracy     = classified / totalEntries;

  logger.info(
    { analysisId, totalEntries, lowConfidenceCount, accuracy: accuracy.toFixed(2) },
    "Classificação concluída",
  );

  // Encadeia próxima etapa do pipeline — após TODOS os batches (barreira do pool).
  await enqueueDreNarrative({ analysisId, tenantId });
}

interface BatchEntry {
  id: string;
  date: Date;
  description: string;
  amountCents: number;
  direction: string;
  directionInferred: boolean;
}

/**
 * Classifica um batch: 1 chamada LLM + 1 transação de updates.
 * Retorna o nº de entries com confidence baixa no batch.
 *
 * Falha de LLM degrada SÓ este lote (nao_classificado/needs_review) e não
 * derruba o job — semântica idêntica ao loop serial anterior; um lote ruim
 * não pode transformar degradação parcial em retry total do BullMQ.
 */
async function classifyBatch(args: {
  db: PrismaClient;
  batch: BatchEntry[];
  batchIdx: number;
  systemPrompt: string;
  segment: string | undefined;
  analysisId: string;
  tenantId: string;
}): Promise<number> {
  const { db, batch, batchIdx, systemPrompt, segment, analysisId, tenantId } = args;

  const userPrompt = buildUserPrompt(
    batch.map((e) => ({
      entryId:     e.id,
      date:        e.date.toISOString().slice(0, 10),
      description: e.description,
      amountCents: e.amountCents,
      // Direção inferida (fallback) não é fato — enviar "credit" enviesaria o
      // modelo a classificar despesas como receita. "unknown" força semântica.
      direction:   e.directionInferred ? "unknown" : e.direction,
    })),
    segment,
  );

  let parsed: z.infer<typeof ClassificationResponseSchema>;

  try {
    const response = await callLlm({
      task: "classification",
      systemPrompt,
      userPrompt,
      tenantId,
      jsonMode: true,
    });

    parsed = ClassificationResponseSchema.parse(JSON.parse(response.content));
  } catch (err) {
    logger.error({ err, analysisId, batchIdx }, "Erro ao classificar batch");
    // Marca entradas do batch como não-classificadas para revisão manual
    await db.ledgerEntry.updateMany({
      where: { id: { in: batch.map((e) => e.id) } },
      data: { predictedCategory: "nao_classificado", correctionSource: "needs_review" },
    });
    return 0;
  }

  // Defesa C8: o entryId vem do LLM e NÃO é confiável. Atualizar só IDs que
  // (a) pertencem ao batch atual, (b) pertencem à mesma análise e (c) pertencem
  // ao tenant. Qualquer ID alucinado/forjado é silenciosamente descartado.
  const batchById = new Map(batch.map((e) => [e.id, e]));

  let lowConfidence = 0;
  const updates: Prisma.PrismaPromise<Prisma.BatchPayload>[] = [];
  const updatedEntryIds: string[] = [];

  for (const result of parsed) {
    if (!batchById.has(result.entryId)) {
      logger.warn(
        { analysisId, suspiciousId: result.entryId, batchIdx },
        "Classifier retornou entryId fora do batch — descartado",
      );
      continue;
    }

    const category = DRE_CATEGORIES.includes(result.category as never)
      ? result.category
      : "nao_classificado";

    const isLowConfidence = result.confidence < LOW_CONFIDENCE_THRESHOLD;
    if (isLowConfidence) lowConfidence++;

    // Direção inferida (fallback do parser) + categoria com natureza contrária →
    // a categoria vence e a direção é corrigida (ver direction-fix.ts).
    const entry = batchById.get(result.entryId)!;
    const directionFix = resolveDirectionFix(entry, category) ?? {};
    if ("direction" in directionFix) {
      logger.info(
        { analysisId, entryId: result.entryId, from: entry.direction, to: directionFix.direction, category },
        "Classifier corrigiu direção inferida pela natureza da categoria",
      );
    }

    // updateMany com where composto: id + analysisId + tenantId.
    // Se algum não bater, 0 linhas são afetadas (não levanta exceção).
    updates.push(
      db.ledgerEntry.updateMany({
        where: { id: result.entryId, analysisId, tenantId },
        data: {
          predictedCategory:        category,
          classificationConfidence: result.confidence,
          correctionSource:         isLowConfidence ? "needs_review" : null,
          ...directionFix,
        },
      }),
    );
    updatedEntryIds.push(result.entryId);
  }

  // Transação única por batch: atomicidade (falha no meio não deixa estado
  // parcial que forçaria re-chamada LLM duplicada no retry do job) e elimina
  // round-trips de banco intercalados com lógica JS.
  if (updates.length > 0) {
    const results = await db.$transaction(updates);
    results.forEach((updated, i) => {
      if (updated.count === 0) {
        logger.warn(
          { analysisId, entryId: updatedEntryIds[i], tenantId },
          "Classifier tentou atualizar entry fora de tenant+analysis — descartado",
        );
      }
    });
  }

  logger.debug(
    { analysisId, batchIdx, batchSize: batch.length },
    "Batch classificado",
  );

  return lowConfidence;
}
