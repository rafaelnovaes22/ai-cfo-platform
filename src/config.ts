import { z } from "zod";
import { logger } from "@/observability/logger.js";

// Validação fail-fast de configuração na boot (C7 — config central).
//
// NÃO substitui os process.env espalhados (migração incremental fica para depois);
// o valor aqui é detectar, na SUBIDA do processo, env obrigatória ausente ou
// malformada — em vez de só descobrir no primeiro uso em runtime. Foi exatamente
// esse modo de falha (GOOGLE_CLOUD_PROJECT some → cai em fallback silencioso) que
// motivou este guard.
//
// Conservador por design: marcar uma env como obrigatória erroneamente derruba a
// boot de algum ambiente. Por isso só falha no que é incontestável (DATABASE_URL,
// JWT_SECRET sempre; e o que produção precisa para não rodar errado em silêncio),
// usa refinements para grupos (Stripe, WhatsApp, LLM), e o resto vira warning.

function isProd(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.RAILWAY_ENVIRONMENT) || env.NODE_ENV === "production";
}

// Formato das envs que, quando presentes, devem ser bem-formadas.
const FormatSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  PORT: z.string().regex(/^\d+$/, "PORT deve ser numérico").optional(),
  APP_URL: z.string().url().optional(),
  PUBLIC_API_URL: z.string().url().optional(),
});

export interface EnvValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prod = isProd(env);

  // 1. Formato das presentes
  const fmt = FormatSchema.safeParse(env);
  if (!fmt.success) {
    for (const issue of fmt.error.issues) errors.push(`${issue.path.join(".")}: ${issue.message}`);
  }

  const has = (k: string): boolean => typeof env[k] === "string" && env[k]!.trim() !== "";
  const requireAlways = (k: string): void => { if (!has(k)) errors.push(`${k} é obrigatória (ausente)`); };
  // Subsistemas: avisam mas NÃO abortam a boot. Têm fail-fast próprio no uso
  // (ex: billing em stripe.ts) ou fallback. Marcá-los como fatais derrubaria
  // ambientes legítimos sem aquele subsistema (ex: staging sem Stripe).
  const recommend = (k: string, why: string): void => { if (!has(k)) warnings.push(`${k} ausente — ${why}`); };

  // 2. Incontestáveis: sem isto o app não opera de jeito nenhum. ABORTA a boot.
  requireAlways("DATABASE_URL");
  requireAlways("JWT_SECRET");

  // 3. LLM: pelo menos um provider (senão NENHUMA análise roda). ABORTA.
  //    Vertex (GOOGLE_CLOUD_PROJECT) OU AI Studio (GOOGLE_API_KEY) OU OpenAI.
  if (!has("GOOGLE_CLOUD_PROJECT") && !has("GOOGLE_API_KEY") && !has("OPENAI_API_KEY")) {
    errors.push("nenhum provider LLM configurado — defina GOOGLE_CLOUD_PROJECT (Vertex), GOOGLE_API_KEY (AI Studio) ou OPENAI_API_KEY");
  }

  // 4. WhatsApp fail-closed (condicional): só ABORTA se o canal foi ativado
  //    (token presente) mas sem o app secret — config intencional e perigosa.
  if (has("META_ACCESS_TOKEN") && !has("META_APP_SECRET")) {
    errors.push("META_APP_SECRET ausente com META_ACCESS_TOKEN presente — webhook WhatsApp rejeitaria tudo (401)");
  }

  // 5. Subsistemas e recomendações (WARNING — não abortam; visíveis nos logs/auditoria).
  recommend("REDIS_URL", "fila/rate-limit degradam; em produção não pode cair em localhost");
  recommend("ADMIN_API_KEY", "rotas /admin/* ficam sem proteção de chave");
  recommend("STRIPE_SECRET_KEY", "billing indisponível (stripe.ts falha no uso)");
  recommend("STRIPE_WEBHOOK_SECRET", "webhook Stripe não pode ser verificado");
  if (prod && !has("GOOGLE_CLOUD_PROJECT")) {
    warnings.push("GOOGLE_CLOUD_PROJECT ausente em produção — primário cai em AI Studio/fallback (LGPD: produção deve usar Vertex, ADR-009/019)");
  }
  if (!has("LANGSMITH_API_KEY") && !has("LANGCHAIN_API_KEY")) {
    warnings.push("LANGSMITH_API_KEY ausente — tracing C6 desabilitado (sem outcome auditável)");
  }

  return { ok: errors.length === 0, errors, warnings };
}

// Roda a validação e ABORTA o processo se houver erro. Chamado na boot do server.
export function assertEnvOrExit(env: NodeJS.ProcessEnv = process.env): void {
  const { ok, errors, warnings } = validateEnv(env);
  for (const w of warnings) logger.warn({ env_warning: w }, `config: ${w}`);
  if (!ok) {
    for (const e of errors) logger.error({ env_error: e }, `config: ${e}`);
    logger.error(`config: ${errors.length} erro(s) de configuração — abortando boot. Corrija as envs acima.`);
    process.exit(1);
  }
  logger.info({ checks: "env" }, "config: validação de ambiente OK");
}
