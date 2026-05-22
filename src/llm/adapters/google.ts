import { GoogleGenAI } from "@google/genai";
import type { LlmRequest, LlmResponse, RouteConfig } from "@/llm/types.js";
import { calculateCostCents } from "@/llm/cost.js";

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY não configurado");
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

export async function callGoogle(config: RouteConfig, req: LlmRequest): Promise<LlmResponse> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: config.model,
    contents: req.userPrompt,
    config: {
      systemInstruction: req.systemPrompt,
      responseMimeType: req.jsonMode ? "application/json" : "text/plain",
      ...(config.thinkingBudget
        ? { thinkingConfig: { thinkingBudget: config.thinkingBudget } }
        : {}),
    },
  });

  const content = response.text ?? "";
  const usage = response.usageMetadata;

  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;

  return {
    content,
    provider: "google",
    model: config.model,
    inputTokens,
    outputTokens,
    costCents: calculateCostCents(config.model, inputTokens, outputTokens),
    traceId: null,
  };
}
