import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  filterEntriesByReferenceMonth,
  predominantMonth,
  lastClosedMonth,
  computeDirectionInferred,
  groupIndicesByMonth,
  persistMonth,
  dispatch,
  looksLikeDreText,
} from "@/ingest/service.js";
import { parseText } from "@/ingest/parsers/text.js";
import { parseDreText } from "@/ingest/parsers/pdf-dre.js";
import type { RawLedger } from "@/ingest/types.js";
import type { getPrisma } from "@/persistence/prisma.js";
import { SubscriptionMode } from "@prisma/client";

vi.mock("@/persistence/prisma.js", () => ({ getPrisma: vi.fn() }));
vi.mock("@/queue/index.js", () => ({
  enqueueMonthlyAnalysisGraph: vi.fn(),
}));
vi.mock("@/ingest/parsers/excel.js", () => ({ parseExcel: vi.fn() }));
vi.mock("@/ingest/parsers/text.js", () => ({ parseText: vi.fn() }));
vi.mock("@/ingest/parsers/pdf-dre.js", () => ({ parsePdfDre: vi.fn(), parseDreText: vi.fn() }));
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

describe("ingest/service computeDirectionInferred (confiabilidade da direção por arquivo)", () => {
  it("arquivo sem sinal sistemático (caso CID & CID): fallback → inferida, sign → confiável", () => {
    // 4 positivos sem marcação + 1 estorno negativo (8% < 25% de linhas com sinal):
    // o arquivo NÃO usa sinais sistematicamente, logo os fallback são chute.
    const entries = [
      entry({ directionSource: "fallback", direction: "credit" }),
      entry({ directionSource: "fallback", direction: "credit" }),
      entry({ directionSource: "fallback", direction: "credit" }),
      entry({ directionSource: "fallback", direction: "credit" }),
      entry({ directionSource: "sign", direction: "debit" }),
    ];
    expect(computeDirectionInferred(entries)).toEqual([true, true, true, true, false]);
  });

  it("extrato com sinais sistemáticos (≥25% negativos): positivos são confiáveis", () => {
    const entries = [
      entry({ directionSource: "fallback", direction: "credit" }),
      entry({ directionSource: "sign", direction: "debit" }),
      entry({ directionSource: "fallback", direction: "credit" }),
      entry({ directionSource: "sign", direction: "debit" }),
    ];
    expect(computeDirectionInferred(entries)).toEqual([false, false, false, false]);
  });

  it("direção da heurística por descrição (#174) é inferida — o LLM tem a palavra final no tier pago", () => {
    // "description" = direção deduzida do texto. No free tier (sem LLM) vale direto;
    // no tier pago, marcar como inferida deixa o classificador corrigir (ex.: pró-labore).
    const entries = [
      entry({ directionSource: "description", direction: "debit" }),
      entry({ directionSource: "description", direction: "credit" }),
      entry({ directionSource: "explicit", direction: "debit" }),
    ];
    expect(computeDirectionInferred(entries)).toEqual([true, true, false]);
  });

  it("direção explícita nunca é marcada como inferida", () => {
    const entries = [
      entry({ directionSource: "explicit", direction: "debit" }),
      entry({ directionSource: "explicit", direction: "credit" }),
    ];
    expect(computeDirectionInferred(entries)).toEqual([false, false]);
  });

  it("entries sem directionSource (parsers legados) são tratadas como confiáveis", () => {
    expect(computeDirectionInferred([entry(), entry()])).toEqual([false, false]);
  });

  it("lista vazia devolve lista vazia", () => {
    expect(computeDirectionInferred([])).toEqual([]);
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

describe("ingest/service lastClosedMonth (rótulo da análise = último mês fechado)", () => {
  it("retorna o mês mais recente do extrato anterior ao mês corrente", () => {
    // Extrato mar/abr/mai pedido em junho → rótulo = maio (último mês fechado).
    expect(lastClosedMonth([
      entry({ date: "2026-03-15" }),
      entry({ date: "2026-04-10" }),
      entry({ date: "2026-05-28" }),
    ], "2026-06")).toBe("2026-05");
  });

  it("exclui o mês corrente (aberto) ao escolher o rótulo", () => {
    // Há lançamentos de junho (mês corrente), mas o último FECHADO é maio.
    expect(lastClosedMonth([
      entry({ date: "2026-05-20" }),
      entry({ date: "2026-06-03" }),
    ], "2026-06")).toBe("2026-05");
  });

  it("cai para o mês corrente quando só há lançamentos dele", () => {
    expect(lastClosedMonth([
      entry({ date: "2026-06-01" }),
      entry({ date: "2026-06-15" }),
    ], "2026-06")).toBe("2026-06");
  });

  it("cai para o mês corrente quando o extrato está vazio", () => {
    expect(lastClosedMonth([], "2026-06")).toBe("2026-06");
  });
});

describe("ingest/service groupIndicesByMonth (distribuição multi-mês do extrato)", () => {
  it("agrupa os índices por mês de competência (extrato cruzando meses)", () => {
    // Espelha o arquivo CID: março, abril e maio no mesmo extrato.
    const dates = ["2026-03-17", "2026-04-01", "2026-04-30", "2026-05-10", "2026-03-20"];
    const groups = groupIndicesByMonth(dates);
    expect([...groups.keys()].sort()).toEqual(["2026-03", "2026-04", "2026-05"]);
    expect(groups.get("2026-03")).toEqual([0, 4]);
    expect(groups.get("2026-04")).toEqual([1, 2]);
    expect(groups.get("2026-05")).toEqual([3]);
  });

  it("extrato de um único mês gera um só grupo", () => {
    const groups = groupIndicesByMonth(["2026-04-01", "2026-04-15", "2026-04-30"]);
    expect([...groups.keys()]).toEqual(["2026-04"]);
    expect(groups.get("2026-04")).toEqual([0, 1, 2]);
  });

  it("lista vazia → mapa vazio", () => {
    expect(groupIndicesByMonth([]).size).toBe(0);
  });
});

describe("ingest/service persistMonth (revínculo de órfãos no reenvio)", () => {
  function makeDb(opts: { existing?: { id: string } | null; createdCount: number; reattachedCount: number }) {
    const analysis = { id: "analysis-1" };
    const createMany = vi.fn().mockResolvedValue({ count: opts.createdCount });
    const updateMany = vi.fn().mockResolvedValue({ count: opts.reattachedCount });
    const tx = {
      monthlyAnalysis: {
        findUnique: vi.fn().mockResolvedValue(opts.existing ?? null),
        create: vi.fn().mockResolvedValue(analysis),
        update: vi.fn().mockResolvedValue(analysis),
      },
      ledgerEntry: { deleteMany: vi.fn() },
      narrativeCard: { deleteMany: vi.fn() },
      actionPlanItem: { deleteMany: vi.fn() },
    };
    const db = {
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
      ledgerEntry: { createMany, updateMany },
      monthlyAnalysis: { update: vi.fn().mockResolvedValue(analysis) },
    };
    return { db: db as unknown as ReturnType<typeof getPrisma>, createMany, updateMany };
  }

  function row(dedupeHash: string): { entry: RawLedger; dedupeHash: string; inferred: boolean } {
    return { entry: entry({ date: "2026-05-01" }), dedupeHash, inferred: false };
  }

  it("readota lançamentos órfãos (analysisId null) do extrato para a análise corrente", async () => {
    const { db, updateMany } = makeDb({ createdCount: 0, reattachedCount: 2 });
    await persistMonth({
      db,
      tenantId: "t1",
      referenceMonth: "2026-05",
      rows: [row("h1"), row("h2")],
      minEntries: 100,
      subscriptionMode: SubscriptionMode.shadow,
      skipAnalysis: true,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { tenantId: "t1", analysisId: null, dedupeHash: { in: ["h1", "h2"] } },
      data: { analysisId: "analysis-1" },
    });
  });

  it("não readota de outras análises: o filtro é estritamente analysisId null", async () => {
    const { db, updateMany } = makeDb({ createdCount: 2, reattachedCount: 0 });
    await persistMonth({
      db,
      tenantId: "t1",
      referenceMonth: "2026-05",
      rows: [row("h1"), row("h2")],
      minEntries: 100,
      subscriptionMode: SubscriptionMode.shadow,
      skipAnalysis: true,
    });
    expect(updateMany.mock.calls[0]?.[0].where).toMatchObject({ analysisId: null });
  });

  it("não chama updateMany quando não há dedupeHash no extrato", async () => {
    const { db, updateMany } = makeDb({ createdCount: 1, reattachedCount: 0 });
    await persistMonth({
      db,
      tenantId: "t1",
      referenceMonth: "2026-05",
      rows: [row("")],
      minEntries: 100,
      subscriptionMode: SubscriptionMode.shadow,
      skipAnalysis: true,
    });
    expect(updateMany).not.toHaveBeenCalled();
  });
});

describe("ingest/service looksLikeDreText (gate antes do extrator LLM)", () => {
  const DRE = [
    "DRE — março de 2026",
    "Receita Bruta 641.726,01",
    "Custos 245.480,01",
    "Despesas Operacionais 165.145,00",
    "Resultado Líquido 231.101,01",
  ].join("\n");

  it("texto com várias linhas e valores BR tem cara de DRE", () => {
    expect(looksLikeDreText(DRE)).toBe(true);
  });

  it("paste trivial (uma frase, sem valores) não tem cara de DRE", () => {
    expect(looksLikeDreText("oi, quero ver meus números")).toBe(false);
  });

  it("poucos valores não bastam, mesmo com linhas suficientes", () => {
    expect(looksLikeDreText("linha um\nlinha dois 10,00\nlinha três")).toBe(false);
  });

  it("DRE curto com valores em milhar SEM centavos também roteia", () => {
    // Contador cola um DRE enxuto com valores formatados sem ',00'.
    expect(looksLikeDreText("Receita 641.726\nCustos 245.480\nResultado 396.246")).toBe(true);
  });

  it("não confunde ano/número solto com valor (gate não afrouxa)", () => {
    // "2026" e "10" não têm separador de milhar nem centavos: não contam como valor.
    expect(looksLikeDreText("relatório 2026\nperíodo 1\ntotal 10")).toBe(false);
  });
});

describe("ingest/service dispatch — roteamento de texto colado", () => {
  const DRE = [
    "DRE — março de 2026",
    "Receita Bruta 641.726,01",
    "Custos 245.480,01",
    "Despesas Operacionais 165.145,00",
    "Resultado Líquido 231.101,01",
  ].join("\n");

  const emptyParse = { entries: [], orphanCount: 3 };
  const dreParse = { entries: [entry({ confirmedCategory: "receita_bruta" })], orphanCount: 0 };

  beforeEach(() => {
    vi.mocked(parseText).mockReset();
    vi.mocked(parseDreText).mockReset();
  });

  it("texto com colunas reconhecíveis usa parseText e NÃO chama o extrator de DRE", async () => {
    vi.mocked(parseText).mockReturnValue({ entries: [entry()], orphanCount: 0 });
    const result = await dispatch({ tenantId: "t1", referenceMonth: "2026-03", source: "text", text: "Data\tDescrição\tValor\n01/03/2026\tCliente\t100,00" });
    expect(result.entries).toHaveLength(1);
    expect(parseDreText).not.toHaveBeenCalled();
  });

  it("texto sem colunas mas com cara de DRE cai no extrator LLM", async () => {
    vi.mocked(parseText).mockReturnValue(emptyParse);
    vi.mocked(parseDreText).mockResolvedValue(dreParse);
    const result = await dispatch({ tenantId: "t1", referenceMonth: "2026-03", source: "text", text: DRE });
    expect(parseDreText).toHaveBeenCalledWith(DRE, "2026-03", "t1");
    expect(result.entries[0]).toMatchObject({ confirmedCategory: "receita_bruta" });
  });

  it("free tier (skipAnalysis) nunca cai no extrator LLM — custo R$0", async () => {
    vi.mocked(parseText).mockReturnValue(emptyParse);
    await dispatch({ tenantId: "t1", referenceMonth: "2026-03", source: "text", text: DRE, skipAnalysis: true });
    expect(parseDreText).not.toHaveBeenCalled();
  });

  it("paste sem cara de DRE não dispara o extrator LLM", async () => {
    vi.mocked(parseText).mockReturnValue(emptyParse);
    await dispatch({ tenantId: "t1", referenceMonth: "2026-03", source: "text", text: "texto aleatório sem valores" });
    expect(parseDreText).not.toHaveBeenCalled();
  });
});
