import { resolveRoute } from "@/llm/router.js";
import { callGoogle } from "@/llm/adapters/google.js";
import { callAnthropic } from "@/llm/adapters/anthropic.js";
import { callLocal } from "@/llm/adapters/local.js";
import { createTrace } from "@/observability/langfuse.js";
import { logger } from "@/observability/logger.js";
import type { LlmRequest, LlmResponse } from "@/llm/types.js";

export type { LlmTask, LlmRequest, LlmResponse } from "@/llm/types.js";

export async function callLlm(req: LlmRequest): Promise<LlmResponse> {
  const route = resolveRoute(req.task);

  const trace = createTrace({
    name: req.task,
    tenantId: req.tenantId,
    traceId: req.traceId,
    metadata: { provider: route.provider, model: route.model },
  });

  const generation = trace.generation({
    name: req.task,
    input: req.userPrompt,
    model: route.model,
    modelParameters: { jsonMode: req.jsonMode ?? false },
  });

  let response: LlmResponse;

  try {
    response = await dispatch(route, req);
  } catch (primaryErr) {
    logger.warn({ err: primaryErr, task: req.task }, "LLM primário falhou — tentando fallback");

    const fallback = resolveRoute(req.task, true);
    try {
      response = await dispatch(fallback, req);
    } catch (fallbackErr) {
      generation.end({ output: null, level: "ERROR" });
      // Langfuse 3.x não expõe `status` em trace.update; mantém o trace, sinaliza no metadata.
      trace.update({ metadata: { status: "ERROR" } });
      throw fallbackErr;
    }
  }

  generation.end({
    output: response.content,
    usage: { input: response.inputTokens, output: response.outputTokens, unit: "TOKENS" },
    metadata: { costCents: response.costCents },
  });

  response.traceId = trace.id ?? null;

  logger.debug(
    { task: req.task, model: response.model, costCents: response.costCents, traceId: response.traceId },
    "LLM call concluída",
  );

  return response;
}

async function dispatch(route: ReturnType<typeof resolveRoute>, req: LlmRequest): Promise<LlmResponse> {
  switch (route.provider) {
    case "google":    return callGoogle(route, req);
    case "anthropic": return callAnthropic(route, req);
    case "local":     return callLocal(route, req);
  }
}
