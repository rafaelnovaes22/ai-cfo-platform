import Langfuse from "langfuse";

let _client: Langfuse | null = null;

function getClient(): Langfuse {
  if (!_client) {
    _client = new Langfuse({
      publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? "",
      secretKey: process.env.LANGFUSE_SECRET_KEY ?? "",
      baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
      flushAt: 20,
      flushInterval: 10_000,
    });
  }
  return _client;
}

export interface TraceOptions {
  name: string;
  tenantId: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
}

export function createTrace(opts: TraceOptions) {
  return getClient().trace({
    id: opts.traceId,
    name: opts.name,
    userId: opts.tenantId,
    metadata: opts.metadata,
  });
}

export async function flushLangfuse(): Promise<void> {
  await _client?.flushAsync();
}
