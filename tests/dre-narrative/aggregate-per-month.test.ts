import { describe, expect, it } from "vitest";
import { aggregatePerMonthDre, type DatedEntryRow } from "@/dre-narrative/aggregator.js";

function row(over: Partial<DatedEntryRow> = {}): DatedEntryRow {
  return {
    amountCents: 100_000,
    direction: "credit",
    month: "2026-01",
    predictedCategory: "receita_bruta",
    confirmedCategory: null,
    ...over,
  };
}

describe("aggregatePerMonthDre", () => {
  it("agrupa por competência em ordem crescente", () => {
    const result = aggregatePerMonthDre([
      row({ month: "2026-03" }),
      row({ month: "2026-01" }),
      row({ month: "2026-02" }),
    ]);
    expect(result.map((r) => r.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("cada mês agrega só os seus lançamentos", () => {
    const result = aggregatePerMonthDre([
      row({ month: "2026-01", amountCents: 500_000, predictedCategory: "receita_bruta" }),
      row({ month: "2026-02", amountCents: 800_000, predictedCategory: "receita_bruta" }),
    ]);
    const jan = result.find((r) => r.month === "2026-01")!;
    const feb = result.find((r) => r.month === "2026-02")!;
    expect(jan.dre.receitaBruta).toBe(500_000);
    expect(feb.dre.receitaBruta).toBe(800_000);
  });

  it("lista vazia devolve []", () => {
    expect(aggregatePerMonthDre([])).toEqual([]);
  });
});
