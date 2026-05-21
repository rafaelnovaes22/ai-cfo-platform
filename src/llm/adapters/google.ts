import { VertexAI } from "@google-cloud/vertexai";

// GoogleAuthOptions vem de google-auth-library (transitivo); usamos a forma mínima inline.
interface InlineGoogleAuthOptions {
  credentials: { client_email: string; private_key: string };
}
import type { LlmRequest, LlmResponse, RouteConfig } from "@/llm/types.js";
import { calculateCostCents } from "@/llm/cost.js";

// Adapter Vertex AI (LGPD — dados em região southamerica-east1).
// Substitui Google AI Studio (@google/generative-ai) em 2026-05-20 (ADR-009).
//
// Auth flexível:
//   - DEV/local: GOOGLE_APPLICATION_CREDENTIALS aponta para SA JSON em disco (ADC padrão)
//   - PROD/Railway: GOOGLE_APPLICATION_CREDENTIALS_JSON contém o JSON inline,
//     evitando precisar gravar arquivo em runtime.
let _client: VertexAI | null = null;

function buildAuthOptions(): InlineGoogleAuthOptions | undefined {
  const inlineJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!inlineJson) return undefined;

  let parsed: { client_email?: string; private_key?: string };
  try {
    parsed = JSON.parse(inlineJson);
  } catch (err) {
    throw new Error(
      `GOOGLE_APPLICATION_CREDENTIALS_JSON não é JSON válido: ${(err as Error).message}`,
    );
  }

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS_JSON deve conter client_email e private_key (service account JSON)",
    );
  }

  return {
    credentials: { client_email: parsed.client_email, private_key: parsed.private_key },
  };
}

function getClient(): VertexAI {
  if (!_client) {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    if (!project) throw new Error("GOOGLE_CLOUD_PROJECT não configurado");

    const location = process.env.GOOGLE_CLOUD_LOCATION ?? "southamerica-east1";
    const googleAuthOptions = buildAuthOptions();

    _client = new VertexAI({
      project,
      location,
      ...(googleAuthOptions ? { googleAuthOptions } : {}),
    });
  }
  return _client;
}

export async function callGoogle(config: RouteConfig, req: LlmRequest): Promise<LlmResponse> {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: config.model,
    systemInstruction: { role: "system", parts: [{ text: req.systemPrompt }] },
    generationConfig: {
      responseMimeType: req.jsonMode ? "application/json" : "text/plain",
      ...(config.thinkingBudget
        ? { thinkingConfig: { thinkingBudget: config.thinkingBudget } }
        : {}),
    },
  });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: req.userPrompt }] }],
  });

  const candidate = result.response.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text ?? "";
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
