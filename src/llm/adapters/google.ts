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
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (project) {
      // PROD: Vertex AI (southamerica-east1) — dados não saem do Brasil, sem treino.
      setupCredentials();
      const location = process.env.GOOGLE_CLOUD_LOCATION ?? "southamerica-east1";
      _client = new GoogleGenAI({ vertexai: true, project, location });
    } else if (apiKey) {
      // DEV local: Google AI Studio via API key (só para testes/evals).
      _client = new GoogleGenAI({ apiKey });
    } else {
      throw new Error("Configure GOOGLE_CLOUD_PROJECT (prod) ou GOOGLE_API_KEY (dev)");
    }
  }
  return _client;
}

const RETRYABLE_CODES = new Set([429, 500, 503]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function isRetryable(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    return RETRYABLE_CODES.has((err as { status: number }).status);
  }
  const msg = String(err);
  return msg.includes("503") || msg.includes("429") || msg.includes("UNAVAILABLE") || msg.includes("RESOURCE_EXHAUSTED");
}

// Sleep que respeita o AbortSignal: cancela o backoff imediatamente em vez de
// dormir o intervalo inteiro e só então perceber o abort.
async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      },
      { once: true },
    );
  });
}

export async function callGoogle(config: RouteConfig, req: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
  const client = getClient();
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) break;
    if (attempt > 0) {
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1), signal);
    }

    try {
      const response = await client.models.generateContent({
        model: config.model,
        contents: req.userPrompt,
        config: {
          systemInstruction: req.systemPrompt,
          responseMimeType: req.jsonMode ? "application/json" : "text/plain",
          ...(config.thinkingBudget
            ? { thinkingConfig: { thinkingBudget: config.thinkingBudget } }
            : {}),
          ...(signal ? { abortSignal: signal } : {}),
        },
      });

      const content = response.text ?? "";
      const usage = response.usageMetadata;
      const inputTokens = usage?.promptTokenCount ?? 0;
      // Tokens de "thinking" (thoughtsTokenCount) são cobrados como output mas não
      // entram em candidatesTokenCount — somá-los evita subcontabilizar o custo
      // nas tasks com thinkingBudget.
      const outputTokens =
        (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);

      return {
        content,
        provider: "google",
        model: config.model,
        inputTokens,
        outputTokens,
        costCents: calculateCostCents(config.model, inputTokens, outputTokens),
        traceId: null,
      };
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === MAX_RETRIES) break;
    }
  }

  throw lastErr;
}
