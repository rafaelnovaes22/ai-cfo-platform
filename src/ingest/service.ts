import { getPrisma } from "@/persistence/prisma.js";
import { Prisma, SubscriptionMode } from "@prisma/client";
import { enqueueMonthlyAnalysisGraph } from "@/queue/index.js";
import { parseExcel } from "@/ingest/parsers/excel.js";
import { parseExcelDre } from "@/ingest/parsers/excel-dre.js";
import { parseCsv } from "@/ingest/parsers/csv.js";
import { parseText } from "@/ingest/parsers/text.js";
import { parsePdfDre, parseDreText } from "@/ingest/parsers/pdf-dre.js";
import { parsePdfStatement } from "@/ingest/parsers/pdf-statement.js";
import { parseManual } from "@/ingest/parsers/manual.js";
import { inferDirectionFromDescription } from "@/ingest/normalize.js";
import { computeDedupeHashes } from "@/ingest/dedupe.js";
import { createTrace } from "@/observability/tracing.js";
import { logger } from "@/observability/logger.js";
import type { RawLedger, IngestResult, IngestMonthResult, IngestOutcome, ParseResult } from "@/ingest/types.js";

// Default — pode ser sobrescrito por tenant em productConfig.monthlyAnalysis.minEntries (C8).
const DEFAULT_MIN_INGEST_ENTRIES = 10;

export type IngestSource = "excel" | "csv" | "text" | "pdf" | "manual";

// Um arquivo "usa sinais sistematicamente" quando ≥25% das linhas têm valor negativo.
// Abaixo disso (ex: planilha do cliente com 1 estorno no meio de 77 positivos),
// um positivo sem marcador de direção é chute, não fato.
const DIRECTION_SIGN_SHARE_THRESHOLD = 0.25;

/**
 * Decide, por lançamento, se a direção é INFERIDA (não-confiável). Duas origens
 * contam como inferência:
 * - "fallback": positivo sem marcador, num arquivo que não usa sinais sistematicamente.
 * - "description": direção deduzida do texto pela heurística (PR #174). É boa para o
 *   free tier (WhatsApp, sem LLM), mas no tier pago o LLM, com contexto do negócio,
 *   tem a palavra final — então também é corrigível. Sem isto, a heurística travava
 *   a direção e o classificador não podia consertar (ex.: pró-labore como receita).
 * Lançamentos inferidos são persistidos com directionInferred=true e o classificador
 * envia direction="unknown" + corrige pela natureza da categoria (ver direction-fix.ts).
 * Entries sem directionSource (parsers legados) ou com sinal real são confiáveis.
 */
export function computeDirectionInferred(entries: RawLedger[]): boolean[] {
  if (entries.length === 0) return [];
  const signCount = entries.filter((e) => e.directionSource === "sign").length;
  const fileHasSystematicSigns = signCount / entries.length >= DIRECTION_SIGN_SHARE_THRESHOLD;
  return entries.map(
    (e) =>
      e.directionSource === "description" ||
      (e.directionSource === "fallback" && !fileHasSystematicSigns),
  );
}

export function filterEntriesByReferenceMonth(
  entries: RawLedger[],
  referenceMonth: string,
): { entries: RawLedger[]; ignoredCount: number } {
  const filtered = entries.filter((entry) => entry.date.startsWith(`${referenceMonth}-`));
  return {
    entries: filtered,
    ignoredCount: entries.length - filtered.length,
  };
}

/**
 * Agrupa os índices dos lançamentos por mês de competência (YYYY-MM da data).
 * Helper para análises por competência (ex.: DRE por mês na Fase 2).
 */
export function groupIndicesByMonth(dates: string[]): Map<string, number[]> {
  const byMonth = new Map<string, number[]>();
  dates.forEach((date, i) => {
    const ym = date.slice(0, 7);
    const bucket = byMonth.get(ym) ?? [];
    bucket.push(i);
    byMonth.set(ym, bucket);
  });
  return byMonth;
}

/**
 * Mês corrente (YYYY-MM) no fuso de São Paulo — usado como referenceMonth da
 * análise ("análise deste mês"). BRT evita virar o mês cedo demais (servidor UTC).
 */
