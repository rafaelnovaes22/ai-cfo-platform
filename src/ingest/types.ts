export interface RawLedger {
  date: string;        // YYYY-MM-DD normalizado
  description: string;
  amountCents: number; // sempre positivo; direction indica sentido
  direction: "credit" | "debit";
}

export type IngestOutcome = "completed" | "partial" | "failed";

export interface ParseResult {
  entries: RawLedger[];
  orphanCount: number;  // linhas que não foi possível parsear
}

export interface IngestResult {
  analysisId: string;
  referenceMonth: string;
  entryCount: number;
  orphanCount: number;
  outcome: IngestOutcome;
}
