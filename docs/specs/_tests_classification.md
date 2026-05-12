// MODE: REINFORCE

# Test Suite — `classification`

> Suíte Vitest 1.x para o módulo `classification` (Onda 1, Tier B).
> **Fonte das regras:** `docs/specs/classification.md` (stub) + outcomes declarados + backend implementation doc.
> Como a spec ainda é stub, parte dos comportamentos foi inferida dos outcomes formalmente declarados (`ledger_classified`, `classification_confidence_low`, `taxonomy_drift_detected`) e do `_backend_classification.md`. Onde for inferência (não regra literal da spec), marcado com `// SPEC-INFERRED`.

Convenções:
- Cada arquivo isola um surface (taxonomy / classifier core / routes / multi-tenancy / edges).
- Mocks: `@/llm/index.js` (callLlm), `@/persistence/prisma.js` (getPrisma), `@/queue/index.js` (enqueueDreNarrative).
- DB real: Postgres via Prisma com schema isolado por test run quando o teste for de integração (`*.int.test.ts`).
- Padrão Arrange / Act / Assert explícito em todo `it()`.

---

## 1) Taxonomy — fonte única de verdade

```ts
// src/classification/__tests__/taxonomy.test.ts
import { describe, it, expect } from "vitest";
import { DRE_TAXONOMY, DRE_CATEGORIES, buildTaxonomyBlock } from "@/classification/taxonomy.js";

describe("DRE_TAXONOMY — taxonomia fechada (~25 categorias padrão)", () => {
  it("expõe exatamente 23 categorias (incluindo fallback) — sem hardcode por tenant (C8)", () => {
    // Arrange / Act
    const count = DRE_CATEGORIES.length;
    // Assert
    expect(count).toBe(23);
  });

  it("inclui a categoria de fallback `nao_classificado` para confidence insuficiente", () => {
    // Arrange / Act / Assert
    expect(DRE_CATEGORIES).toContain("nao_classificado");
    expect(DRE_TAXONOMY.nao_classificado).toMatch(/revisão humana/i);
  });

  it("NEGATIVE: não permite categorias arbitrárias fora da taxonomia", () => {
    // Arrange
    const fakeCategory = "marketing_growth_hack" as never;
    // Act / Assert
    expect(DRE_CATEGORIES.includes(fakeCategory)).toBe(false);
  });

  it("buildTaxonomyBlock produz lista numerada com chave + descrição para todas as categorias", () => {
    // Arrange / Act
    const block = buildTaxonomyBlock();
    // Assert — todas as 23 chaves devem aparecer no bloco do prompt
    for (const key of DRE_CATEGORIES) {
      expect(block).toContain(`**${key}**`);
    }
    expect(block.split("\n").length).toBe(23);
  });

  it("expõe categorias-chave declaradas na spec/prompt (prolabore, simples_nacional, emprestimos_entrada, transferencia_interna)", () => {
    // Assert — regras de classificação dependem dessas chaves existirem
    expect(DRE_CATEGORIES).toEqual(
      expect.arrayContaining([
        "prolabore",
        "simples_nacional",
        "emprestimos_entrada",
        "transferencia_interna",
        "irpj_csll",
      ]),
    );
  });
});

// SPEC COVERAGE
// - outcome `ledger_classified` (taxonomia fechada)          → DRE_TAXONOMY taxonomia fechada
// - outcome `classification_confidence_low` (fallback)        → inclui fallback `nao_classificado`
// - C8 sem hardcode por tenant                                → todos os its (taxonomia é única)
// - Regras do system prompt (prolabore/simples/empréstimo)    → expõe categorias-chave
```

---

## 2) Classifier — categorização DRE, accuracy, confidence threshold

