import { randomUUID } from "crypto";
import { RunTree } from "langsmith";

// No-op child returned when LangSmith is not configured
const noopChild = { end: (_opts?: unknown) => {} };

function makeNoopTrace(id: string) {
  return {
    id,
    generation: (_opts?: unknown) => noopChild,
    span: (_opts?: unknown) => noopChild,
    update: async (_opts?: unknown) => {},
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
      end: (endOpts: ChildOpts) => {
        const outputs =
          endOpts.output != null ? { output: endOpts.output } : (endOpts as Record<string, unknown>);
        void child.end(outputs).then(() => child.patchRun());
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
  };
}

// Kept for backward compat (server.ts shutdown hook); LangSmith posts are fire-and-forget.
export async function flushLangfuse(): Promise<void> {}
