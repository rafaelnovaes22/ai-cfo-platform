import { describe, expect, it, vi } from "vitest";
import { filterEntriesByReferenceMonth, shouldSkipClassification, predominantMonth } from "@/ingest/service.js";
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
vi.mock("@/observability/tracing.js", () => ({ createTrace: vi.fn() }));
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

  it("mantem apenas lancamentos da competencia selecionada", () => {
    const result = filterEntriesByReferenceMonth([
      entry({ date: "2026-03-02", description: "Marco 1" }),
      entry({ date: "2026-04-10", description: "Abril" }),
      entry({ date: "2026-03-31", description: "Marco 2" }),
    ], "2026-03");

    expect(result.ignoredCount).toBe(1);
    expect(result.entries.map((e) => e.description)).toEqual(["Marco 1", "Marco 2"]);
  });
});

describe("ingest/service predominantMonth (competência-container p/ extrato keepAllEntries)", () => {
  it("retorna null para lista vazia", () => {
    expect(predominantMonth([])).toBeNull();
  });

  it("retorna o único mês quando todos os lançamentos são da mesma competência", () => {
    expect(predominantMonth([entry({ date: "2026-05-01" }), entry({ date: "2026-05-28" })])).toBe("2026-05");
  });

  it("escolhe o mês com mais lançamentos quando o extrato cruza meses", () => {
    expect(predominantMonth([
      entry({ date: "2026-03-15" }),
      entry({ date: "2026-05-01" }),
      entry({ date: "2026-05-10" }),
      entry({ date: "2026-05-20" }),
    ])).toBe("2026-05");
  });

  it("desempata pelo primeiro mês visto", () => {
    expect(predominantMonth([
      entry({ date: "2026-03-15" }),
      entry({ date: "2026-04-15" }),
    ])).toBe("2026-03");
  });
});
