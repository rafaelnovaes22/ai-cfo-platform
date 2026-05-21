import { randomUUID } from "crypto";
import Langfuse from "langfuse";

const noopChild = { end: () => {} };

function makeNoopTrace(id: string) {
  return {
    id,
    generation: () => noopChild,
    span: () => noopChild,
    update: async () => {},
  };
}

let _client: Langfuse | null = null;

function getClient(): Langfuse | null {
  const secret = process.env.LANGFUSE_SECRET_KEY;
  const pub = process.env.LANGFUSE_PUBLIC_KEY;
  if (!secret || !pub) return null;

  if (!_client) {
    _client = new Langfuse({
      publicKey: pub,
      secretKey: secret,
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
  const client = getClient();
  if (!client) return makeNoopTrace(opts.traceId ?? randomUUID());

  return client.trace({
    id: opts.traceId,
    name: opts.name,
    userId: opts.tenantId,
    metadata: opts.metadata,
  });
}

export async function flushLangfuse(): Promise<void> {
  await _client?.flushAsync();
}
