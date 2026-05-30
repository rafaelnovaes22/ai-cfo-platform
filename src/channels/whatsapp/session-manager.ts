// C7 — RedisSessionStore abstrai o provider de persistência de sessão
// C8 — nenhum tenantId hardcoded; resolvido em runtime pela sessão
import IORedis from "ioredis";
import type { IWhatsAppSessionStore, WaSession } from "./types.js";

export const SESSION_KEY_PREFIX = "whatsapp:session:";

const DEFAULT_TTL_SECONDS = 1800;

export class RedisSessionStore implements IWhatsAppSessionStore {
  constructor(private readonly redis: IORedis) {}

  async get(phoneE164: string): Promise<WaSession | null> {
    const raw = await this.redis.get(`${SESSION_KEY_PREFIX}${phoneE164}`);
    if (raw === null) return null;
    return JSON.parse(raw) as WaSession;
  }

  async set(session: WaSession, ttlSeconds: number = DEFAULT_TTL_SECONDS): Promise<void> {
    session.updatedAt = new Date().toISOString();
    await this.redis.set(
      `${SESSION_KEY_PREFIX}${session.phoneE164}`,
      JSON.stringify(session),
      "EX",
      ttlSeconds,
    );
  }

  async del(phoneE164: string): Promise<void> {
    await this.redis.del(`${SESSION_KEY_PREFIX}${phoneE164}`);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────
// Segue o mesmo padrão lazy de src/queue/index.ts: uma conexão IORedis por
// processo, criada na primeira chamada e reutilizada nas subsequentes.
// maxRetriesPerRequest: null é exigido pelo BullMQ e mantido aqui por
// consistência com o restante do projeto.

let _redis: IORedis | null = null;
let _sessionStore: RedisSessionStore | null = null;

function getRedis(): IORedis {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    const isRailwayInternal = url.includes(".railway.internal");
    _redis = new IORedis(url, {
      maxRetriesPerRequest: null,
      ...(isRailwayInternal ? { family: 6 } : {}),
    });
  }
  return _redis;
}

export function getSessionStore(): RedisSessionStore {
  if (!_sessionStore) {
    _sessionStore = new RedisSessionStore(getRedis());
  }
  return _sessionStore;
}
