import { z } from "zod";
import { callLlm } from "@/llm/index.js";
import { getPrisma } from "@/persistence/prisma.js";
import { buildSystemPrompt, buildUserPrompt } from "@/classification/prompts.js";
import { DRE_CATEGORIES } from "@/classification/taxonomy.js";
import { logger } from "@/observability/logger.js";

const BATCH_SIZE = 20;
const LOW_CONFIDENCE_THRESHOLD = 0.7;

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
    select: { id: true, date: true, description: true, amountCents: true, direction: true },
    orderBy: { date: "asc" },
  });

  if (entries.length === 0) {
    logger.warn({ analysisId }, "Nenhuma entrada para classificar");
    return;
  }

  const systemPrompt = buildSystemPrompt();
  let lowConfidenceCount = 0;

  // Processar em batches de BATCH_SIZE
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);

    const userPrompt = buildUserPrompt(
      batch.map((e) => ({
        entryId:     e.id,
        date:        e.date.toISOString().slice(0, 10),
        description: e.description,
        amountCents: e.amountCents,
        direction:   e.direction,
      })),
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
      logger.error({ err, analysisId, batchStart: i }, "Erro ao classificar batch");
      // Marca entradas do batch como não-classificadas para revisão manual
      await db.ledgerEntry.updateMany({
        where: { id: { in: batch.map((e) => e.id) } },
        data: { predictedCategory: "nao_classificado", correctionSource: "needs_review" },
      });
      continue;
    }

    // Atualizar cada entrada com sua categoria e confiança
    for (const result of parsed) {
      const category = DRE_CATEGORIES.includes(result.category as never)
        ? result.category
        : "nao_classificado";

      const isLowConfidence = result.confidence < LOW_CONFIDENCE_THRESHOLD;
      if (isLowConfidence) lowConfidenceCount++;

      await db.ledgerEntry.update({
        where: { id: result.entryId },
        data: {
          predictedCategory:        category,
          classificationConfidence: result.confidence,
          correctionSource:         isLowConfidence ? "needs_review" : null,
        },
      });
    }

    logger.debug(
      { analysisId, batchStart: i, batchSize: batch.length },
      "Batch classificado",
    );
  }

  // Atualizar status da análise
  const totalEntries = entries.length;
  const classified   = totalEntries - lowConfidenceCount;
  const accuracy     = classified / totalEntries;

  logger.info(
    { analysisId, totalEntries, lowConfidenceCount, accuracy: accuracy.toFixed(2) },
    "Classificação concluída",
  );
}
