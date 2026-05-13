import { z } from "zod";
import { callLlm } from "@/llm/index.js";
import { getPrisma } from "@/persistence/prisma.js";
import { buildSystemPrompt, buildUserPrompt } from "@/classification/prompts.js";
import { DRE_CATEGORIES } from "@/classification/taxonomy.js";
import { enqueueDreNarrative } from "@/queue/index.js";
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

    // Defesa C8: o entryId vem do LLM e NÃO é confiável. Atualizar só IDs que
    // (a) pertencem ao batch atual, (b) pertencem à mesma análise e (c) pertencem
    // ao tenant. Qualquer ID alucinado/forjado é silenciosamente descartado.
    const batchIds = new Set(batch.map((e) => e.id));

    for (const result of parsed) {
      if (!batchIds.has(result.entryId)) {
        logger.warn(
          { analysisId, suspiciousId: result.entryId, batchStart: i },
          "Classifier retornou entryId fora do batch — descartado",
        );
        continue;
      }

      const category = DRE_CATEGORIES.includes(result.category as never)
        ? result.category
        : "nao_classificado";

      const isLowConfidence = result.confidence < LOW_CONFIDENCE_THRESHOLD;
      if (isLowConfidence) lowConfidenceCount++;

      // updateMany com where composto: id + analysisId + tenantId.
      // Se algum não bater, 0 linhas são afetadas (não levanta exceção).
      const updated = await db.ledgerEntry.updateMany({
        where: { id: result.entryId, analysisId, tenantId },
        data: {
          predictedCategory:        category,
          classificationConfidence: result.confidence,
          correctionSource:         isLowConfidence ? "needs_review" : null,
        },
      });
      if (updated.count === 0) {
        logger.warn(
          { analysisId, entryId: result.entryId, tenantId },
          "Classifier tentou atualizar entry fora de tenant+analysis — descartado",
        );
      }
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

  // Encadeia próxima etapa do pipeline
  await enqueueDreNarrative({ analysisId, tenantId });
}
