// Como a direção foi determinada no parse:
// - "explicit": coluna Tipo/D-C preenchida, colunas separadas de crédito/débito,
//   entrada manual ou formato que garante sinal (extrato bancário, DRE)
// - "sign": sinal negativo no próprio valor (negativo = débito é fato)
// - "fallback": valor positivo sem nenhum marcador — credit é CHUTE, não fato.
//   O classificador LLM pode corrigir (ver computeDirectionInferred no service).
// - "description": direção inferida do texto do lançamento por heurística
//   determinística (energia/aluguel/DAS → débito), aplicada ao fallback no
//   service. Mais confiável que fallback; vale também no free tier (sem LLM).
export type DirectionSource = "explicit" | "sign" | "fallback" | "description";

export interface RawLedger {
  date: string;        // YYYY-MM-DD normalizado
  description: string;
  amountCents: number; // sempre positivo; direction indica sentido
  direction: "credit" | "debit";
  directionSource?: DirectionSource;
  // Preenchido pelo parsePdfDre — pula classificação LLM
  confirmedCategory?: string;
  correctionSource?: string;
  classificationConfidence?: number;
}

export type IngestOutcome = "completed" | "partial" | "failed";

export interface ParseResult {
  entries: RawLedger[];
  orphanCount: number;  // linhas que não foi possível parsear
  referenceMonth?: string; // YYYY-MM detectado do documento, quando aplicável
}

export interface IngestResult {
  analysisId: string;
  referenceMonth: string;
  entryCount: number;
  orphanCount: number;
  outcome: IngestOutcome;
}
