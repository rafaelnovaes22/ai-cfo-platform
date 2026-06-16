import { resolveRoute } from "@/llm/router.js";
import { callGoogle } from "@/llm/adapters/google.js";
import { callAnthropic } from "@/llm/adapters/anthropic.js";
import { callOpenAI } from "@/llm/adapters/openai.js";
import { callGroq } from "@/llm/adapters/groq.js";
import { callLocal } from "@/llm/adapters/local.js";
import { createTrace } from "@/observability/tracing.js";
import { logger } from "@/observability/logger.js";
import type { LlmRequest, LlmResponse } from "@/llm/types.js";

export type { LlmTask, LlmRequest, LlmResponse } from "@/llm/types.js";

const DEFAULT_LLM_TIMEOUT_MS = 90_000;

function resolveTimeoutMs(): number {
  const raw = Number(process.env.LLM_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_LLM_TIMEOUT_MS;
}

// Garante que uma chamada LLM nunca prenda o pipeline. Aborta via AbortSignal
// (cancela a HTTP nos SDKs que respeitam o signal) e, como rede de segurança,
// rejeita a corrida mesmo que o SDK ignore o signal. O erro de timeout cai no
// fallback (Google→OpenAI) em callLlm; se ambos estourarem, o nó falha e o job
// BullMQ reverte a análise para `pending` em vez de ficar presa em `generating`.
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`llm_timeout: ${label} excedeu ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function callLlm(req: LlmRequest): Promise<LlmResponse> {
  const route = resolveRoute(req.task);
  const timeoutMs = resolveTimeoutMs();

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
    response = await withTimeout((signal) => dispatch(route, req, signal), timeoutMs, req.task);
  } catch (primaryErr) {
    logger.warn({ err: primaryErr, task: req.task }, "LLM primário falhou — tentando fallback");

    const fallback = resolveRoute(req.task, true);
    try {
      response = await withTimeout((signal) => dispatch(fallback, req, signal), timeoutMs, req.task);
    } catch (fallbackErr) {
      await generation.end({ output: null, level: "ERROR" });
      await trace.update({ metadata: { status: "ERROR" } });
      await trace.end({ error: String(fallbackErr) });
      throw fallbackErr;
    }
  }

  await generation.end({
    output: response.content,
    usage: { input: response.inputTokens, output: response.outputTokens, unit: "TOKENS" },
    metadata: { costCents: response.costCents },
  });

  await trace.end({
    output: response.content,
    model: response.model,
    costCents: response.costCents,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  });

  response.traceId = trace.id ?? null;

  logger.debug(
    { task: req.task, model: response.model, costCents: response.costCents, traceId: response.traceId },
    "LLM call concluída",
  );

  return response;
}

async function dispatch(
  route: ReturnType<typeof resolveRoute>,
  req: LlmRequest,
  signal?: AbortSignal,
): Promise<LlmResponse> {
  switch (route.provider) {
    case "google":    return callGoogle(route, req, signal);
    case "anthropic": return callAnthropic(route, req, signal);
    case "openai":    return callOpenAI(route, req, signal);
    case "groq":      return callGroq(route, req, signal);
    case "local":     return callLocal(route, req, signal);
  }
}
