import IORedis from "ioredis";
import type { RateLimitPluginOptions } from "@fastify/rate-limit";

// Rate limit Redis-backed (Gate 2.3).
//
// O store padrão do @fastify/rate-limit é in-memory — NÃO é compartilhado entre
// réplicas. Com N réplicas web atrás do LB, cada uma conta sozinha e o limite
// efetivo vira N×max. Em ambiente Railway (múltiplas réplicas + Redis gerenciado)
// usamos um store Redis compartilhado; em dev local (single instance) mantemos o
// in-memory, para subir sem depender de Redis.

// Só usa Redis quando há ambiente Railway E REDIS_URL — evita que o dev local
// tente conectar a um Redis inexistente na boot do servidor.
export function shouldUseRedisStore(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.RAILWAY_ENVIRONMENT) && Boolean(env.REDIS_URL);
}

let _redis: IORedis | null = null;

function rateLimitRedis(url: string): IORedis {
  if (_redis) return _redis;
  const isRailwayInternal = url.includes(".railway.internal");
  _redis = new IORedis(url, {
    // Falha rápido para não segurar requests se o Redis travar; combinado com
    // skipOnError:true (fail-open) abaixo, o rate limit nunca derruba o tráfego.
    connectTimeout: 500,
    maxRetriesPerRequest: 1,
    ...(isRailwayInternal ? { family: 6 } : {}),
  });
  return _redis;
}

export function buildRateLimitOptions(env: NodeJS.ProcessEnv = process.env): RateLimitPluginOptions {
  // Usa a url do env recebido (consistente com shouldUseRedisStore), não process.env.
  const redis = shouldUseRedisStore(env) && env.REDIS_URL ? rateLimitRedis(env.REDIS_URL) : undefined;
  return {
    max: Number(env.RATE_LIMIT_MAX ?? 100),
    timeWindow: "1 minute",
    keyGenerator: (req) => req.ip,
    skipOnError: true, // fail-open: se o store (Redis) falhar, não bloqueia o tráfego
    ...(redis ? { redis } : {}),
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      message: `Limite de requisições atingido. Tente novamente em ${Math.ceil(context.ttl / 1000)}s.`,
    }),
  };
}
