import Anthropic from "@anthropic-ai/sdk";
import type { LlmRequest, LlmResponse, RouteConfig } from "@/llm/types.js";
import { calculateCostCents } from "@/llm/cost.js";

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function callAnthropic(config: RouteConfig, req: LlmRequest): Promise<LlmResponse> {
  const client = getClient();

  const message = await client.messages.create({
    model: config.model,
    max_tokens: 4096,
    system: req.systemPrompt,
    messages: [{ role: "user", content: req.userPrompt }],
  });

  const content = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;

  return {
    content,
    provider: "anthropic",
    model: config.model,
    inputTokens,
    outputTokens,
    costCents: calculateCostCents(config.model, inputTokens, outputTokens),
  };
}
