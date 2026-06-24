const RAILWAY_APP_ORIGIN = /^https:\/\/.*\.up\.railway\.app$/;
const LOCAL_FRONTEND_ORIGIN = "http://localhost:5173";

function parseFrontendOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function buildCorsOrigins(env: NodeJS.ProcessEnv = process.env): (string | RegExp)[] {
  const origins: (string | RegExp)[] = [LOCAL_FRONTEND_ORIGIN, ...parseFrontendOrigins(env.FRONTEND_ORIGIN)];

  if (env.RAILWAY_ENVIRONMENT) {
    origins.push(RAILWAY_APP_ORIGIN);
  }

  return origins;
}
