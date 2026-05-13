import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { callLlm } from "@/llm/index.js";
import { aggregateDre } from "@/dre-narrative/aggregator.js";
import { buildNarrativeSystemPrompt, buildNarrativeUserPrompt } from "@/dre-narrative/prompts.js";
import { enqueueActionPlan } from "@/queue/index.js";
import { logger } from "@/observability/logger.js";

const CardSchema = z.object({
  type: z.enum(["critical_gap", "attention", "healthy"]),
  title: z.string(),
  body: z.string(),
  evidence: z.array(z.object({
    metric: z.string(),
    value: z.number(),
    unit: z.string(),
  })),
});

const NarrativeResponseSchema = z.object({
  cards: z.array(CardSchema).length(3),
});

export async function generateDreNarrative(analysisId: string, tenantId: string): Promise<void> {
  const db = getPrisma();

  // Carregar análise + tenant
  const [analysis, tenant] = await Promise.all([
    db.monthlyAnalysis.findUniqueOrThrow({ where: { id: analysisId } }),
    db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
  ]);

  const config = (tenant.productConfig as Record<string, unknown>)?.monthlyAnalysis as
    Record<string, string> | undefined;

  const toneOfVoice = config?.toneOfVoice ?? "formal";

  // Carregar lançamentos classificados
  const entries = await db.ledgerEntry.findMany({
    where: { analysisId },
    select: { amountCents: true, direction: true, predictedCategory: true, confirmedCategory: true },
  });

  // 1. Agregação determinística (sem LLM)
  const dre = aggregateDre(entries);

  // 2. Geração de narrativa via LLM (Gemini 2.5 Flash — C7)
  const llmResponse = await callLlm({
    task: "dre-narrative",
    systemPrompt: buildNarrativeSystemPrompt(),
    userPrompt: buildNarrativeUserPrompt({
      dre,
      referenceMonth: analysis.referenceMonth,
      segment: tenant.industrySegment,
      taxRegime: tenant.taxRegime,
      toneOfVoice,
    }),
    tenantId,
    jsonMode: true,
  });

  const parsed = NarrativeResponseSchema.parse(JSON.parse(llmResponse.content));

  // 3. Persistir NarrativeCards + atualizar MonthlyAnalysis
  await db.$transaction(async (tx) => {
    // Limpa cards anteriores (re-geração)
    await tx.narrativeCard.deleteMany({ where: { analysisId } });

    await tx.narrativeCard.createMany({
      data: parsed.cards.map((card) => ({
        analysisId,
        cardType: card.type,
        title: card.title,
        body: card.body,
        evidence: card.evidence,
      })),
    });

    await tx.monthlyAnalysis.update({
      where: { id: analysisId },
      data: {
        // DreLines/parsed.cards são serializáveis em JSON; Prisma exige InputJsonValue.
        // Cast explícito porque DreLines não declara index signature (mas é puro number/string).
        dreJson:       dre as unknown as object,
        narrativeJson: parsed.cards as unknown as object,
        costCents:     (analysis.costCents ?? 0) + llmResponse.costCents,
        langfuseTraceId: llmResponse.traceId,
      },
    });
  });

  logger.info(
    { analysisId, costCents: llmResponse.costCents, cards: parsed.cards.map((c) => c.type) },
    "Narrativa DRE gerada",
  );

  // 4. Enfileirar próxima etapa
  await enqueueActionPlan({ analysisId, tenantId, dre });
}
