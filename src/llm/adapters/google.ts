import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LlmRequest, LlmResponse, RouteConfig } from "@/llm/types.js";
import { calculateCostCents } from "@/llm/cost.js";

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY não configurada");
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

export async function callGoogle(config: RouteConfig, req: LlmRequest): Promise<LlmResponse> {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: config.model,
    systemInstruction: req.systemPrompt,
    generationConfig: {
      responseMimeType: req.jsonMode ? "application/json" : "text/plain",
      // thinking budget (Gemini 2.5 Flash): injetado via generationConfig quando disponível
      ...(config.thinkingBudget
        ? { thinkingConfig: { thinkingBudget: config.thinkingBudget } }
        : {}),
    },
  });

  const result = await model.generateContent(req.userPrompt);
  const content = result.response.text();
  const usage = result.response.usageMetadata;

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
