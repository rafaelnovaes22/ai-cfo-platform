// Parser para DRE consolidado em PDF (relatório do contador, não extrato por lançamento).
// Quando parsePdf() retorna 0 entries, este parser usa LLM para extrair as linhas do DRE
// e cria entradas sintéticas com confirmedCategory já preenchida — pula classificação.
import { z } from "zod";
import { callLlm } from "@/llm/index.js";
import { INJECTION_GUARD } from "@/llm/prompt-safety.js";
import { buildTaxonomyBlock, DRE_CATEGORIES } from "@/classification/taxonomy.js";
import { extractPdfText } from "@/ingest/parsers/pdf-text.js";
import { logger } from "@/observability/logger.js";
import type { ParseResult, RawLedger } from "@/ingest/types.js";

const DreLineSchema = z.array(
  z.object({
    category:    z.string(),
    description: z.string(),
    value:       z.number(),
    direction:   z.enum(["credit", "debit"]),
  }),
);

const MONTH_NAMES: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  mar: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}

function toReferenceMonth(day: string, month: string, year: string): string | null {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function normalizeTextForMonth(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function detectDreReferenceMonth(pdfText: string): string | null {
  const normalized = normalizeTextForMonth(pdfText);

  const periodMatch = normalized.match(
    /periodo\s+de\s+competencia:\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})\s+a\s+(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/,
  );
  if (periodMatch) {
    const start = toReferenceMonth(periodMatch[1]!, periodMatch[2]!, periodMatch[3]!);
    const end = toReferenceMonth(periodMatch[4]!, periodMatch[5]!, periodMatch[6]!);
    if (start && start === end) return start;
  }

  const numericMonthMatch = normalized.match(/\b(?:dre|competencia|periodo)[^\n]{0,40}\b(0?[1-9]|1[0-2])\/(\d{4})\b/);
  if (numericMonthMatch) {
    return `${numericMonthMatch[2]}-${numericMonthMatch[1]!.padStart(2, "0")}`;
  }

  const namedMonthMatch = normalized.match(
    /\b(janeiro|fevereiro|marco|mar|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(\d{4})\b/,
  );
  if (namedMonthMatch) {
    const month = MONTH_NAMES[namedMonthMatch[1]!];
    if (month) return `${namedMonthMatch[2]}-${month}`;
  }

  return null;
}

function buildSystemPrompt(): string {
  return `Você é um extrator de DRE (Demonstrativo de Resultado do Exercício) para contabilidade brasileira.
Dado o texto de um relatório DRE consolidado, extraia cada linha financeira e mapeie para a taxonomia Aicfo.

${INJECTION_GUARD}

Taxonomia disponível:
${buildTaxonomyBlock()}

PRIMEIRO, decida se o texto é um documento contábil EXTRAÍVEL:
- EXTRAÍVEL: DRE, balancete ou extrato com VALORES ABSOLUTOS em R$ por conta/linha de UM período (ex.: "Receita Bruta 641.726,01", "CMV 265.227,00").
- NÃO-EXTRAÍVEL: relatório de ANÁLISE/INDICADORES — dominado por percentuais, margens ("X / Receita 43,1%"), índices, ou uma tabela de CRESCIMENTO/VARIAÇÃO mês a mês (colunas tipo "Abr vs Mar", "+78,1%"). Esses números são RESULTADO de uma análise, não lançamentos.

Se for NÃO-EXTRAÍVEL, retorne [] (array vazio) e nada mais. Na dúvida, se a maioria dos números do texto forem percentuais ou variações, retorne []. NUNCA derive lançamentos de colunas de variação/crescimento nem de percentuais — só de valores absolutos em R$ daquele período.

Se for EXTRAÍVEL, retorne SOMENTE um JSON array (sem texto adicional) com objetos:
{
  "category": "<chave_da_taxonomia>",
  "description": "<nome original da linha no documento>",
  "value": <número positivo>,
  "direction": "credit" | "debit"
}

Regras:
- direction="credit" para receitas (receita_bruta, receita_financeira, outras_receitas, emprestimos_entrada)
- direction="debit" para todos os demais (deduções, custos, despesas, impostos, amortizações)
- Ignore linhas de subtotal/total que são somas de outras linhas (ex: Lucro Bruto, EBITDA, Receita Líquida, Total de Despesas)
- Se não souber a categoria exata, use "outras_despesas" (debit) ou "outras_receitas" (credit)
- value sempre positivo (sem sinal)
- Interprete valores em formato BR: 1.234,56 = 1234.56`;
}

/**
 * Núcleo da extração de DRE: opera sobre TEXTO (já extraído do PDF, ou colado
 * direto pelo cliente no fluxo "Cole sua planilha"). Usa LLM para mapear cada
 * linha do demonstrativo para a taxonomia e devolve entradas sintéticas com
 * confirmedCategory preenchida (pulam a classificação).
 */
export async function parseDreText(
  dreText: string,
  referenceMonth: string,
  tenantId: string,
): Promise<ParseResult> {
  const text = dreText.trim();
  if (!text) return { entries: [], orphanCount: 0 };

  const detectedReferenceMonth = detectDreReferenceMonth(text);
  const effectiveReferenceMonth = detectedReferenceMonth ?? referenceMonth;
  if (detectedReferenceMonth && detectedReferenceMonth !== referenceMonth) {
    logger.info(
      { tenantId, requestedReferenceMonth: referenceMonth, detectedReferenceMonth },
      "parseDreText: competência do documento difere do mês informado; usando mês detectado",
    );
  }

  let parsed: z.infer<typeof DreLineSchema>;

  try {
    const response = await callLlm({
      task: "dre-extraction",
      systemPrompt: buildSystemPrompt(),
      userPrompt: text,
      tenantId,
      jsonMode: true,
    });

    // Remove markdown code fences que alguns modelos adicionam mesmo com jsonMode
    const cleaned = response.content.replace(/```(?:json)?\s*/gi, "").trim();
    logger.info(
      { tenantId, referenceMonth: effectiveReferenceMonth, contentPreview: cleaned.slice(0, 200) },
      "parseDreText: resposta LLM recebida",
    );
    parsed = DreLineSchema.parse(JSON.parse(cleaned));
  } catch (err) {
    logger.error({ err, tenantId, referenceMonth: effectiveReferenceMonth }, "parseDreText: erro na extração LLM");
    return { entries: [], orphanCount: 0 };
  }

  const date = lastDayOfMonth(effectiveReferenceMonth);
  const entries: RawLedger[] = [];

  for (const line of parsed) {
    const absValue = Math.abs(line.value);
    if (absValue === 0) continue; // ignora linhas de total/zerado

    const isValidCategory = DRE_CATEGORIES.includes(line.category as never);
    const category = isValidCategory
      ? line.category
      : line.direction === "credit" ? "outras_receitas" : "outras_despesas";

    entries.push({
      date,
      description: line.description,
      amountCents: Math.round(absValue * 100),
      direction: line.direction,
      // Direção derivada da natureza da linha DRE — confiável por construção.
      directionSource: "explicit",
      confirmedCategory: category,
      correctionSource: "dre-import",
      classificationConfidence: 1.0,
    });
  }

  logger.info(
    { tenantId, referenceMonth: effectiveReferenceMonth, entryCount: entries.length },
    "parseDreText: extração concluída",
  );

  return { entries, orphanCount: 0, referenceMonth: effectiveReferenceMonth };
}

export async function parsePdfDre(
  buffer: Buffer,
  referenceMonth: string,
  tenantId: string,
): Promise<ParseResult> {
  const pdfText = (await extractPdfText(buffer)).trim();

  if (!pdfText) {
    logger.warn({ tenantId, referenceMonth }, "parsePdfDre: PDF sem texto extraível");
    return { entries: [], orphanCount: 0 };
  }

  return parseDreText(pdfText, referenceMonth, tenantId);
}
