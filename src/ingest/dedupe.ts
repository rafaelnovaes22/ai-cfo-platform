// Deduplicação determinística de lançamentos.
// O cliente vai acumulando extratos ao longo do tempo; reenviar o mesmo arquivo
// (ou um que sobreponha um período já enviado) não pode duplicar lançamentos no
// banco — senão o fluxo de caixa, que agrega por tenant+período, infla.
//
// Sem identificador de transação (FITID/OFX), a dedup é por conteúdo:
// data | descrição | valor | direção. Lançamentos legitimamente idênticos no
// MESMO lote (ex.: duas tarifas iguais no dia) são preservados via índice de
// ocorrência; reenviar o lote gera os mesmos hashes e a inserção dedupada os
// bloqueia. O hash é md5 (não-segurança) para ser idêntico em TS e no SQL do
// backfill da migration.

import { createHash } from "node:crypto";

export interface DedupeKeyFields {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number; // sempre positivo
  direction: "credit" | "debit";
}

// Base estável do lançamento. Sem normalizar acento/caixa: duplicatas de reenvio
// são byte-idênticas e o backfill SQL precisa reproduzir exatamente esta string.
function dedupeBase(e: DedupeKeyFields): string {
  return `${e.date}|${e.description}|${e.amountCents}|${e.direction}`;
}

export function computeDedupeHash(e: DedupeKeyFields, occurrence = 0): string {
  return createHash("md5").update(`${dedupeBase(e)}#${occurrence}`).digest("hex");
}

/**
 * dedupeHash de cada lançamento de UM lote (arquivo/ingest), com índice de
 * ocorrência por base. Determinístico pela ordem das linhas do arquivo, então o
 * reenvio do mesmo arquivo produz os mesmos hashes.
 */
export function computeDedupeHashes(entries: DedupeKeyFields[]): string[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const base = dedupeBase(e);
    const occ = seen.get(base) ?? 0;
    seen.set(base, occ + 1);
    return computeDedupeHash(e, occ);
  });
}
