import type { LlmResponse } from "@/llm/types.js";
import { NOOP_LLM_RESPONSE } from "@/monthly-analysis/graph/instrumentation.js";
import { mapWithConcurrency } from "@/shared/concurrency.js";

// Resultado padrão de um agente instrumentado: dados + resposta crua do LLM
// (para telemetria) + latência medida. Espelha o retorno das funções
// run*AgentWithTelemetry dos agentes do SKU monthly-analysis.
export interface TelemetryResult<T> {
  data: T[];
  response: LlmResponse;
  latencyMs: number;
}

export interface ChunkConfig {
  chunkSize?: number;
  concurrency?: number;
}

const DEFAULT_CHUNK_SIZE = 15;
const DEFAULT_CONCURRENCY = 4;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? fallback : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

function resolveChunkConfig(config?: ChunkConfig): { chunkSize: number; concurrency: number } {
  return {
    chunkSize: config?.chunkSize && config.chunkSize >= 1
      ? Math.floor(config.chunkSize)
      : envInt("MONTHLY_ANALYSIS_CHUNK_SIZE", DEFAULT_CHUNK_SIZE),
    concurrency: config?.concurrency && config.concurrency >= 1
      ? Math.floor(config.concurrency)
      : envInt("MONTHLY_ANALYSIS_CHUNK_CONCURRENCY", DEFAULT_CONCURRENCY),
  };
}

function splitIntoChunks<I>(items: I[], size: number): I[][] {
  const chunks: I[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Soma tokens/custo de todos os lotes; provider/model/traceId do primeiro lote
// (são homogêneos — mesma task → mesma rota). content é irrelevante agregado:
// os nós consomem `data`, não `response.content`.
function aggregateResponses(responses: LlmResponse[]): LlmResponse {
  if (responses.length === 0) return NOOP_LLM_RESPONSE;
  const first = responses[0]!;
  return {
    content: "",
    provider: first.provider,
    model: first.model,
    inputTokens: responses.reduce((sum, r) => sum + r.inputTokens, 0),
    outputTokens: responses.reduce((sum, r) => sum + r.outputTokens, 0),
    costCents: responses.reduce((sum, r) => sum + r.costCents, 0),
    traceId: first.traceId,
  };
}

/**
 * Roda `runFn` sobre `items` divididos em lotes processados em paralelo (com
 * limite de concorrência), preservando a ordem e agregando a telemetria.
 *
 * Por quê: nós como normalize/clarity/dre-classifier geram output proporcional
 * ao nº de lançamentos numa única chamada LLM. No Vertex southamerica-east1
 * (throughput limitado pela LGPD/ADR-009), uma chamada de ~6k tokens de saída
 * leva ~90s. Dividir em lotes concorrentes reduz o wall-clock ao lote mais
 * lento (não à soma), sem mudar o contrato de saída por entryId.
 *
 * Garantias:
 * - items vazio → telemetria noop, sem chamar LLM.
 * - ≤ 1 lote (items.length ≤ chunkSize) → chama runFn direto, sem overhead.
 * - Cada lote faz seu próprio callLlm → continua emitindo span LangSmith (C6).
 * - latencyMs reflete o wall-clock real do pool, não a soma dos lotes.
 */
export async function runChunkedWithTelemetry<I, T, O>(
  items: I[],
  options: O,
  runFn: (chunk: I[], options: O) => Promise<TelemetryResult<T>>,
  config?: ChunkConfig,
): Promise<TelemetryResult<T>> {
  if (items.length === 0) {
    return { data: [], response: NOOP_LLM_RESPONSE, latencyMs: 0 };
  }

  const { chunkSize, concurrency } = resolveChunkConfig(config);

  if (items.length <= chunkSize) {
    return runFn(items, options);
  }

  const chunks = splitIntoChunks(items, chunkSize);
  const start = Date.now();
  const results = await mapWithConcurrency(chunks, concurrency, (chunk) => runFn(chunk, options));
  const latencyMs = Date.now() - start;

  return {
    data: results.flatMap((r) => r.data),
    response: aggregateResponses(results.map((r) => r.response)),
    latencyMs,
  };
}

export const _internals = {
  splitIntoChunks,
  mapWithConcurrency,
  aggregateResponses,
  resolveChunkConfig,
};
