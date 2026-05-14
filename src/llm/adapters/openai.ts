import OpenAI from "openai";
import type { LlmRequest, LlmResponse, RouteConfig } from "@/llm/types.js";
import { calculateCostCents } from "@/llm/cost.js";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

// Remove markdown fences ```json ... ``` quando o modelo envolve a resposta.
function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (!match) return trimmed;
  return (match[1] ?? "").trim();
}

export async function callOpenAI(config: RouteConfig, req: LlmRequest): Promise<LlmResponse> {
  const client = getClient();

  // Nota: NÃO usamos response_format: "json_object" porque a API exige JSON
  // object (não array) e o prompt de classification produz array. O prompt
  // já instrui "responda SOMENTE JSON" — limpamos fences se aparecerem.
  const completion = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: req.systemPrompt },
      { role: "user", content: req.userPrompt },
    ],
    store: false, // LGPD: não armazenar inputs/outputs nos servidores da OpenAI
  });

  const rawContent = completion.choices[0]?.message?.content ?? "";
  const content = req.jsonMode ? stripJsonFences(rawContent) : rawContent;

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;

  return {
    content,
    provider: "openai",
    model: config.model,
    inputTokens,
    outputTokens,
    costCents: calculateCostCents(config.model, inputTokens, outputTokens),
    traceId: null,
  };
}