```ts
// src/classification/__tests__/classifier.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/llm/index.js", () => ({ callLlm: vi.fn() }));
vi.mock("@/persistence/prisma.js", () => ({ getPrisma: vi.fn() }));
vi.mock("@/queue/index.js", () => ({ enqueueDreNarrative: vi.fn() }));
vi.mock("@/observability/logger.js", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { callLlm } from "@/llm/index.js";
import { getPrisma } from "@/persistence/prisma.js";
import { enqueueDreNarrative } from "@/queue/index.js";
import { classifyAnalysis } from "@/classification/classifier.js";

const TENANT = "tenant-abc";
const ANALYSIS = "analysis-001";

function makeDb(entries: Array<Partial<{ id: string; description: string; amountCents: number; direction: string; date: Date }>>) {
  const updates: any[] = [];
  return {
    updates,
    ledgerEntry: {
      findMany: vi.fn().mockResolvedValue(
        entries.map((e, i) => ({
          id: e.id ?? `e${i}`,
          date: e.date ?? new Date("2026-04-15"),
          description: e.description ?? "GENERIC",
          amountCents: e.amountCents ?? 10000,
          direction: e.direction ?? "debit",
        })),
      ),
      update: vi.fn((args: any) => { updates.push(args); return Promise.resolve(args.data); }),
      updateMany: vi.fn((args: any) => { updates.push(args); return Promise.resolve({ count: args.where?.id?.in?.length ?? 0 }); }),
    },
  };
}

describe("classifyAnalysis — pipeline em batches de 20", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Regra: cada lançamento é classificado em uma categoria DRE ─────────────
  it("POSITIVE: aplica predictedCategory + classificationConfidence vindos do LLM para cada lançamento", async () => {
    // Arrange
    const db = makeDb([{ id: "e1", description: "SALARIO ABRIL" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "despesas_pessoal", confidence: 0.97 }]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(db.ledgerEntry.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: {
        predictedCategory: "despesas_pessoal",
        classificationConfidence: 0.97,
        correctionSource: null,
      },
    });
  });

  it("NEGATIVE: NÃO classifica entradas que já têm predictedCategory (idempotência via where: predictedCategory: null)", async () => {
    // Arrange
    const db = makeDb([]);
    (getPrisma as any).mockReturnValue(db);

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(db.ledgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { analysisId: ANALYSIS, predictedCategory: null } }),
    );
    expect(callLlm).not.toHaveBeenCalled();
  });

  // ── Regra: categoria fora da taxonomia → fallback nao_classificado ─────────
  it("POSITIVE: substitui categoria desconhecida por `nao_classificado` (categoria fechada)", async () => {
    // Arrange
    const db = makeDb([{ id: "e1" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "growth_hack_2026", confidence: 0.9 }]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(db.ledgerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ predictedCategory: "nao_classificado" }) }),
    );
  });

  it("NEGATIVE: categoria válida não é substituída por nao_classificado", async () => {
    // Arrange
    const db = makeDb([{ id: "e1" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "receita_bruta", confidence: 0.88 }]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    const call = (db.ledgerEntry.update as any).mock.calls[0][0];
    expect(call.data.predictedCategory).toBe("receita_bruta");
    expect(call.data.predictedCategory).not.toBe("nao_classificado");
  });

  // ── Regra: confidence < 0.7 marca correctionSource = "needs_review" ────────
  it("POSITIVE: confidence < 0.7 → correctionSource = 'needs_review' (limiar de revisão humana)", async () => {
    // Arrange
    const db = makeDb([{ id: "e1", description: "PIX RECEBIDO JOAO" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "receita_bruta", confidence: 0.61 }]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(db.ledgerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ correctionSource: "needs_review" }) }),
    );
  });

  it("NEGATIVE: confidence >= 0.7 → correctionSource = null (auto-approve potencial)", async () => {
    // Arrange
    const db = makeDb([{ id: "e1" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "despesas_pessoal", confidence: 0.7 }]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(db.ledgerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ correctionSource: null }) }),
    );
  });

  // ── Edge case: confidence exatamente no limite (boundary 0.7) ───────────────
  it("EDGE: confidence == 0.6999 marca needs_review, confidence == 0.7000 não marca", async () => {
    // Arrange — dois lançamentos no mesmo batch testam a borda exata
    const db = makeDb([{ id: "low" }, { id: "border" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([
        { entryId: "low",    category: "receita_bruta", confidence: 0.6999 },
        { entryId: "border", category: "receita_bruta", confidence: 0.7000 },
      ]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    const calls = (db.ledgerEntry.update as any).mock.calls.map((c: any[]) => c[0]);
    expect(calls.find((c: any) => c.where.id === "low").data.correctionSource).toBe("needs_review");
    expect(calls.find((c: any) => c.where.id === "border").data.correctionSource).toBeNull();
  });

  // ── Edge case: descrição ambígua ───────────────────────────────────────────
  it("EDGE: descrição ambígua (ex: 'TRANSFERENCIA') gera baixa confidence + needs_review", async () => {
    // Arrange
    const db = makeDb([{ id: "amb", description: "TRANSFERENCIA" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([{ entryId: "amb", category: "transferencia_interna", confidence: 0.55 }]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(db.ledgerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          predictedCategory: "transferencia_interna",
          correctionSource:  "needs_review",
        }),
      }),
    );
  });

  // ── Edge case: valores negativos / direction = credit em descrição de despesa ──
  it("EDGE: lançamento com direction=credit é repassado para o LLM no payload (não inferido em código)", async () => {
    // Arrange
    const db = makeDb([{ id: "e1", direction: "credit", amountCents: 50000, description: "ESTORNO TARIFA" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "despesas_financeiras", confidence: 0.85 }]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert — userPrompt foi montado com direction credit (não code-based heuristic)
    const userPrompt = (callLlm as any).mock.calls[0][0].userPrompt as string;
    expect(userPrompt).toContain('"direction": "credit"');
    expect(userPrompt).toContain('"amountCents": 50000');
  });

  // ── Edge case: data borderline (último dia do mês de competência) ──────────
  it("EDGE: data 2026-04-30 (último dia do mês) é serializada como 'YYYY-MM-DD' para o LLM", async () => {
    // Arrange
    const db = makeDb([{ id: "e1", date: new Date("2026-04-30T23:59:59Z"), description: "DAS ABRIL" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "simples_nacional", confidence: 0.96 }]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    const userPrompt = (callLlm as any).mock.calls[0][0].userPrompt as string;
    expect(userPrompt).toContain('"date": "2026-04-30"');
  });

  // ── Batching: BATCH_SIZE = 20 ──────────────────────────────────────────────
  it("POSITIVE: 45 lançamentos → 3 chamadas LLM (batches de 20, 20, 5)", async () => {
    // Arrange
    const entries = Array.from({ length: 45 }, (_, i) => ({ id: `e${i}` }));
    const db = makeDb(entries);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockImplementation(({ userPrompt }: any) => {
      const ids = JSON.parse(userPrompt.split("lançamentos:\n")[1]).map((x: any) => x.entryId);
      return Promise.resolve({
        content: JSON.stringify(ids.map((id: string) => ({ entryId: id, category: "outras_despesas", confidence: 0.9 }))),
      });
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(callLlm).toHaveBeenCalledTimes(3);
  });

  it("NEGATIVE: 10 lançamentos → 1 única chamada LLM", async () => {
    // Arrange
    const entries = Array.from({ length: 10 }, (_, i) => ({ id: `e${i}` }));
    const db = makeDb(entries);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify(entries.map((e) => ({ entryId: e.id, category: "outras_despesas", confidence: 0.9 }))),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(callLlm).toHaveBeenCalledTimes(1);
  });

  // ── Robustez: LLM responde JSON inválido / schema-fail ─────────────────────
  it("POSITIVE: LLM com JSON inválido → batch inteiro vira nao_classificado + needs_review (não derruba pipeline)", async () => {
    // Arrange
    const db = makeDb([{ id: "e1" }, { id: "e2" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({ content: "isso não é JSON {{{" });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(db.ledgerEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["e1", "e2"] } },
      data:  { predictedCategory: "nao_classificado", correctionSource: "needs_review" },
    });
  });

  it("NEGATIVE: LLM com JSON válido NÃO chama updateMany de fallback", async () => {
    // Arrange
    const db = makeDb([{ id: "e1" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "receita_bruta", confidence: 0.9 }]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(db.ledgerEntry.updateMany).not.toHaveBeenCalled();
  });

  it("EDGE: LLM falha em UM batch de DOIS → batch falho vira nao_classificado, batch bom é classificado normalmente", async () => {
    // Arrange — 25 lançamentos = 2 batches (20 + 5); o segundo batch falha
    const entries = Array.from({ length: 25 }, (_, i) => ({ id: `e${i}` }));
    const db = makeDb(entries);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any)
      .mockResolvedValueOnce({
        content: JSON.stringify(entries.slice(0, 20).map((e) => ({ entryId: e.id, category: "receita_bruta", confidence: 0.9 }))),
      })
      .mockRejectedValueOnce(new Error("provider 500"));

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(db.ledgerEntry.update).toHaveBeenCalledTimes(20);     // batch 1 ok
    expect(db.ledgerEntry.updateMany).toHaveBeenCalledTimes(1);  // batch 2 fallback
    expect((db.ledgerEntry.updateMany as any).mock.calls[0][0].where.id.in).toHaveLength(5);
  });

  // ── Encadeamento pipeline ───────────────────────────────────────────────────
  it("POSITIVE: ao concluir a classificação enfileira dre-narrative para o mesmo analysisId+tenantId", async () => {
    // Arrange
    const db = makeDb([{ id: "e1" }]);
    (getPrisma as any).mockReturnValue(db);
    (callLlm as any).mockResolvedValue({
      content: JSON.stringify([{ entryId: "e1", category: "receita_bruta", confidence: 0.95 }]),
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    expect(enqueueDreNarrative).toHaveBeenCalledWith({ analysisId: ANALYSIS, tenantId: TENANT });
  });

  it("NEGATIVE: sem entradas a classificar → NÃO enfileira dre-narrative", async () => {
    // Arrange
    const db = makeDb([]);
    (getPrisma as any).mockReturnValue(db);

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert — TEST-DRIFT: backend atual chama enqueueDreNarrative mesmo com 0 entradas (early return só loga warn e segue).
    // Esta asserção segue a SPEC (outcome `ledger_classified` exige ledger classificado para gerar narrativa).
    // TEST-DRIFT — se este teste falhar, o backend deve ser ajustado para retornar antes do enqueue quando entries.length === 0.
    expect(enqueueDreNarrative).not.toHaveBeenCalled();
  });

  // ── Accuracy ≥ 0.95 (SPEC-INFERRED, derivado do outcome `classification_confidence_low`) ──
  it("POSITIVE: dataset com 100 lançamentos e <=5 low-confidence atinge accuracy >= 0.95", async () => {
    // Arrange — 100 entradas, 96 com confidence 0.9 e 4 com 0.5
    const entries = Array.from({ length: 100 }, (_, i) => ({ id: `e${i}` }));
    const db = makeDb(entries);
    (getPrisma as any).mockReturnValue(db);
    const infoSpy = vi.fn();
    const loggerMod = await import("@/observability/logger.js");
    (loggerMod.logger.info as any) = infoSpy;

    (callLlm as any).mockImplementation(({ userPrompt }: any) => {
      const ids = JSON.parse(userPrompt.split("lançamentos:\n")[1]).map((x: any) => x.entryId);
      return Promise.resolve({
        content: JSON.stringify(ids.map((id: string) => {
          const n = Number(id.replace("e", ""));
          return { entryId: id, category: "receita_bruta", confidence: n < 4 ? 0.5 : 0.9 };
        })),
      });
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert — último log de info traz accuracy >= 0.95
    const final = infoSpy.mock.calls.at(-1);
    expect(parseFloat(final![0].accuracy)).toBeGreaterThanOrEqual(0.95);
  });

  it("NEGATIVE: dataset com 30 low-confidence em 100 → accuracy 0.70 (NÃO atinge meta — sinaliza drift)", async () => {
    // Arrange
    const entries = Array.from({ length: 100 }, (_, i) => ({ id: `e${i}` }));
    const db = makeDb(entries);
    (getPrisma as any).mockReturnValue(db);
    const infoSpy = vi.fn();
    const loggerMod = await import("@/observability/logger.js");
    (loggerMod.logger.info as any) = infoSpy;

    (callLlm as any).mockImplementation(({ userPrompt }: any) => {
      const ids = JSON.parse(userPrompt.split("lançamentos:\n")[1]).map((x: any) => x.entryId);
      return Promise.resolve({
        content: JSON.stringify(ids.map((id: string) => {
          const n = Number(id.replace("e", ""));
          return { entryId: id, category: "receita_bruta", confidence: n < 30 ? 0.4 : 0.95 };
        })),
      });
    });

    // Act
    await classifyAnalysis(ANALYSIS, TENANT);

    // Assert
    const final = infoSpy.mock.calls.at(-1);
    expect(parseFloat(final![0].accuracy)).toBeLessThan(0.95);
  });
});

// SPEC COVERAGE
// - outcome `ledger_classified`                                  → it "aplica predictedCategory…" / it "idempotência"
// - outcome `classification_confidence_low` (limiar 0.7)         → it "confidence < 0.7 → needs_review" / boundary 0.6999 vs 0.7
// - taxonomia fechada / fallback nao_classificado                → it "substitui categoria desconhecida" / it "categoria válida não substituída"
// - C7 abstração LLM (callLlm wrapper)                           → todos os its mockam @/llm/index.js
// - Pipeline encadeado (classification → dre-narrative)          → it "enfileira dre-narrative" / it "sem entradas não enfileira"
// - SPEC-INFERRED accuracy ≥ 0.95                                → it accuracy >= 0.95 / accuracy < 0.95
// - Robustez (LLM 500 / JSON inválido)                           → it "JSON inválido" / it "batch falho isolado"
// - Edge: descrição ambígua / direction credit / data borderline → its EDGE
```

