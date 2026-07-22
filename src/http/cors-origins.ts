// Origens CORS adicionais de plataforma (PaaS). Em vez de hard-codar hostnames
// do provedor de deploy, o padrão vem de CORS_ORIGIN_PATTERN (regex aplicada à
// origem completa, ex.: "^https://myapp[a-z0-9-]*\\.myplatform\\.example$").
// O padrão só é ativado quando a app roda na plataforma (RAILWAY_ENVIRONMENT
// presente) — um wildcard amplo aceitaria QUALQUER app do provedor, inclusive de
// terceiros, como origem CORS válida. Domínios canônicos entram via FRONTEND_ORIGIN.
const LOCAL_FRONTEND_ORIGIN = "http://localhost:5173";

function parseFrontendOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function buildCorsOrigins(env: NodeJS.ProcessEnv = process.env): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [LOCAL_FRONTEND_ORIGIN, ...parseFrontendOrigins(env.FRONTEND_ORIGIN)];

  if (env.RAILWAY_ENVIRONMENT && env.CORS_ORIGIN_PATTERN) {
    origins.push(new RegExp(env.CORS_ORIGIN_PATTERN));
  }

  return origins;
}