export function currentMonthBRT(): string {
  const parts = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).split("/");
  const mm = parts[1];
  const yyyy = parts[2];
  return mm && yyyy ? `${yyyy}-${mm}` : new Date().toISOString().slice(0, 7);
}

/**
 * Último mês fechado (YYYY-MM) presente no extrato: o mês mais recente com
 * lançamentos que seja anterior ao mês corrente — o mês corrente está aberto e
 * não conta como "fechado". É só o RÓTULO da análise (indica o período que ela
 * representa), não a janela de dados (consolidada por analysisId). `current` é
 * injetável para teste determinístico.
 * Fallback: sem nenhum mês fechado (só lançamentos do mês corrente/futuros),
 * usa o mês corrente — não há mês fechado a rotular.
 */
export function lastClosedMonth(entries: RawLedger[], current = currentMonthBRT()): string {
  let best: string | null = null;
  for (const e of entries) {
    const m = e.date.slice(0, 7);
    if (m < current && (best === null || m > best)) best = m;
  }
  return best ?? current;
}

export function predominantMonth(entries: RawLedger[]): string | null {
  if (entries.length === 0) return null;
  const counts = new Map<string, number>();
  for (const e of entries) {
    const ym = e.date.slice(0, 7);
    counts.set(ym, (counts.get(ym) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = -1;
  for (const [ym, c] of counts) {
    if (c > bestCount) {
      best = ym;
      bestCount = c;
    }
  }
  return best;
}

export async function ingest(params: {
  tenantId: string;
  referenceMonth: string; // "YYYY-MM"
  source: IngestSource;
  buffer?: Buffer;        // para file uploads
  fileName?: string;      // nome original do arquivo (usado por DRE Excel para inferir ano)
  text?: string;          // para clipboard
  entries?: unknown[];    // para manual
  skipAnalysis?: boolean; // true = parse+store apenas, sem enfileirar LLM (ex: plano student)
}): Promise<IngestResult> {
  const { tenantId, referenceMonth, source } = params;

  // C6 — trace do pipeline de ingest. Cada fase abre um span próprio.
  const trace = createTrace({
    name: "ingest",
    tenantId,
    metadata: { referenceMonth, source },
  });

  // 1. Parse conforme o formato
  const parseSpan = trace.span({ name: "parse", input: { source } });
  let parseResult: ParseResult;
  try {
    parseResult = await dispatch(params);
    parseSpan.end({
      output: { entryCount: parseResult.entries.length, orphanCount: parseResult.orphanCount },
    });
  } catch (err) {
    parseSpan.end({ level: "ERROR", output: { error: String(err) } });
    await trace.update({ metadata: { outcome: "failed", reason: "parse_error" } });
    await trace.end({ outcome: "failed" });
    logger.error({ err, source, referenceMonth, tenantId }, "Ingest parse error");
    return buildResult("failed", tenantId, referenceMonth, 0, 0);
  }

  // Uma análise por extrato, com TODOS os lançamentos. O mês de análise é o mês da
  // SOLICITAÇÃO (param referenceMonth — mês atual no upload web e no WhatsApp), NÃO o
  // mês predominante do extrato nem o mês do documento: um extrato pode cobrir vários
  // meses e a análise é rotulada pelo mês em que o cliente a pediu.
  const entries = parseResult.entries;
  // Heurística determinística de direção por descrição (zero-token). Corrige o
  // fallback "positivo = entrada" quando o extrato não traz coluna de tipo/sinal:
  // despesas óbvias (energia, aluguel, DAS, pró-labore) deixam de virar receita.
  // Crítico no free tier do aluno, que não passa pela classificação LLM.
  let descriptionInferredCount = 0;
  for (const entry of entries) {
    if (entry.directionSource !== "fallback") continue;
    const inferred = inferDirectionFromDescription(entry.description);
    if (inferred) {
      entry.direction = inferred;
      entry.directionSource = "description";
      descriptionInferredCount++;
    }
  }

  const { orphanCount } = parseResult;
  logger.info(
    {
      source,
      requestedReferenceMonth: referenceMonth,
      tenantId,
      entryCount: entries.length,
      orphanCount,
      descriptionInferredCount,
    },
    "Ingest parse concluído",
  );

  if (entries.length === 0) {
    await trace.update({
      metadata: { outcome: "failed", reason: "no_entries", orphanCount },
    });
    return buildResult("failed", tenantId, referenceMonth, 0, orphanCount);
  }

  // 2. Distribuir por mês de competência: uma MonthlyAnalysis por mês do extrato.
  const db = getPrisma();
  const persistSpan = trace.span({ name: "persist", input: { entryCount: entries.length } });

  const tenant = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { productConfig: true },
  });
  const tenantConfig = (tenant.productConfig as Record<string, unknown> | null)?.monthlyAnalysis as
    Record<string, unknown> | undefined;
  const minEntries = (tenantConfig?.minEntries as number | undefined) ?? DEFAULT_MIN_INGEST_ENTRIES;
  const subscription = await db.subscription.findUniqueOrThrow({ where: { tenantId } });

  const directionInferredFlags = computeDirectionInferred(entries);
  const allDedupeHashes = computeDedupeHashes(entries);

  // UMA análise por extrato/período (decisão de produto 2026-06-15): todos os
  // lançamentos do extrato ficam numa única MonthlyAnalysis. Assim a classificação
  // cobre TODOS os meses juntos (meses pequenos não ficam sem classificação) e o
  // plano/DRE/narrativa saem CONSOLIDADOS. A navegação por mês de DRE/Lançamentos/
  // Caixa vem de filtro de competência sobre estes lançamentos (não de análises
  // separadas).
  // referenceMonth (chave + rótulo) = ÚLTIMO MÊS FECHADO presente no extrato — só
  // indica o período que a análise representa, não filtra a janela de dados (que é
  // consolidada por analysisId). O mês corrente está aberto, então não rotula: um
  // extrato de mar/abr/mai pedido em junho vira a "análise de maio". Fallback p/ o
  // mês corrente quando só há lançamentos dele.
  const referenceMonthKey = lastClosedMonth(entries);
  const rows = entries.map((entry, i) => ({
    entry,
    dedupeHash: allDedupeHashes[i] ?? "",
    inferred: directionInferredFlags[i] ?? false,
  }));
  const result = await persistMonth({
    db,
    tenantId,
    referenceMonth: referenceMonthKey,
    rows,
    minEntries,
    subscriptionMode: subscription.mode,
    skipAnalysis: params.skipAnalysis === true,
    traceId: trace.id,
  });
  const months: IngestMonthResult[] = [
    { referenceMonth: referenceMonthKey, analysisId: result.analysisId, entryCount: rows.length },
  ];
  persistSpan.end({ output: { analysisId: result.analysisId, entryCount: entries.length } });

  const principal = months[0]!;
  // Range real do extrato (para o caixa do WhatsApp agregar o período inteiro).
  const sortedDates = entries.map((e) => e.date).sort();
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];
  const outcome: IngestOutcome = entries.length >= minEntries ? "completed" : "partial";

  await trace.update({
    metadata: {
      outcome,
      requestedReferenceMonth: referenceMonth,
      months: months.map((m) => `${m.referenceMonth}:${m.entryCount}`),
      entryCount: entries.length,
      orphanCount,
      minEntries,
    },
  });
  await trace.end({ outcome, entryCount: entries.length });

  return {
    analysisId: principal.analysisId,
    referenceMonth: principal.referenceMonth,
    entryCount: entries.length,
    orphanCount,
    outcome,
    months,
    startDate,
    endDate,
  };
}

