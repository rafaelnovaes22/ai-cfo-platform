import {
  applyClarityCaps,
  runDreClassificationAgentWithTelemetry,
} from "@/monthly-analysis/agents/classification.js";
import { runChunkedWithTelemetry } from "@/monthly-analysis/agents/chunk-runner.js";
import {
  buildAgentTelemetry,
  buildRuleBasedTrace,
} from "@/monthly-analysis/graph/instrumentation.js";
import type { EntryForClassification } from "@/classification/prompts.js";
import { inferBusinessProfile } from "@/classification/business-profile.js";
import { classifyByRule, isDiscriminativeDescription } from "@/classification/rule-classifier.js";
import { normalizeDescription } from "@/ingest/normalize.js";
import {
  CATEGORY_NATURE,
  DRE_CATEGORIES,
  type DreCategory,
} from "@/classification/taxonomy.js";
import type {
  AgentCost,
  AgentTrace,
  DreClassificationResult,
} from "@/monthly-analysis/schemas/agents.js";
import { DIRECTION_SAFEGUARD_CONFIDENCE } from "@/classification/direction-fix.js";
import type { MonthlyAnalysisState } from "@/monthly-analysis/graph/state.js";
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";

const NATURE_TO_FLOW = { credit: "in", debit: "out" } as const;
const FLOW_TO_NATURE = { in: "credit", out: "debit" } as const;

