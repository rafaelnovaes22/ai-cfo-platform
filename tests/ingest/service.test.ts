import { describe, expect, it, vi } from "vitest";
import { shouldSkipClassification } from "@/ingest/service.js";
import type { RawLedger } from "@/ingest/types.js";

vi.mock("@/persistence/prisma.js", () => ({ getPrisma: vi.fn() }));
vi.mock("@/queue/index.js", () => ({
  enqueueClassification: vi.fn(),
  enqueueDreNarrative: vi.fn(),
}));
vi.mock("@/ingest/parsers/excel.js", () => ({ parseExcel: vi.fn() }));
vi.mock("@/ingest/parsers/text.js", () => ({ parseText: vi.fn() }));
vi.mock("@/ingest/parsers/pdf-dre.js", () => ({ parsePdfDre: vi.fn() }));
vi.mock("@/ingest/parsers/manual.js", () => ({ parseManual: vi.fn() }));
vi.mock("@/observability/langfuse.js", () => ({ createTrace: vi.fn() }));
vi.mock("@/observability/logger.js", () => ({ logger: { error: vi.fn(), info: vi.fn() } }));

function entry(overrides: Partial<RawLedger> = {}): RawLedger {
  return {
    date: "2026-03-31",
    description: "Linha DRE",
    amountCents: 100_00,
    direction: "debit",
    ...overrides,
  };
}

describe("ingest/service pipeline routing", () => {
  it("pula classificacao quando todas as entradas ja vieram categorizadas pela DRE", () => {
    expect(shouldSkipClassification([
      entry({ confirmedCategory: "receita_bruta" }),
      entry({ confirmedCategory: "despesas_comerciais" }),
    ])).toBe(true);
  });

  it("mantem classificacao quando alguma entrada ainda nao tem categoria confirmada", () => {
    expect(shouldSkipClassification([
      entry({ confirmedCategory: "receita_bruta" }),
      entry(),
    ])).toBe(false);
  });

  it("mantem classificacao para listas vazias", () => {
    expect(shouldSkipClassification([])).toBe(false);
  });
});
