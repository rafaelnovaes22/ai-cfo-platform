// Predicados puros do módulo export — extraídos para serem testáveis em isolamento.
// Em vez de testar rotas via app.inject, testamos as regras críticas (C4 status gate,
// C8 filename sanitization) diretamente, e a rota apenas as compõe.

/** C4 — análise só pode ser exportada quando o cliente já recebeu (delivered) OU fechou (approved). */
export const EXPORTABLE_STATUS = ["delivered", "approved"] as const;

export type ExportableStatus = (typeof EXPORTABLE_STATUS)[number];

export function isExportableStatus(status: string): status is ExportableStatus {
  return (EXPORTABLE_STATUS as readonly string[]).includes(status);
}

/** C8 — referenceMonth válido = "YYYY-MM". Defesa contra filename injection via dado persistido. */
const REFERENCE_MONTH_RE = /^\d{4}-\d{2}$/;

export function isSafeReferenceMonth(raw: string): boolean {
  return REFERENCE_MONTH_RE.test(raw);
}

export function sanitizeReferenceMonth(raw: string): string {
  return isSafeReferenceMonth(raw) ? raw : "invalid";
}

export type ReportType = "monthly" | "investors" | "partners";

export function buildExportFilename(referenceMonth: string, type: ReportType): string {
  return `aicfo-${sanitizeReferenceMonth(referenceMonth)}-${type}.pdf`;
}

/**
 * Resultado da decisão de export antes da geração do PDF.
 * Permite testar a árvore de erros sem montar Fastify completo.
 */
export type ExportDecision =
  | { status: "ok" }
  | { status: "not_found" }
  | { status: "status_gate"; analysisStatus: string }
  | { status: "dre_missing" };

export interface AnalysisLike {
  status: string;
  dreJson: unknown;
}

export function decideExport(analysis: AnalysisLike | null | undefined): ExportDecision {
  if (!analysis) return { status: "not_found" };
  if (!isExportableStatus(analysis.status)) {
    return { status: "status_gate", analysisStatus: analysis.status };
  }
  if (!analysis.dreJson) return { status: "dre_missing" };
  return { status: "ok" };
}