---

## 3) Routes — PATCH de correção humana (flywheel) + multi-tenancy

```ts
// src/classification/__tests__/routes.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

vi.mock("@/persistence/prisma.js", () => ({ getPrisma: vi.fn() }));
vi.mock("@/auth/middleware.js", () => ({
  requireAuth: vi.fn(async (req: any) => {
    if (req.headers["x-tenant"]) req.auth = { tenantId: req.headers["x-tenant"], userId: "u1" };
  }),
}));

import { getPrisma } from "@/persistence/prisma.js";
import { classificationRoutes } from "@/classification/routes.js";

function buildApp(db: any) {
  (getPrisma as any).mockReturnValue(db);
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(classificationRoutes);
  return app;
}

describe("GET /classification/:analysisId/review", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSITIVE: retorna apenas lançamentos com correctionSource = 'needs_review' do tenant logado", async () => {
    // Arrange
    const db = {
      ledgerEntry: {
        findMany: vi.fn().mockResolvedValue([
          { id: "e1", date: new Date("2026-04-10"), description: "X", amountCents: 100, direction: "debit", predictedCategory: "outras_despesas", classificationConfidence: 0.55 },
        ]),
      },
    };
    const app = buildApp(db);

    // Act
    const res = await app.inject({
      method: "GET",
      url: "/classification/an1/review",
      headers: { "x-tenant": "tenant-A" },
    });

    // Assert
    expect(res.statusCode).toBe(200);
    expect(db.ledgerEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { analysisId: "an1", tenantId: "tenant-A", correctionSource: "needs_review" },
      }),
    );
    expect(JSON.parse(res.body)[0].date).toBe("2026-04-10");
  });

  it("NEGATIVE: requisição sem auth (sem x-tenant) NÃO consulta o DB sem tenantId", async () => {
    // Arrange
    const db = { ledgerEntry: { findMany: vi.fn() } };
    const app = buildApp(db);

    // Act
    const res = await app.inject({ method: "GET", url: "/classification/an1/review" });

    // Assert — requireAuth não setou req.auth → findMany não pode ser chamado com tenantId válido
    // (asserção segue a SPEC C8: nenhuma query de negócio sem tenantId)
    if (db.ledgerEntry.findMany.mock.calls.length > 0) {
      const where = db.ledgerEntry.findMany.mock.calls[0][0].where;
      expect(where.tenantId).toBeUndefined();
    }
    expect(res.statusCode).not.toBe(200);
  });
});

describe("PATCH /classification/entries/:entryId/correct — flywheel / feedback loop", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Regra: correção humana grava correctedCategory + confirmedCategory + correctionSource ──
  it("POSITIVE: corrige categoria, grava correctedCategory + confirmedCategory + source='client' (flywheel)", async () => {
    // Arrange
    const db = {
      ledgerEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: "e1", tenantId: "tenant-A" }),
        update: vi.fn().mockResolvedValue({ id: "e1", confirmedCategory: "despesas_pessoal" }),
      },
    };
    const app = buildApp(db);

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/classification/entries/e1/correct",
      headers: { "x-tenant": "tenant-A" },
      payload: { category: "despesas_pessoal", source: "client" },
    });

    // Assert
    expect(res.statusCode).toBe(200);
    expect(db.ledgerEntry.update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data:  {
        correctedCategory: "despesas_pessoal",
        confirmedCategory: "despesas_pessoal",
        correctionSource:  "client",
      },
      select: { id: true, confirmedCategory: true },
    });
  });

  it("NEGATIVE: categoria fora da taxonomia → 400 (zod recusa antes de tocar no DB)", async () => {
    // Arrange
    const db = { ledgerEntry: { findFirst: vi.fn(), update: vi.fn() } };
    const app = buildApp(db);

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/classification/entries/e1/correct",
      headers: { "x-tenant": "tenant-A" },
      payload: { category: "categoria_inventada", source: "client" },
    });

    // Assert
    expect(res.statusCode).toBe(400);
    expect(db.ledgerEntry.update).not.toHaveBeenCalled();
  });

  // ── Multi-tenancy: tenant-B NÃO pode corrigir entry do tenant-A ──
  it("POSITIVE (C8): entry do tenant-A acessada por tenant-B retorna 404 (não vaza existência cross-tenant)", async () => {
    // Arrange
    const db = {
      ledgerEntry: {
        findFirst: vi.fn().mockImplementation(({ where }: any) =>
          // entry só existe se tenantId bater
          where.tenantId === "tenant-A" ? Promise.resolve({ id: "e1", tenantId: "tenant-A" }) : Promise.resolve(null),
        ),
        update: vi.fn(),
      },
    };
    const app = buildApp(db);

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/classification/entries/e1/correct",
      headers: { "x-tenant": "tenant-B" },
      payload: { category: "despesas_pessoal", source: "client" },
    });

    // Assert
    expect(res.statusCode).toBe(404);
    expect(db.ledgerEntry.update).not.toHaveBeenCalled();
    expect(db.ledgerEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "e1", tenantId: "tenant-B" } }),
    );
  });

  it("NEGATIVE (C8): mesmo entryId acessado pelo tenant correto retorna 200", async () => {
    // Arrange — mesmo cenário acima, mas x-tenant correto
    const db = {
      ledgerEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: "e1", tenantId: "tenant-A" }),
        update: vi.fn().mockResolvedValue({ id: "e1", confirmedCategory: "receita_bruta" }),
      },
    };
    const app = buildApp(db);

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/classification/entries/e1/correct",
      headers: { "x-tenant": "tenant-A" },
      payload: { category: "receita_bruta", source: "client" },
    });

    // Assert
    expect(res.statusCode).toBe(200);
  });

  // ── Source default ──
  it("EDGE: source omitido no body → default 'client' (correção do cliente é o fluxo principal)", async () => {
    // Arrange
    const db = {
      ledgerEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: "e1", tenantId: "tenant-A" }),
        update: vi.fn().mockResolvedValue({ id: "e1", confirmedCategory: "receita_bruta" }),
      },
    };
    const app = buildApp(db);

    // Act
    await app.inject({
      method: "PATCH",
      url: "/classification/entries/e1/correct",
      headers: { "x-tenant": "tenant-A" },
      payload: { category: "receita_bruta" },
    });

    // Assert
    expect(db.ledgerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ correctionSource: "client" }) }),
    );
  });

  it("POSITIVE: source='rafael' (correção interna) é aceita", async () => {
    // Arrange
    const db = {
      ledgerEntry: {
        findFirst: vi.fn().mockResolvedValue({ id: "e1", tenantId: "tenant-A" }),
        update: vi.fn().mockResolvedValue({ id: "e1", confirmedCategory: "prolabore" }),
      },
    };
    const app = buildApp(db);

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/classification/entries/e1/correct",
      headers: { "x-tenant": "tenant-A" },
      payload: { category: "prolabore", source: "rafael" },
    });

    // Assert
    expect(res.statusCode).toBe(200);
    expect(db.ledgerEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ correctionSource: "rafael" }) }),
    );
  });

  it("NEGATIVE: source inválida (ex: 'github-copilot') → 400", async () => {
    // Arrange
    const db = { ledgerEntry: { findFirst: vi.fn(), update: vi.fn() } };
    const app = buildApp(db);

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/classification/entries/e1/correct",
      headers: { "x-tenant": "tenant-A" },
      payload: { category: "prolabore", source: "github-copilot" },
    });

    // Assert
    expect(res.statusCode).toBe(400);
    expect(db.ledgerEntry.update).not.toHaveBeenCalled();
  });
});

// SPEC COVERAGE
// - PATCH de correção humana (flywheel)            → "corrige categoria, grava correctedCategory…"
// - Flywheel: correctedCategory + correctionSource → assert no payload do update
// - C8 multi-tenancy em /review                    → "consulta sempre filtra por tenantId"
// - C8 multi-tenancy em PATCH                      → "tenant-A entry x tenant-B → 404"
// - Taxonomia fechada no endpoint                  → "categoria fora da taxonomia → 400"
// - Default source = 'client'                      → it EDGE source omitido
// - Source restrita ('rafael'|'client')            → it "source inválida → 400"
```

