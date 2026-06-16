import { describe, it, expect } from "vitest";
import { computeDedupeHashes, computeDedupeHash } from "@/ingest/dedupe.js";
import type { DedupeKeyFields } from "@/ingest/dedupe.js";

function e(overrides: Partial<DedupeKeyFields> = {}): DedupeKeyFields {
  return {
    date: "2026-04-30",
    description: "Pix recebido",
    amountCents: 150_000,
    direction: "credit",
    ...overrides,
  };
}

describe("ingest/dedupe — computeDedupeHashes", () => {
  it("reenviar o mesmo lote produz exatamente os mesmos hashes (dedup de reenvio)", () => {
    const lote = [e({ description: "A" }), e({ description: "B" }), e({ description: "C" })];
    expect(computeDedupeHashes(lote)).toEqual(computeDedupeHashes(lote));
  });

  it("lançamentos diferentes geram hashes distintos", () => {
    const hashes = computeDedupeHashes([
      e({ description: "Energia", amountCents: 151_000, direction: "debit" }),
      e({ description: "Aluguel", amountCents: 420_000, direction: "debit" }),
      e({ description: "Venda", amountCents: 100_000, direction: "credit" }),
    ]);
    expect(new Set(hashes).size).toBe(3);
  });

  it("lançamentos legitimamente idênticos no mesmo lote coexistem (índice de ocorrência)", () => {
    // Duas tarifas iguais no mesmo dia: hashes distintos → ambas preservadas.
    const hashes = computeDedupeHashes([
      e({ description: "Tarifa bancária", amountCents: 1_500, direction: "debit" }),
      e({ description: "Tarifa bancária", amountCents: 1_500, direction: "debit" }),
    ]);
    expect(hashes[0]).not.toBe(hashes[1]);
    expect(new Set(hashes).size).toBe(2);
  });

  it("direção e valor entram na chave (mesma descrição/data, sentidos opostos = distintos)", () => {
    const [credit] = computeDedupeHashes([e({ direction: "credit" })]);
    const [debit] = computeDedupeHashes([e({ direction: "debit" })]);
    expect(credit).not.toBe(debit);
  });

  it("computeDedupeHash é estável e casa com a 1ª ocorrência do lote", () => {
    const single = e({ description: "X" });
    expect(computeDedupeHashes([single])[0]).toBe(computeDedupeHash(single, 0));
  });
});
