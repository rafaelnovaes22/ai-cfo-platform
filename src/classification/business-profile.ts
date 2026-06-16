import { callLlm } from "@/llm/index.js";
import { INJECTION_GUARD } from "@/llm/prompt-safety.js";
import { logger } from "@/observability/logger.js";

// Shape mínimo: o perfil só precisa das descrições. Desacopla dos dois call-sites
// (classifier BullMQ e nó LangGraph), que têm formatos de entry diferentes.
interface HasDescription {
  description: string;
}

// Quantas descrições distintas mandar ao inferidor de perfil. Amostra representativa
// e barata — o objetivo é capturar a NATUREZA do negócio, não cada lançamento.
const PROFILE_SAMPLE_SIZE = 50;
const MAX_DESCRIPTION_CHARS = 120;

function buildSystemPrompt(): string {
  return `Você é um analista que identifica o ramo de atuação de uma empresa a partir dos lançamentos financeiros dela.

${INJECTION_GUARD}

TAREFA
Dada uma amostra de descrições de lançamentos, descreva em 2 a 4 frases curtas:
1. Qual a atividade-fim provável da empresa (o que ela vende/entrega).
2. Quais TIPOS de lançamento representam a RECEITA-FIM dela (serviços ou produtos vendidos a clientes) — seja específico usando o vocabulário das descrições.
3. Quais TIPOS representam custos/despesas operacionais.

Foco no que distingue receita de despesa NESTE negócio. Não invente categorias contábeis; descreva em linguagem direta. Responda em português, SEM markdown, SEM listas numeradas — apenas o texto corrido do perfil. Máximo 500 caracteres.`;
}

function buildUserPrompt(descriptions: string[]): string {
  return `Amostra de descrições de lançamentos desta empresa:\n${descriptions.map((d) => `- ${d}`).join("\n")}\n\nDescreva o perfil do negócio.`;
}

/** Descrições distintas, truncadas, até o limite da amostra. */
function sampleDescriptions(entries: HasDescription[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    const desc = e.description.trim().slice(0, MAX_DESCRIPTION_CHARS);
    const key = desc.toLowerCase();
    if (!desc || seen.has(key)) continue;
    seen.add(key);
    out.push(desc);
    if (out.length >= PROFILE_SAMPLE_SIZE) break;
  }
  return out;
}

/**
 * Infere o perfil do negócio a partir das descrições dos lançamentos (1 chamada LLM
 * curta). Resolve o problema de `industrySegment` ser sempre "geral": sem saber o
 * ramo, o classificador trata serviços-fim (ex.: "cobertura jornalística",
 * "assessoria de imprensa" numa produtora) como despesa. O perfil é injetado no
 * prompt de classificação. Falha é não-bloqueante — retorna undefined e a
 * classificação segue sem o perfil (degradação graciosa).
 */
export async function inferBusinessProfile(
  entries: HasDescription[],
  options: { tenantId: string; traceId?: string },
): Promise<string | undefined> {
  const descriptions = sampleDescriptions(entries);
  if (descriptions.length < 3) return undefined; // amostra pequena demais para inferir

  try {
    const response = await callLlm({
      task: "business-profile",
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(descriptions),
      tenantId: options.tenantId,
      traceId: options.traceId,
    });
    const profile = response.content.trim().slice(0, 600);
    return profile.length > 0 ? profile : undefined;
  } catch (err) {
    logger.warn({ err, tenantId: options.tenantId }, "inferBusinessProfile falhou — classificando sem perfil");
    return undefined;
  }
}

export const _internals = { buildSystemPrompt, buildUserPrompt, sampleDescriptions };