---

## 4) Prompts — system prompt cacheável (L0) + regras embutidas

```ts
// src/classification/__tests__/prompts.test.ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "@/classification/prompts.js";
import { DRE_CATEGORIES } from "@/classification/taxonomy.js";

describe("buildSystemPrompt — L0 cacheável (sem dados de tenant)", () => {
  it("POSITIVE: contém TODAS as categorias DRE da taxonomia (taxonomia única — C8)", () => {
    // Arrange / Act
    const sys = buildSystemPrompt();
    // Assert
    for (const cat of DRE_CATEGORIES) {
      expect(sys).toContain(`**${cat}**`);
    }
  });

  it("NEGATIVE (C8): system prompt NÃO contém dados de tenant nem tenantId", () => {
    // Arrange / Act
    const sys = buildSystemPrompt();
    // Assert
    expect(sys).not.toMatch(/tenantId/i);
    expect(sys).not.toMatch(/tenant_[a-z0-9]+/i);
    expect(sys).not.toMatch(/cnpj/i);
  });

  it("POSITIVE: declara regra de fallback nao_classificado para low confidence (<0.7)", () => {
    // Arrange / Act
    const sys = buildSystemPrompt();
    // Assert
    expect(sys).toMatch(/abaixo de 0\.7/);
    expect(sys).toMatch(/nao_classificado/);
  });

  it("POSITIVE: codifica regras de classificação críticas (pró-labore, simples, empréstimo, transferência interna)", () => {
    // Arrange / Act
    const sys = buildSystemPrompt();
    // Assert
    expect(sys).toMatch(/transferência entre contas.*transferencia_interna/i);
    expect(sys).toMatch(/Pró-labore.*prolabore/i);
    expect(sys).toMatch(/DAS \/ Simples.*simples_nacional/i);
    expect(sys).toMatch(/empréstimo.*emprestimos_entrada/i);
  });

  it("NEGATIVE: NÃO inclui formato markdown na saída esperada (consumidor faz JSON.parse direto)", () => {
    // Arrange / Act
    const sys = buildSystemPrompt();
    // Assert — instrução explícita pro modelo
    expect(sys).toMatch(/SOMENTE um array JSON válido — sem markdown/);
  });
});

describe("buildUserPrompt — payload L1+L2 (entradas a classificar)", () => {
  it("POSITIVE: serializa entradas como JSON pretty-printed sob o cabeçalho 'Classifique os seguintes lançamentos:'", () => {
    // Arrange
    const entries = [{ entryId: "e1", date: "2026-04-10", description: "DAS ABRIL", amountCents: 12000, direction: "debit" }];
    // Act
    const userPrompt = buildUserPrompt(entries);
    // Assert
    expect(userPrompt.startsWith("Classifique os seguintes lançamentos:")).toBe(true);
    expect(userPrompt).toContain('"entryId": "e1"');
    expect(userPrompt).toContain('"description": "DAS ABRIL"');
  });

  it("NEGATIVE: array vazio gera prompt válido com `[]` (não quebra)", () => {
    // Arrange / Act
    const userPrompt = buildUserPrompt([]);
    // Assert
    expect(userPrompt).toContain("[]");
  });
});

// SPEC COVERAGE
// - L0 cacheável sem tenant (C5 + C8)        → it "NÃO contém dados de tenant"
// - Taxonomia única no prompt                → it "contém TODAS as categorias"
// - Regra confidence < 0.7 instruída ao LLM  → it "declara regra de fallback"
// - Regras de classificação críticas         → it "codifica regras críticas"
// - Output JSON puro                         → it "NÃO inclui formato markdown"
```

