// Parser para DRE consolidado em PDF (relatório do contador, não extrato por lançamento).
// Quando parsePdf() retorna 0 entries, este parser usa LLM para extrair as linhas do DRE
// e cria entradas sintéticas com confirmedCategory já preenchida — pula classificação.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
import { z } from "zod";
import { callLlm } from "@/llm/index.js";
import { buildTaxonomyBlock, DRE_CATEGORIES } from "@/classification/taxonomy.js";
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

function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
}

function buildSystemPrompt(): string {
  return `Você é um extrator de DRE (Demonstrativo de Resultado do Exercício) para contabilidade brasileira.
Dado o texto de um relatório DRE consolidado, extraia cada linha financeira e mapeie para a taxonomia Aicfo.

Taxonomia disponível:
${buildTaxonomyBlock()}

Retorne SOMENTE um JSON array (sem texto adicional) com objetos:
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

export async function parsePdfDre(
  buffer: Buffer,
  referenceMonth: string,
  tenantId: string,
): Promise<ParseResult> {
  const data = await pdfParse(buffer);
  const pdfText = data.text.trim();

  if (!pdfText) {
    logger.warn({ tenantId, referenceMonth }, "parsePdfDre: PDF sem texto extraível");
    return { entries: [], orphanCount: 0 };
  }

  let parsed: z.infer<typeof DreLineSchema>;

  try {
    const response = await callLlm({
      task: "dre-extraction",
      systemPrompt: buildSystemPrompt(),
      userPrompt: pdfText,
      tenantId,
      jsonMode: true,
    });

    // Remove markdown code fences que alguns modelos adicionam mesmo com jsonMode
    const cleaned = response.content.replace(/```(?:json)?\s*/gi, "").trim();
    logger.info({ tenantId, referenceMonth, contentPreview: cleaned.slice(0, 200) }, "parsePdfDre: resposta LLM recebida");
    parsed = DreLineSchema.parse(JSON.parse(cleaned));
  } catch (err) {
    logger.error({ err, tenantId, referenceMonth }, "parsePdfDre: erro na extração LLM");
    return { entries: [], orphanCount: 0 };
  }

  const date = lastDayOfMonth(referenceMonth);
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
      confirmedCategory: category,
      correctionSource: "dre-import",
      classificationConfidence: 1.0,
    });
  }

  logger.info(
    { tenantId, referenceMonth, entryCount: entries.length },
    "parsePdfDre: extração concluída",
  );

  return { entries, orphanCount: 0 };
}
