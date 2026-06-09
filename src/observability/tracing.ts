import { randomUUID } from "crypto";
import { RunTree } from "langsmith";

// Provider-agnostic tracing layer (C6 + C7). Implementação atual via LangSmith,
// mas a interface não vaza o provider — toda mudança de tracer mora aqui.

const noopChild = { end: async (_opts?: unknown): Promise<void> => {} };

function makeNoopTrace(id: string) {
  return {
    id,
    generation: (_opts?: unknown) => noopChild,
    span: (_opts?: unknown) => noopChild,
    update: async (_opts?: unknown) => {},
    end: async () => {},
  };
}

function isConfigured(): boolean {
  return !!(process.env.LANGSMITH_API_KEY ?? process.env.LANGCHAIN_API_KEY);
}

export interface TraceOptions {
  name: string;
  tenantId: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
}

type ChildOpts = Record<string, unknown>;

export function createTrace(opts: TraceOptions) {
  if (!isConfigured()) return makeNoopTrace(opts.traceId ?? randomUUID());

  const run = new RunTree({
    id: opts.traceId,
    name: opts.name,
    run_type: "chain",
    inputs: { tenantId: opts.tenantId },
    metadata: opts.metadata ?? {},
    project_name: process.env.LANGSMITH_PROJECT ?? "aicfo",
  });
  void run.postRun();

  function makeChild(runType: "llm" | "tool", childOpts: ChildOpts) {
    const child = run.createChild({
      name: String(childOpts.name ?? runType),
      run_type: runType,
      inputs: (childOpts.input as Record<string, unknown>) ?? {},
    });
    void child.postRun();

    return {
      end: async (endOpts: ChildOpts): Promise<void> => {
        const outputs =
          endOpts.output != null ? { output: endOpts.output } : (endOpts as Record<string, unknown>);

        const usage = endOpts.usage as { input?: number; output?: number } | undefined;

        // Marca o run como ERROR no LangSmith quando a geração falhou.
        const errorMsg =
          endOpts.level === "ERROR" || endOpts.error != null
            ? typeof endOpts.error === "string"
              ? endOpts.error
              : JSON.stringify(endOpts.error ?? endOpts.output ?? "error")
            : undefined;

        await child.end(outputs, errorMsg);

        if (usage?.input != null || usage?.output != null) {
          const inputTokens = usage.input ?? 0;
          const outputTokens = usage.output ?? 0;
          // LangSmith lê tokens de extra.metadata.usage_metadata (input_tokens/output_tokens)
          const existing = (child as any).extra as Record<string, unknown> ?? {};
          const existingMeta = (existing.metadata as Record<string, unknown>) ?? {};
          (child as any).extra = {
            ...existing,
            metadata: {
              ...existingMeta,
              usage_metadata: {
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                total_tokens: inputTokens + outputTokens,
              },
            },
          };
        }

        await child.patchRun();
      },
    };
  }

  return {
    id: run.id,
    generation: (childOpts: ChildOpts) => makeChild("llm", childOpts),
    span: (childOpts: ChildOpts) => makeChild("tool", childOpts),
    update: async (updateOpts: { metadata?: Record<string, unknown> }) => {
      run.metadata = { ...(run.metadata as Record<string, unknown>), ...(updateOpts.metadata ?? {}) };
      await run.patchRun();
    },
    end: async (outputs?: Record<string, unknown>) => {
      await run.end(outputs ?? {});
      await run.patchRun();
    },
  };
}

// Flush hook chamado no shutdown do server. Reservado para casos futuros em que
// o provider precise de drain explícito (LangSmith atualmente é fire-and-forget).
export async function flushTraces(): Promise<void> {}
