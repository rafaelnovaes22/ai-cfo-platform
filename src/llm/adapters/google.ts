import { GoogleGenAI } from "@google/genai";
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { LlmRequest, LlmResponse, RouteConfig } from "@/llm/types.js";
import { calculateCostCents } from "@/llm/cost.js";

// Vertex AI — dados processados em southamerica-east1 (LGPD).
// Auth: GOOGLE_APPLICATION_CREDENTIALS_JSON (Railway) ou ADC (local).
let _client: GoogleGenAI | null = null;

function setupCredentials(): void {
  const inlineJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!inlineJson || process.env.GOOGLE_APPLICATION_CREDENTIALS) return;

  const tmpFile = join(tmpdir(), "gcp-sa.json");
  writeFileSync(tmpFile, inlineJson, "utf8");
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpFile;
}

function getClient(): GoogleGenAI {
  if (!_client) {
    setupCredentials();

    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT não configurado");

    const location = process.env.GOOGLE_CLOUD_LOCATION ?? "southamerica-east1";

    _client = new GoogleGenAI({ vertexai: true, project, location });
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
