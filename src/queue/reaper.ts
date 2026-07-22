import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";

// Rede de segurança para o estado terminal da análise. Uma análise sai de
// `generating` por dois caminhos: o `finalize` do grafo (→ ready/delivered) ou o
// handler `failed` do BullMQ após esgotar as tentativas. Se o worker morre no meio
// (OOM/redeploy sob carga), o job em voo fica órfão — nenhum dos dois caminhos roda
// e a análise fica presa em `generating` para sempre, invisível como falha. O reaper
// varre periodicamente e marca essas zumbis como `failed`, para o usuário poder
// re-tentar em vez de esperar indefinidamente. O teto deve ser MAIOR que
// GRAPH_JOB_TIMEOUT_MS (o timeout do processor é o caminho preciso; o reaper só pega
// o que escapou dele).
const DEFAULT_REAPER_CUTOFF_MS = 15 * 60_000;

export function resolveReaperCutoffMs(): number {
  const raw = Number(process.env.ANALYSIS_REAPER_CUTOFF_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_REAPER_CUTOFF_MS;
}

// Marca como `failed` toda análise presa em `generating` cujo último update é
// anterior ao teto. Usa updatedAt (tocado ao entrar em `generating` e no finalize),
// não createdAt — assim um re-upsert antigo não dispara falso-positivo. Retorna
// quantas foram ceifadas.
export async function reapStuckAnalyses(cutoffMs: number = resolveReaperCutoffMs()): Promise<number> {
  const cutoff = new Date(Date.now() - cutoffMs);
  const { count } = await getPrisma().monthlyAnalysis.updateMany({
    where: { status: "generating", updatedAt: { lt: cutoff } },
    data: { status: "failed" },
  });
  if (count > 0) {
    logger.warn({ count, cutoffMs }, "analysis-reaper: análises presas em generating marcadas como failed");
  }
  return count;
}
