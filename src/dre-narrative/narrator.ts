import { z } from "zod";
import { getPrisma } from "@/persistence/prisma.js";
import { callLlm } from "@/llm/index.js";
import { aggregateDre } from "@/dre-narrative/aggregator.js";
import { buildNarrativeSystemPrompt, buildNarrativeUserPrompt } from "@/dre-narrative/prompts.js";
import { normalizeNarrativeCards } from "@/dre-narrative/postprocess.js";
import { enqueueActionPlan } from "@/queue/index.js";
import { logger } from "@/observability/logger.js";
import { detectFinancialAnomalies } from "@/monthly-analysis/agents/financial-diagnosis.js";
import type { DreLines } from "@/dre-narrative/aggregator.js";

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

  // Carregar análise + tenant + DRE do mês anterior (para sinais MoM)
  const [analysis, tenant] = await Promise.all([
    db.monthlyAnalysis.findUniqueOrThrow({ where: { id: analysisId } }),
    db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
  ]);

  const config = (tenant.productConfig as Record<string, unknown>)?.monthlyAnalysis as
    Record<string, string> | undefined;

  const toneOfVoice = config?.toneOfVoice ?? "formal";

  // Carregar lançamentos classificados + análise anterior para sinais MoM
  const [entries, previousAnalysis] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { analysisId },
      select: { amountCents: true, direction: true, predictedCategory: true, confirmedCategory: true },
    }),
    db.monthlyAnalysis.findFirst({
      where: {
        tenantId,
        referenceMonth: { lt: analysis.referenceMonth },
        status: { in: ["ready", "delivered", "approved"] },
      },
      orderBy: { referenceMonth: "desc" },
      select: { dreJson: true },
    }),
  ]);

  // 1. Agregação determinística (sem LLM)
  const dre = aggregateDre(entries);

  // 1b. Detecção de anomalias (determinística — sem LLM)
  const previousDre = previousAnalysis?.dreJson != null
    ? (previousAnalysis.dreJson as DreLines)
    : undefined;

  const normalizedEntries = entries.map((e, i) => ({
    entryId: String(i),
    date: new Date().toISOString().slice(0, 10),
    description: "",
    normalizedDescription: "",
    amountCents: e.amountCents,
    direction: e.direction === "credit" ? ("in" as const) : ("out" as const),
    documentType: ("unknown" as const),
    features: [] as string[],
    noiseFlags: [] as string[],
  }));

  const anomalies = detectFinancialAnomalies({
    dre,
    normalizedEntries,
    segment: tenant.industrySegment,
    previousDre,
  });

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
  const cards = normalizeNarrativeCards(parsed.cards, dre, tenant.industrySegment, toneOfVoice);

  // 3. Persistir NarrativeCards + anomalias + atualizar MonthlyAnalysis
  await db.$transaction(async (tx) => {
    // Limpa cards anteriores (re-geração)
    await tx.narrativeCard.deleteMany({ where: { analysisId } });

    await tx.narrativeCard.createMany({
      data: cards.map((card) => ({
        analysisId,
        cardType: card.type,
        title: card.title,
        body: card.body,
        // NarrativeEvidence[] é serializável; Prisma exige InputJsonValue.
        evidence: card.evidence as unknown as object,
      })),
    });

    await tx.monthlyAnalysis.update({
      where: { id: analysisId },
      data: {
        dreJson:       dre as unknown as object,
        anomaliesJson: anomalies as unknown as object,
        narrativeJson: cards as unknown as object,
        costCents:     (analysis.costCents ?? 0) + llmResponse.costCents,
        traceId: llmResponse.traceId,
      },
    });
  });

  logger.info(
    {
      analysisId,
      costCents: llmResponse.costCents,
      cards: cards.map((c) => c.type),
      anomaliesCount: anomalies.length,
      anomaliesHigh: anomalies.filter((a) => a.severity === "high").length,
    },
    "Narrativa DRE gerada",
  );

  // 4. Enfileirar próxima etapa
  await enqueueActionPlan({ analysisId, tenantId, dre });
}
