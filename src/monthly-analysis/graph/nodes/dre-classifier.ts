import {
  applyClarityCaps,
  runDreClassificationAgentWithTelemetry,
} from "@/monthly-analysis/agents/classification.js";
import { runChunkedWithTelemetry } from "@/monthly-analysis/agents/chunk-runner.js";
import { buildAgentTelemetry } from "@/monthly-analysis/graph/instrumentation.js";
import type { EntryForClassification } from "@/classification/prompts.js";
import { inferBusinessProfile } from "@/classification/business-profile.js";
import { CATEGORY_NATURE, type DreCategory } from "@/classification/taxonomy.js";
import { DIRECTION_SAFEGUARD_CONFIDENCE } from "@/classification/direction-fix.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";

const NATURE_TO_FLOW = { credit: "in", debit: "out" } as const;

export async function dreClassifierNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  // Direção inferida (parser sem marcação de sentido) não é fato — enviar o credit
  // chutado enviesaria o modelo a classificar despesas como receita.
  const inferredById = new Set(
    (state.rawEntries ?? []).filter((r) => r.directionInferred === true).map((r) => r.entryId),
  );
  // Categoria confirmada na origem (PDF de DRE do contador) é fato: pula o LLM e
  // não entra no write-back — paridade com shouldSkipClassification do BullMQ.
  // O aggregate-dre usa a confirmada com precedência (rawEntries → rows).
  const confirmedIds = new Set(
    (state.rawEntries ?? [])
      .filter((r) => r.confirmedCategory != null && r.confirmedCategory !== "")
      .map((r) => r.entryId),
  );
  if (confirmedIds.size > 0) {
    logger.info(
      { analysisId: state.analysisId, confirmedCount: confirmedIds.size },
      "monthly-analysis.dre-classifier: entries com categoria confirmada na origem — puladas do LLM",
    );
  }
  const inputs: EntryForClassification[] = (state.normalizedEntries ?? [])
    .filter((entry) => !confirmedIds.has(entry.entryId))
    .map((entry) => ({
      entryId: entry.entryId,
      date: entry.date,
      description: entry.normalizedDescription,
      amountCents: entry.amountCents,
      direction: inferredById.has(entry.entryId) ? "unknown" : entry.direction,
    }));
  const tenantFacts = (state.tenantMemory?.facts ?? [])
    .filter((f): f is { content: { description: string; category: string }; confidence: number } =>
      typeof (f.content as Record<string, unknown>)?.description === "string" &&
      typeof (f.content as Record<string, unknown>)?.category === "string"
    )
    .map((f) => ({
      description: (f.content as { description: string; category: string }).description,
      category: (f.content as { description: string; category: string }).category,
    }));

  // Perfil do negócio inferido das descrições (1 chamada curta): diz quais
  // lançamentos são a receita-fim deste negócio, evitando que serviços vendidos
  // virem despesa quando a direção é "unknown".
  const businessProfile = await inferBusinessProfile(inputs, {
    tenantId: state.tenantId,
    traceId: state.traceId,
  });

  // Lotes paralelos: tenantFacts + segment + businessProfile vão a todos os lotes
  // para manter a consistência de categoria entre eles (ver chunk-runner.ts).
  const { data: classifications, response, latencyMs } = await runChunkedWithTelemetry(
    inputs,
    {
      tenantId: state.tenantId,
      traceId: state.traceId,
      segment: state.segment,
      tenantFacts,
      businessProfile,
    },
    runDreClassificationAgentWithTelemetry,
  );
  const finalClassifications =
    state.clarityResults && state.clarityResults.length > 0
      ? applyClarityCaps(classifications, state.clarityResults)
      : classifications;

  const { costs, traces } = buildAgentTelemetry({
    agent: "dre-classification",
    response,
    latencyMs,
    inputPayload: inputs,
    outputPayload: finalClassifications,
  });

  // Correção de direção inferida: quando a categoria prevista tem natureza
  // contrária à direção chutada no parse, a categoria vence. Direção confiável
  // (extrato com sinal, coluna Tipo, manual) NUNCA é sobrescrita.
  const directionFixById = new Map<string, "credit" | "debit">();
  // Salvaguarda: direção confiável que contradiz a natureza da categoria com alta
  // confiança não é sobrescrita, mas é marcada para revisão humana.
  const reviewByDirection = new Set<string>();
  for (const c of finalClassifications) {
    const nature = CATEGORY_NATURE[c.category as DreCategory] ?? null;
    const current = (state.normalizedEntries ?? []).find((e) => e.entryId === c.entryId)?.direction;
    const contradicts = nature !== null && current !== undefined && NATURE_TO_FLOW[nature] !== current;
    if (!contradicts) continue;

    if (inferredById.has(c.entryId)) {
      directionFixById.set(c.entryId, nature!);
      logger.info(
        { analysisId: state.analysisId, entryId: c.entryId, to: nature, category: c.category },
        "monthly-analysis.dre-classifier: direção inferida corrigida pela natureza da categoria",
      );
    } else if (c.confidence >= DIRECTION_SAFEGUARD_CONFIDENCE) {
      reviewByDirection.add(c.entryId);
      logger.warn(
        { analysisId: state.analysisId, entryId: c.entryId, category: c.category, confidence: c.confidence },
        "monthly-analysis.dre-classifier: categoria contradiz direção confiável — marcado para revisão",
      );
    }
  }

  // Flywheel de treinamento: persiste predição + confiança para cada lançamento.
  // Usado por SelfHarnessWorker (ADR-011 Etapa 4) para construir dataset rotulado.
  // Falha não-bloqueante: o pipeline continua mesmo se o write-back falhar.
  if (finalClassifications.length > 0) {
    try {
      const db = getPrisma();
      const results = await Promise.allSettled(
        finalClassifications.map((c) => {
          const directionFix = directionFixById.has(c.entryId)
            ? { direction: directionFixById.get(c.entryId) }
            : {};
          const reviewFix = reviewByDirection.has(c.entryId)
            ? { correctionSource: "needs_review" }
            : {};
          return db.ledgerEntry.updateMany({
            // analysisId escopa o write-back à análise atual: um entryId alucinado
            // pelo LLM não pode sobrescrever lançamento de outra análise do tenant.
            where: { id: c.entryId, tenantId: state.tenantId, analysisId: state.analysisId },
            data: {
              predictedCategory: c.category,
              classificationConfidence: c.confidence,
              ...directionFix,
              ...reviewFix,
            },
          });
        }),
      );
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        logger.warn(
          { analysisId: state.analysisId, tenantId: state.tenantId, failedCount: failed.length },
          "monthly-analysis.dre-classifier: falha ao persistir predictedCategory em alguns lançamentos",
        );
      }
    } catch (err) {
      logger.warn(
        { analysisId: state.analysisId, tenantId: state.tenantId, err },
        "monthly-analysis.dre-classifier: write-back de predictedCategory indisponível",
      );
    }
  }

  // Propaga a direção corrigida para os nós downstream (financial-diagnosis,
  // cashflow-risk) — o estado é a fonte deles, não o banco.
  const correctedNormalizedEntries =
    directionFixById.size > 0
      ? (state.normalizedEntries ?? []).map((e) => {
          const nature = directionFixById.get(e.entryId);
          return nature ? { ...e, direction: NATURE_TO_FLOW[nature] } : e;
        })
      : undefined;

  return {
    classifiedEntries: finalClassifications,
    costs,
    traces,
    ...(correctedNormalizedEntries ? { normalizedEntries: correctedNormalizedEntries } : {}),
  };
}