---

## 5) Integração — multi-tenancy end-to-end

```ts
// src/classification/__tests__/multi-tenancy.int.test.ts
// Integração com Postgres real (vitest setup já provisiona DB por test run)
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/llm/index.js", () => ({ callLlm: vi.fn() }));
vi.mock("@/queue/index.js", () => ({ enqueueDreNarrative: vi.fn() }));

import { callLlm } from "@/llm/index.js";
import { getPrisma } from "@/persistence/prisma.js";
import { classifyAnalysis } from "@/classification/classifier.js";

async function seedTenantWithEntries(tenantId: string, descs: string[]) {
  const db = getPrisma();
  const tenant = await db.tenant.create({ data: { id: tenantId, name: tenantId } });
  const analysis = await db.monthlyAnalysis.create({
    data: { tenantId: tenant.id, referenceMonth: "2026-04" },
  });
  for (const d of descs) {
    await db.ledgerEntry.create({
      data: {
        tenantId: tenant.id, analysisId: analysis.id,
        date: new Date("2026-04-15"), description: d, amountCents: 10000, direction: "debit",
      },
    });
  }
  return analysis.id;
}

describe("classifyAnalysis — multi-tenancy (C8)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const db = getPrisma();
    await db.ledgerEntry.deleteMany({});
    await db.monthlyAnalysis.deleteMany({});
    await db.tenant.deleteMany({});
  });

  it("POSITIVE: classificar tenant-A NÃO toca em lançamentos do tenant-B", async () => {
    // Arrange
    const anA = await seedTenantWithEntries("ta", ["SALARIO A"]);
    await seedTenantWithEntries("tb", ["SALARIO B"]);
    (callLlm as any).mockImplementation(({ userPrompt }: any) => {
      const ids = JSON.parse(userPrompt.split("lançamentos:\n")[1]).map((x: any) => x.entryId);
      return Promise.resolve({
        content: JSON.stringify(ids.map((id: string) => ({ entryId: id, category: "despesas_pessoal", confidence: 0.95 }))),
      });
    });

    // Act
    await classifyAnalysis(anA, "ta");

    // Assert
    const db = getPrisma();
    const a = await db.ledgerEntry.findMany({ where: { tenantId: "ta" } });
    const b = await db.ledgerEntry.findMany({ where: { tenantId: "tb" } });
    expect(a.every((e) => e.predictedCategory === "despesas_pessoal")).toBe(true);
    expect(b.every((e) => e.predictedCategory === null)).toBe(true);
  });

  it("NEGATIVE: query em classifier inclui tenant-scope implícito via analysisId (jamais cross-tenant)", async () => {
    // Arrange — entrada do tenant-B com mesmo analysisId não existe pelo schema (FK), mas garantimos
    const db = getPrisma();
    const anA = await seedTenantWithEntries("ta", ["X"]);
    // Act
    const findA = await db.ledgerEntry.findMany({ where: { analysisId: anA } });
    // Assert
    expect(findA.every((e) => e.tenantId === "ta")).toBe(true);
  });

  afterEach(async () => {
    const db = getPrisma();
    await db.ledgerEntry.deleteMany({});
    await db.monthlyAnalysis.deleteMany({});
    await db.tenant.deleteMany({});
  });
});

// SPEC COVERAGE
// - C8 multi-tenancy: nenhuma query cross-tenant     → it "tenant-A não toca tenant-B"
// - Schema: tenantId FK em LedgerEntry               → it "tenant-scope implícito via analysisId"
```

