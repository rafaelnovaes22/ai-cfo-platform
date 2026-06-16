import { describe, it, expect, vi, afterEach } from "vitest";
import {
  runChunkedWithTelemetry,
  _internals,
  type TelemetryResult,
} from "@/monthly-analysis/agents/chunk-runner.js";
import type { LlmResponse } from "@/llm/types.js";

function resp(input: number, output: number, cost: number): LlmResponse {
  return {
    content: "x",
    provider: "google",
    model: "gemini-2.5-flash-lite",
    inputTokens: input,
    outputTokens: output,
    costCents: cost,
    traceId: "trace-1",
  };
}

// runFn identidade: devolve o próprio chunk como data, com telemetria fixa.
function identityRun(input: number, output: number, cost: number) {
  return async (chunk: number[]): Promise<TelemetryResult<number>> => ({
    data: chunk,
    response: resp(input, output, cost),
    latencyMs: 1,
  });
}

afterEach(() => {
  delete process.env.MONTHLY_ANALYSIS_CHUNK_SIZE;
  delete process.env.MONTHLY_ANALYSIS_CHUNK_CONCURRENCY;
});

describe("runChunkedWithTelemetry", () => {
  it("não chama runFn para input vazio e devolve telemetria noop", async () => {
    const runFn = vi.fn(identityRun(1, 1, 1));
    const result = await runChunkedWithTelemetry<number, number, undefined>([], undefined, runFn);

    expect(result.data).toEqual([]);
    expect(result.response.provider).toBe("local");
    expect(result.response.model).toBe("noop");
    expect(result.latencyMs).toBe(0);
    expect(runFn).not.toHaveBeenCalled();
  });

  it("chama runFn uma única vez quando cabe em um lote (sem overhead de split)", async () => {
    const runFn = vi.fn(identityRun(5, 5, 2));
    const items = [1, 2, 3];
    const result = await runChunkedWithTelemetry<number, number, undefined>(
      items,
      undefined,
      runFn,
      { chunkSize: 10 },
    );

    expect(runFn).toHaveBeenCalledTimes(1);
    expect(runFn).toHaveBeenCalledWith(items, undefined);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it("divide em lotes, preserva a ordem e agrega tokens/custo", async () => {
    const runFn = vi.fn(identityRun(4, 6, 3));
    const items = [0, 1, 2, 3, 4]; // chunkSize 2 → [0,1] [2,3] [4]
    const result = await runChunkedWithTelemetry<number, number, undefined>(
      items,
      undefined,
      runFn,
      { chunkSize: 2, concurrency: 4 },
    );

    expect(runFn).toHaveBeenCalledTimes(3);
    expect(result.data).toEqual([0, 1, 2, 3, 4]);
    // 3 lotes: tokens e custo somados.
    expect(result.response.inputTokens).toBe(12);
    expect(result.response.outputTokens).toBe(18);
    expect(result.response.costCents).toBe(9);
    expect(result.response.provider).toBe("google");
  });

  it("preserva a ordem mesmo quando lotes terminam fora de ordem", async () => {
    // Lotes com primeiro elemento menor demoram MAIS → terminam por último.
    const runFn = async (chunk: number[]): Promise<TelemetryResult<number>> => {
      await new Promise((r) => setTimeout(r, 30 - chunk[0]!));
      return { data: chunk, response: resp(1, 1, 1), latencyMs: 1 };
    };
    const items = [0, 1, 2, 3, 4, 5];
    const result = await runChunkedWithTelemetry<number, number, undefined>(
      items,
      undefined,
      runFn,
      { chunkSize: 2, concurrency: 3 },
    );

    expect(result.data).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("respeita o limite de concorrência", async () => {
    let active = 0;
    let maxActive = 0;
    const runFn = async (chunk: number[]): Promise<TelemetryResult<number>> => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 10));
      active -= 1;
      return { data: chunk, response: resp(1, 1, 1), latencyMs: 1 };
    };
    const items = [0, 1, 2, 3, 4, 5, 6, 7]; // chunkSize 1 → 8 lotes
    await runChunkedWithTelemetry<number, number, undefined>(items, undefined, runFn, {
      chunkSize: 1,
      concurrency: 2,
    });

    expect(maxActive).toBe(2);
  });

  it("passa as mesmas options para todos os lotes", async () => {
    const seen: string[] = [];
    const runFn = async (chunk: number[], options: { tag: string }): Promise<TelemetryResult<number>> => {
      seen.push(options.tag);
      return { data: chunk, response: resp(1, 1, 1), latencyMs: 1 };
    };
    await runChunkedWithTelemetry([0, 1, 2, 3], { tag: "ctx" }, runFn, { chunkSize: 1 });

    expect(seen).toEqual(["ctx", "ctx", "ctx", "ctx"]);
  });

  it("usa MONTHLY_ANALYSIS_CHUNK_SIZE do env quando config não é passado", async () => {
    process.env.MONTHLY_ANALYSIS_CHUNK_SIZE = "2";
    const runFn = vi.fn(identityRun(1, 1, 1));
    await runChunkedWithTelemetry<number, number, undefined>([0, 1, 2, 3, 4], undefined, runFn);

    // chunkSize 2 sobre 5 itens → 3 lotes.
    expect(runFn).toHaveBeenCalledTimes(3);
  });
});

describe("chunk-runner _internals", () => {
  it("splitIntoChunks divide em lotes contíguos do tamanho pedido", () => {
    expect(_internals.splitIntoChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(_internals.splitIntoChunks([], 2)).toEqual([]);
  });

  it("resolveChunkConfig prioriza config > env > default e ignora valores inválidos", () => {
    expect(_internals.resolveChunkConfig({ chunkSize: 7, concurrency: 3 })).toEqual({
      chunkSize: 7,
      concurrency: 3,
    });

    process.env.MONTHLY_ANALYSIS_CHUNK_SIZE = "abc"; // inválido → default 15
    expect(_internals.resolveChunkConfig().chunkSize).toBe(15);

    process.env.MONTHLY_ANALYSIS_CHUNK_CONCURRENCY = "6";
    expect(_internals.resolveChunkConfig().concurrency).toBe(6);
  });

  it("aggregateResponses devolve noop para lista vazia", () => {
    const agg = _internals.aggregateResponses([]);
    expect(agg.model).toBe("noop");
    expect(agg.inputTokens).toBe(0);
  });
});