/**
 * Persiste os lançamentos de UM mês de competência: upsert da MonthlyAnalysis
 * (tenantId, referenceMonth), insert dedupado e disparo da análise LLM quando o mês
 * tem lançamentos suficientes e não é cash-flow-only. Cada mês em sua própria
 * transação de upsert — um mês que falhe não derruba os outros.
 */
export async function persistMonth(args: {
  db: ReturnType<typeof getPrisma>;
  tenantId: string;
  referenceMonth: string;
  rows: { entry: RawLedger; dedupeHash: string; inferred: boolean }[];
  minEntries: number;
  subscriptionMode: SubscriptionMode;
  skipAnalysis: boolean;
  traceId?: string;
}): Promise<{ analysisId: string; inserted: number }> {
  const { db, tenantId, referenceMonth, rows, minEntries, subscriptionMode, skipAnalysis, traceId } = args;

  const analysis = await db.$transaction(async (tx) => {
    const existing = await tx.monthlyAnalysis.findUnique({
      where: { tenantId_referenceMonth: { tenantId, referenceMonth } },
    });
    if (existing) {
      await tx.ledgerEntry.deleteMany({ where: { analysisId: existing.id } });
      await tx.narrativeCard.deleteMany({ where: { analysisId: existing.id } });
      await tx.actionPlanItem.deleteMany({ where: { analysisId: existing.id } });
      await tx.monthlyAnalysis.update({
        where: { id: existing.id },
        data: {
          status: "pending",
          generatedAt: null,
          deliveredAt: null,
          approvedAt: null,
          mode: subscriptionMode,
          dreJson: Prisma.DbNull,
          narrativeJson: Prisma.DbNull,
          actionPlanJson: Prisma.DbNull,
          clientEditedNarrative: null,
          clientEditedActionPlan: null,
          costCents: 0,
          traceId: null,
        },
      });
      return existing;
    }
    return tx.monthlyAnalysis.create({
      data: { tenantId, referenceMonth, status: "pending", mode: subscriptionMode },
    });
  });

  // Insert dedupado: skipDuplicates + unique(tenantId, dedupeHash) impedem que
  // reenviar o mesmo extrato (ou um que sobreponha período) duplique lançamentos.
  const created = await db.ledgerEntry.createMany({
    skipDuplicates: true,
    data: rows.map(({ entry: e, dedupeHash, inferred }) => ({
      tenantId,
      analysisId: analysis.id,
      date: new Date(e.date),
      description: e.description,
      amountCents: e.amountCents,
      direction: e.direction,
      directionInferred: inferred,
      dedupeHash,
      ...(e.confirmedCategory != null ? {
        predictedCategory:        e.confirmedCategory,
        confirmedCategory:        e.confirmedCategory,
        correctionSource:         e.correctionSource ?? "dre-import",
        classificationConfidence: e.classificationConfidence ?? 1.0,
      } : {}),
    })),
  });
  const skipped = rows.length - created.count;
  if (skipped > 0) {
    logger.info(
      { tenantId, referenceMonth, analysisId: analysis.id, inserted: created.count, skippedDuplicates: skipped },
      "Ingest: lançamentos duplicados ignorados (já enviados antes)",
    );
  }

  // Reenvio depois que a análise anterior foi apagada deixa o lançamento órfão (a
  // relação analysis é SetNull). O createMany acima NÃO o readota — o dedupeHash já
  // existe, então skipDuplicates o pula — e a análise nova sairia sem esses lançamentos
  // (DRE zerada). Readota os órfãos DESTE extrato para a análise corrente. Restrito a
  // analysisId=null: nunca rouba lançamentos de outra análise legítima.
  const extractHashes = rows.map((r) => r.dedupeHash).filter((h) => h.length > 0);
  if (extractHashes.length > 0) {
    const reattached = await db.ledgerEntry.updateMany({
      where: { tenantId, analysisId: null, dedupeHash: { in: extractHashes } },
      data: { analysisId: analysis.id },
    });
    if (reattached.count > 0) {
      logger.info(
        { tenantId, referenceMonth, analysisId: analysis.id, reattached: reattached.count },
        "Ingest: lançamentos órfãos revinculados à análise corrente",
      );
    }
  }

  // Dispara a análise LLM do mês quando há lançamentos suficientes e não é
  // cash-flow-only (student/WhatsApp). Cada mês do extrato gera sua própria análise.
  if (rows.length >= minEntries && !skipAnalysis) {
    await db.monthlyAnalysis.update({ where: { id: analysis.id }, data: { status: "generating" } });
    await enqueueMonthlyAnalysisGraph({ analysisId: analysis.id, tenantId, traceId });
    logger.info({ analysisId: analysis.id, tenantId, referenceMonth }, "Ingest: despachando para LangGraph");
  }

  return { analysisId: analysis.id, inserted: created.count };
}

