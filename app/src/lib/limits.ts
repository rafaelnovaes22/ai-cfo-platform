// Limites de entrada espelhados do backend (src/ingest/schemas.ts e
// src/ingest/normalize.ts). Fonte da verdade é o backend; aqui é a primeira
// linha de defesa para o usuário receber erro claro antes do request.
export const LIMITS = {
  /** Tamanho máximo de arquivo aceito no client (a UI promete 10 MB). */
  FILE_MAX_BYTES: 10 * 1024 * 1024,
  /** Texto colado no import (backend: MAX_CLIPBOARD_CHARS). */
  PASTE_MAX_CHARS: 1_000_000,
  /** Valor máximo por lançamento em reais (backend: MAX_AMOUNT_REAIS; cabe no Int4 em cents). */
  AMOUNT_MAX_REAIS: 20_000_000,
  /** Descrição de lançamento (backend: MAX_DESCRIPTION_CHARS). */
  DESCRIPTION_MAX_CHARS: 200,
} as const;

export const ACCEPTED_FILE_EXTENSIONS = ["pdf", "xlsx", "xls", "csv"] as const;

export function isAcceptedFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return (ACCEPTED_FILE_EXTENSIONS as readonly string[]).includes(ext);
}

export function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