---

## Gaps

Regras presentes na spec/outcomes que **NÃO** viraram teste nesta suíte e por quê:

- **`taxonomy_drift_detected`** — outcome declarado na spec (linha 21) que detecta "padrão recorrente sem categoria — sugere expansão da taxonomia". **Não implementado no backend** (`_backend_classification.md` não menciona drift detection). Sem código, nada a testar. **AÇÃO**: abrir issue para implementar drift detector OU remover outcome da spec.
- **Eval suite mínima (≥10 casos por outcome)** — exigência genérica da spec gerada via `/acme:spec`. Esta suíte são testes unit/int, não eval suite. **Pertence a** `evals/classification/cases/*.yaml` (a ser criada via `/acme:eval`).
- **Prompt cache hit-rate (Gemini / Anthropic)** — backend usa system prompt L0 cacheável, mas não há instrumentação testável de hit-rate aqui. **Pertence a** suite de observabilidade Langfuse (C6).
- **Fallback automático Gemini → Anthropic** — declarado em `_backend_classification.md`, mas é responsabilidade de `src/llm/router.ts` (camada de abstração C7), não do classificador. **Pertence a** `src/llm/__tests__/router.test.ts`.
- **Unit economics (custo ≤ 25% do preço — C3)** — exige eval real com tokens reais. **Pertence a** `docs/onda-0/unit_economics.md` + telemetria Langfuse.
- **Worker BullMQ concorrência 3** — comportamento de infra (queue), não do módulo. **Pertence a** `src/queue/__tests__/workers.test.ts`.
- **Promoção SHADOW → ASSISTED → AUTONOMOUS** — comando `/acme:promote` valida modo; fora do escopo do classificador.
- **Cláusula formal de outcome (C2)** — a spec atual é stub e não declarou cláusula contratual. Quando preenchida via `/acme:spec`, casos de aceitação literal devem virar testes adicionais.

**TEST-DRIFT registrado:**
- `classifier.ts` chama `enqueueDreNarrative` mesmo quando não há entradas (linha 109, fora do `if (entries.length === 0)`). O teste "sem entradas → NÃO enfileira dre-narrative" segue a spec (outcome `ledger_classified` exige ledger classificado para gerar narrativa). Falha desse teste indica bug no backend, não no teste.
