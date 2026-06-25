// Helpers de leitura de variáveis de ambiente, agnósticos a provider/domínio (C7).
// Compartilhado entre o ingest e o pipeline monthly-analysis para tuning de
// concorrência sem hardcode.

/**
 * Inteiro >= 1 lido de uma env var, com fallback. Valores ausentes, não-numéricos
 * ou < 1 caem no fallback. Trunca para inteiro.
 */
export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? fallback : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}