export async function dreClassifierNode(
  state: MonthlyAnalysisState,
): Promise<Partial<MonthlyAnalysisState>> {
  // Direção inferida (parser sem marcação de sentido) não é fato — enviar o credit
  // chutado enviesaria o modelo a classificar despesas como receita.
  const inferredById = new Set(
    (state.rawEntries ?? []).filter((r) => r.directionInferred === true).map((r) => r.entryId),
  );
  // Categoria confirmada na origem (PDF de DRE do contador) é fato: pula o LLM e
  // não entra no write-back. O aggregate-dre usa a confirmada com precedência
  // (rawEntries → rows).
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
  const tenantFacts = (state.tenantMemory?.facts ?? [])
    .filter((f): f is { content: { description: string; category: string }; confidence: number } =>
      typeof (f.content as Record<string, unknown>)?.description === "string" &&
      typeof (f.content as Record<string, unknown>)?.category === "string"
    )
    .map((f) => ({
      description: (f.content as { description: string; category: string }).description,
      category: (f.content as { description: string; category: string }).category,
    }));

  // Pré-classificador determinístico: termos inequívocos (aluguel, pró-labore,
  // DAS, contador...) e correções idênticas que o cliente já fez (flywheel)
  // recebem categoria por regra com confiança 1.0 e PULAM o LLM. Reduz a
  // superfície probabilística do financeiro. Roda depois de confirmedIds (origem
  // manda) e antes de montar os inputs do modelo.
  // Flywheel só memoriza descrições DISCRIMINATIVAS: uma correção de "Pagamento"
  // (genérico) não é transferível ao próximo "Pagamento". Conflito (mesma descrição
  // → categorias diferentes em facts distintos) é sinal de que a descrição não
  // discrimina — descarta a chave em vez de aplicar uma categoria arbitrária com 1.0.
  const factByDesc = new Map<string, string>();
  const conflictingDesc = new Set<string>();
  for (const f of tenantFacts) {
    if (!DRE_CATEGORIES.includes(f.category as DreCategory)) continue;
    if (!isDiscriminativeDescription(f.description)) continue;
    const key = normalizeDescription(f.description);
    const existing = factByDesc.get(key);
    if (existing && existing !== f.category) conflictingDesc.add(key);
    else if (!existing) factByDesc.set(key, f.category);
  }
  for (const k of conflictingDesc) factByDesc.delete(k);
  // Categoria confirmada na origem, por entryId — vira contexto do batch do LLM.
  const confirmedCatById = new Map(
    (state.rawEntries ?? [])
      .filter((r) => r.confirmedCategory != null && r.confirmedCategory !== "")
      .map((r) => [r.entryId, r.confirmedCategory as string]),
  );
  const ruleById = new Map<string, DreClassificationResult>();
  // Lançamentos resolvidos sem LLM (origem/flywheel/regra) viajam como CONTEXTO ao
  // classificador: repõem a âncora do negócio que o pré-classificador tira do batch,
  // sem reabri-los para reclassificação (corrige a regressão em ambíguos como
  // "Microfone novo"/"Alimentação reunião", que perdiam contexto).
  const contextEntries: { description: string; category: string }[] = [];
  for (const entry of state.normalizedEntries ?? []) {
    if (confirmedIds.has(entry.entryId)) {
      const conf = confirmedCatById.get(entry.entryId);
      if (conf) contextEntries.push({ description: entry.normalizedDescription, category: conf });
      continue;
    }
    // 1. Flywheel: descrição idêntica já corrigida pelo cliente tem precedência.
    const factCat = factByDesc.get(normalizeDescription(entry.normalizedDescription));
    if (factCat) {
      ruleById.set(entry.entryId, { entryId: entry.entryId, category: factCat, confidence: 1 });
      contextEntries.push({ description: entry.normalizedDescription, category: factCat });
      continue;
    }
    // 2. Regra por termo-âncora inequívoco (null = ambíguo/sem regra → LLM).
    // Converte fluxo do extrato (in/out) → natureza contábil (credit/debit) que a
    // regra e CATEGORY_NATURE falam; direção inferida vira "unknown" (não é fato).
    const dir = inferredById.has(entry.entryId)
      ? "unknown"
      : FLOW_TO_NATURE[entry.direction];
    const rule = classifyByRule(entry.normalizedDescription, dir);
    if (rule) {
      ruleById.set(entry.entryId, {
        entryId: entry.entryId,
        category: rule.category,
        confidence: rule.confidence,
      });
      contextEntries.push({ description: entry.normalizedDescription, category: rule.category });
    }
  }
  // Amostra distinta e limitada — é contexto, não o batch inteiro (não inflar prompt).
  const seenCtx = new Set<string>();
  const contextSample = contextEntries
    .filter((c) => {
      const k = c.description.toLowerCase();
      if (seenCtx.has(k)) return false;
      seenCtx.add(k);
      return true;
    })
    .slice(0, 50);

  const inputs: EntryForClassification[] = (state.normalizedEntries ?? [])
    .filter((entry) => !confirmedIds.has(entry.entryId) && !ruleById.has(entry.entryId))
    .map((entry) => ({
      entryId: entry.entryId,
      date: entry.date,
      description: entry.normalizedDescription,
      amountCents: entry.amountCents,
      direction: inferredById.has(entry.entryId) ? "unknown" : entry.direction,
    }));

  // Perfil inferido de TODOS os lançamentos não-confirmados (regra + ambíguos), não
  // só dos ambíguos: sem as despesas óbvias o perfil do negócio fica pobre e degrada
  // a distinção receita/despesa dos itens que sobram para o LLM.
  const profileEntries = (state.normalizedEntries ?? [])
    .filter((entry) => !confirmedIds.has(entry.entryId))
    .map((entry) => ({ description: entry.normalizedDescription }));

  const ruleClassifications = [...ruleById.values()];
  if (ruleClassifications.length > 0) {
    logger.info(
      {
        analysisId: state.analysisId,
        ruleClassified: ruleClassifications.length,
        llmClassified: inputs.length,
        total: ruleClassifications.length + inputs.length,
      },
      "monthly-analysis.dre-classifier: lançamentos resolvidos por regra determinística (pulam o LLM)",
    );
  }

  // Só chama o LLM se sobrou item ambíguo. Tudo resolvido por regra/origem →
  // pula o modelo (zero custo, zero latência), emitindo só o trace rule-based.
  let businessProfile: string | undefined;
  let llmClassifications: DreClassificationResult[] = [];
  let costs: AgentCost[];
  let traces: AgentTrace[];
  if (inputs.length > 0) {
    // Perfil do negócio inferido das descrições (1 chamada curta): diz quais
    // lançamentos são a receita-fim deste negócio, evitando que serviços vendidos
    // virem despesa quando a direção é "unknown".
    businessProfile = await inferBusinessProfile(profileEntries, {
      tenantId: state.tenantId,
      traceId: state.traceId,
    });

    // Lotes paralelos: tenantFacts + segment + businessProfile + contextEntries vão
    // a todos os lotes para manter a consistência de categoria entre eles e dar ao
    // LLM a visão dos lançamentos já resolvidos (ver chunk-runner.ts).
    const { data: classifications, response, latencyMs } = await runChunkedWithTelemetry(
      inputs,
      {
        tenantId: state.tenantId,
        traceId: state.traceId,
        segment: state.segment,
        tenantFacts,
        businessProfile,
        contextEntries: contextSample,
      },
      runDreClassificationAgentWithTelemetry,
    );
    llmClassifications =
      state.clarityResults && state.clarityResults.length > 0
        ? applyClarityCaps(classifications, state.clarityResults)
        : classifications;

    ({ costs, traces } = buildAgentTelemetry({
      agent: "dre-classification",
      response,
      latencyMs,
      inputPayload: inputs,
      outputPayload: llmClassifications,
    }));
  } else {
    ({ costs, traces } = buildRuleBasedTrace({
      agent: "dre-classification",
      inputPayload: ruleClassifications,
      outputPayload: ruleClassifications,
    }));
  }

  // Regra (confiança 1.0) + LLM. Saneia a saída do LLM removendo repetições e
  // entryIds já resolvidos por regra (o determinístico tem precedência; o remap
  // por alias pode repetir id quando o modelo devolve mais linhas que o pedido).
  // Os de regra não passam por clarity caps — são determinísticos, nada a rebaixar.
  const seenLlm = new Set<string>();
  const sanitizedLlm = llmClassifications.filter((c) => {
    if (seenLlm.has(c.entryId) || ruleById.has(c.entryId)) return false;
    seenLlm.add(c.entryId);
    return true;
  });
  const finalClassifications = [...sanitizedLlm, ...ruleClassifications];

  // PRINCÍPIO: o caixa é fato contábil, não pode ser probabilístico. A direção
  // (entrada/saída) vem do parsing DETERMINÍSTICO do extrato (sinal/coluna Tipo >
  // heurística zero-token > fallback) e NUNCA é alterada pela classificação LLM.
  // A categoria do LLM alimenta apenas o DRE (aggregate-dre agrega por categoria,
  // não por direção) — assim o saldo é reproduzível: o mesmo extrato → o mesmo
  // caixa, sem oscilar quando o modelo muda a categoria de um lançamento ambíguo.
  // Mantemos só a salvaguarda: direção CONFIÁVEL do extrato (não inferida) que uma
  // categoria de alta confiança contradiz é marcada para revisão humana — sem
  // sobrescrever o fato do documento.
  const reviewByDirection = new Set<string>();
  for (const c of finalClassifications) {
    if (inferredById.has(c.entryId)) continue; // direção inferida: parsing determinístico manda
    const nature = CATEGORY_NATURE[c.category as DreCategory] ?? null;
    const current = (state.normalizedEntries ?? []).find((e) => e.entryId === c.entryId)?.direction;
    const contradicts = nature !== null && current !== undefined && NATURE_TO_FLOW[nature] !== current;
    if (contradicts && c.confidence >= DIRECTION_SAFEGUARD_CONFIDENCE) {
      reviewByDirection.add(c.entryId);
      logger.warn(
        { analysisId: state.analysisId, entryId: c.entryId, category: c.category, confidence: c.confidence },
        "monthly-analysis.dre-classifier: categoria contradiz direção confiável do extrato — marcado para revisão",
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
          const reviewFix = reviewByDirection.has(c.entryId)
            ? { correctionSource: "needs_review" }
            : {};
          // Nunca grava `direction`: o caixa segue o parsing determinístico do extrato.
          return db.ledgerEntry.updateMany({
            // analysisId escopa o write-back à análise atual: um entryId alucinado
            // pelo LLM não pode sobrescrever lançamento de outra análise do tenant.
            where: { id: c.entryId, tenantId: state.tenantId, analysisId: state.analysisId },
            data: {
              predictedCategory: c.category,
              classificationConfidence: c.confidence,
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

  // A direção persistida (e a do estado downstream) é a determinística do parsing —
  // não há mais correção de direção pela categoria LLM, então nada a propagar aqui.
  return {
    classifiedEntries: finalClassifications,
    costs,
    traces,
    ...(businessProfile ? { businessProfile } : {}),
  };
}