// Texto colado "tem cara de DRE" quando traz várias linhas e vários valores
// monetários no formato BR. Gate barato antes de gastar token no extrator LLM:
// paste trivial (uma frase, um nome) devolve vazio. Aceita valor com separador
// de milhar com ou sem centavos (641.726 / 641.726,01) e valor com centavos
// (2.840,00 / 50,00); o separador de milhar OU os centavos evitam casar ano
// solto (2026) ou número avulso, que deixariam o gate frouxo demais.
const BR_CURRENCY = /\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+,\d{2}/g;
export function looksLikeDreText(text: string): boolean {
  const lineCount = text.split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  const valueCount = (text.match(BR_CURRENCY) ?? []).length;
  return lineCount >= 3 && valueCount >= 3;
}

export async function dispatch(params: Parameters<typeof ingest>[0]): Promise<ParseResult> {
  switch (params.source) {
    case "excel": {
      // Excel pode ser extrato transacional (uma linha por lançamento) OU DRE
      // consolidado (contas como linhas, meses como colunas/sheets). Tenta o
      // transacional primeiro (determinístico); se retornar 0 entries, cai no
      // extrator de DRE via LLM — espelha o fallback do PDF.
      const transactional = parseExcel(params.buffer!);
      if (transactional.entries.length > 0) return transactional;
      // Free tier (skipAnalysis): nunca cai no LLM (custo R$0), igual ao PDF.
      if (params.skipAnalysis) return transactional;
      return parseExcelDre(params.buffer!, params.referenceMonth, params.tenantId, { fileName: params.fileName });
    }
    case "csv":
      // CSV usa parser de texto dedicado, não o xlsx: este faz type-inference de
      // data em CSV com semântica MM/DD (americana) e perde o sinal de valores
      // negativos. Ver src/ingest/parsers/csv.ts.
      return parseCsv(params.buffer!);
    case "pdf": {
      // PDF pode ser extrato bancário (lista de transações, ex.: aluno no WhatsApp)
      // OU DRE consolidado do contador. Tenta o extrato primeiro (determinístico).
      const statement = await parsePdfStatement(params.buffer!);
      if (statement.entries.length > 0) return statement;
      // O parser de DRE usa LLM. No fluxo cash-flow-only (skipAnalysis = free tier do
      // aluno, zero IA), NÃO cair nele: devolve vazio e o handler orienta a enviar o
      // extrato. Sem isto, um aluno mandando DRE dispararia LLM (fura o custo R$0) e
      // veria números de competência rotulados como fluxo de caixa.
      if (params.skipAnalysis) return statement;
      return parsePdfDre(params.buffer!, params.referenceMonth, params.tenantId);
    }
    case "text": {
      // Datas coladas sem ano ("01/09") assumem o ano do mês de referência (YYYY-MM).
      const result = parseText(params.text!, params.referenceMonth.slice(0, 4));
      if (result.entries.length > 0) return result;
      // 0 lançamentos por coluna: o texto pode ser um DRE consolidado colado (relatório
      // do contador colado como texto em vez de PDF). Espelha o fallback do PDF
      // (parsePdfStatement → parsePdfDre) e tenta a extração via LLM.
      // - Free tier (skipAnalysis): nunca cai no LLM (custo R$0), igual ao PDF.
      // - Heurística looksLikeDreText: só gasta token quando o texto tem cara de DRE
      //   (várias linhas com valores), evitando chamada à toa em paste trivial.
      if (params.skipAnalysis || !looksLikeDreText(params.text!)) return result;
      return parseDreText(params.text!, params.referenceMonth, params.tenantId);
    }
    case "manual":
      return parseManual(params.entries!);
  }
}

function buildResult(
  outcome: IngestResult["outcome"],
  tenantId: string,
  referenceMonth: string,
  entryCount: number,
  orphanCount: number,
): IngestResult {
  return { analysisId: "", referenceMonth, entryCount, orphanCount, outcome };
}
