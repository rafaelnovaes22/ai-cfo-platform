import OpenAI from "openai";
import type { LlmRequest, LlmResponse, RouteConfig } from "@/llm/types.js";
import { calculateCostCents } from "@/llm/cost.js";

// Groq expõe API OpenAI-compatível em https://api.groq.com/openai/v1.
// Reaproveitamos o SDK da OpenAI com baseURL custom — sem dependência nova.
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY não configurada");
    _client = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  }
  return _client;
}

// Remove blocos <think>...</think> emitidos por modelos de reasoning (Qwen3,
// DeepSeek R1 distill, etc.) e fences ```json``` se houver. Aplicado antes
// do JSON.parse no jsonMode.
//
// Heurística robusta: corta tudo até o último </think> visto, depois extrai
// o conteúdo entre o primeiro { e o último } correspondente. Necessário
// porque Qwen3-32B frequentemente emite <think> sem newline ou com fences
// internas, e às vezes deixa o reasoning truncado sem fechar a tag.
function stripReasoningWrappers(text: string): string {
  let out = text;
  const lastThinkEnd = out.lastIndexOf("</think>");
  if (lastThinkEnd !== -1) {
    out = out.slice(lastThinkEnd + "</think>".length);
  } else if (/^\s*<think>/.test(out)) {
    // Reasoning truncado (sem </think>). Tenta achar o primeiro { após o <think>.
    const firstBrace = out.indexOf("{", out.indexOf("<think>"));
    if (firstBrace !== -1) out = out.slice(firstBrace);
  }
  const trimmed = out.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenceMatch) return (fenceMatch[1] ?? "").trim();
  // Último recurso: pegar do primeiro { ao último } (cobre prefixos narrativos).
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

export async function callGroq(config: RouteConfig, req: LlmRequest): Promise<LlmResponse> {
  const client = getClient();

  // Groq aceita response_format: json_object para modelos Qwen, mas o prompt
  // do narrator pede um objeto-raiz com `cards[]` (não array). Deixamos como
  // texto livre + stripJsonFences pra cobrir fence indevida igual OpenAI.
  // max_completion_tokens generoso porque modelos de reasoning (Qwen3, DeepSeek
  // R1 distill) gastam 2-4k tokens só pensando antes do JSON final. Default da
  // API (2048) corta o reasoning e devolve apenas <think>... sem o JSON.
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: req.userPrompt },
    ],
    max_completion_tokens: 4096,
  });

  const rawContent = completion.choices[0]?.message?.content ?? "";
  const content = req.jsonMode ? stripReasoningWrappers(rawContent) : rawContent;

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;

  return {
    content,
    provider: "groq",
    model: config.model,
    inputTokens,
    outputTokens,
    costCents: calculateCostCents(config.model, inputTokens, outputTokens),
    traceId: null,
  };
}
