import type { LlmRequest, LlmResponse, RouteConfig } from "@/llm/types.js";

// Adapter para modelo local via API OpenAI-compatível (ollama / llama.cpp server).
// Configurar LOCAL_LLM_BASE_URL e LOCAL_LLM_MODEL no .env.
// Custo = R$0 (infra própria já paga).

interface OpenAICompatResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export async function callLocal(_config: RouteConfig, req: LlmRequest): Promise<LlmResponse> {
  const baseUrl = process.env.LOCAL_LLM_BASE_URL ?? "http://localhost:11434/v1";
  const model = process.env.LOCAL_LLM_MODEL ?? "qwen2.5:3b";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user",   content: req.userPrompt },
      ],
      ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Local LLM error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as OpenAICompatResponse;
  const content = data.choices[0]?.message?.content ?? "";
  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;

  return { content, provider: "local", model, inputTokens, outputTokens, costCents: 0, traceId: null };
}
