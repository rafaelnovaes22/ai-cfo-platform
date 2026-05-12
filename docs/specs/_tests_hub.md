// MODE: REINFORCE

# Test Plan — `hub`

> Suíte de testes Vitest 1.x para o módulo Hub (Home pós-login + Análises Anteriores).
> Fonte das regras: `docs/specs/hub.md` (status: stub — outcomes principais documentados).
> Fonte de shapes/handlers: `docs/specs/_backend_hub.md` + `src/hub/routes.ts`.
>
> Convenções:
> - Testes de rota usam `app.inject()` do Fastify para HTTP-level assertions.
> - Prisma é mockado via `vi.mock("@/persistence/prisma.js")` retornando um `db` fake controlado.
> - `requireAuth` é stubado para popular `req.auth = { tenantId, userId }`.
> - Idempotência: cada teste reseta mocks no `beforeEach`.

---

## Helpers compartilhados (referência)

```ts
// tests/hub/_helpers.ts
import { vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { ZodTypeProvider, serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

export type FakeDb = {
  subscription: { findUnique: ReturnType<typeof vi.fn> };
  monthlyAnalysis: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
};

export function makeFakeDb(): FakeDb {
  return {
    subscription:     { findUnique: vi.fn() },
    monthlyAnalysis:  { findFirst: vi.fn(), findMany: vi.fn() },
  };
}

export async function buildApp(db: FakeDb, authCtx: { tenantId: string; userId?: string } | null) {
  vi.doMock("@/persistence/prisma.js", () => ({ getPrisma: () => db }));
  vi.doMock("@/auth/middleware.js", () => ({
    requireAuth: async (req: any, reply: any) => {
      if (!authCtx) return reply.code(401).send({ error: "unauthorized" });
      req.auth = authCtx;
    },
  }));
  const { hubRoutes } = await import("@/hub/routes.js");
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await app.register(hubRoutes);
  return app;
}

export const TENANT_A = "tenant_a_uuid";
export const TENANT_B = "tenant_b_uuid";

export const baseAnalysis = {
  id: "an_001",
  tenantId: TENANT_A,
  referenceMonth: "2026-04",
  status: "delivered",
  mode: "assisted",
  deliveredAt: new Date("2026-05-02T10:00:00Z"),
  approvedAt:  new Date("2026-05-03T15:00:00Z"),
  costCents: 1200,
  dreJson: {
    receitaBruta: 50000_00,
    lucroLiquido: 8000_00,
    margemLiquida: 0.16,
    ebitda: 12000_00,
    margemEbitda: 0.24,
  },
  actionPlanJson: { totalImpact: 25000_00 },
  narrativeCards: [
    { cardType: "critical_gap" },
    { cardType: "critical_gap" },
    { cardType: "attention" },
    { cardType: "healthy" },
  ],
  actionItems: [
    { horizon: "short",  impactCents: 5000_00 },
    { horizon: "short",  impactCents: 3000_00 },
    { horizon: "medium", impactCents: 10000_00 },
    { horizon: "long",   impactCents: 7000_00 },
  ],
};
```

---

## Arquivo 1 — `tests/hub/get-hub.test.ts`

Cobre `GET /hub` (snapshot home).

```ts
// tests/hub/get-hub.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeFakeDb, buildApp, baseAnalysis, TENANT_A, TENANT_B, FakeDb } from "./_helpers";

describe("GET /hub", () => {
  let db: FakeDb;

  beforeEach(() => {
    vi.resetModules();
    db = makeFakeDb();
  });

  describe("R1 — Snapshot completo (positivo)", () => {
    it("retorna subscription + latestAnalysis com dre + cards + actionPlan", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({
        tenantId: TENANT_A, plan: "starter", mode: "assisted", status: "active",
      });
      db.monthlyAnalysis.findFirst.mockResolvedValue(baseAnalysis);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.subscription).toEqual({ plan: "starter", mode: "assisted", status: "active" });
      expect(body.latestAnalysis.id).toBe("an_001");
      expect(body.latestAnalysis.referenceMonth).toBe("2026-04");
      expect(body.latestAnalysis.dre).toEqual({
        receitaBruta: 50000_00,
        lucroLiquido: 8000_00,
        margemLiquida: 0.16,
        ebitda: 12000_00,
        margemEbitda: 0.24,
      });
      expect(body.latestAnalysis.cards).toEqual({ critical_gap: 2, attention: 1, healthy: 1 });
      expect(body.latestAnalysis.actionPlan).toEqual({
        total: 4,
        shortImpactCents:  8000_00,
        mediumImpactCents: 10000_00,
        longImpactCents:   7000_00,
        totalImpactCents:  25000_00,
      });
    });
  });

  describe("R1 — Snapshot indisponível (negativo)", () => {
    it("falha quando handler é chamado sem auth (401)", async () => {
      // Arrange
      const app = await buildApp(db, null);

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(res.statusCode).toBe(401);
      expect(db.monthlyAnalysis.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("R2 — Subscription default (positivo)", () => {
    it("retorna plan=trial, mode=shadow, status=active quando não há subscription", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue(null);
      db.monthlyAnalysis.findFirst.mockResolvedValue(null);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.json().subscription).toEqual({ plan: "trial", mode: "shadow", status: "active" });
    });
  });

  describe("R2 — Subscription real prevalece sobre default (negativo)", () => {
    it("NÃO retorna default quando subscription existe", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({
        tenantId: TENANT_A, plan: "growth", mode: "autonomous", status: "active",
      });
      db.monthlyAnalysis.findFirst.mockResolvedValue(null);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      const body = res.json();
      expect(body.subscription.plan).toBe("growth");
      expect(body.subscription.mode).toBe("autonomous");
      expect(body.subscription.plan).not.toBe("trial");
    });
  });

  describe("R3 — Cards agregados por tipo", () => {
    it("conta corretamente cards de cada tipo (positivo)", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "assisted", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue({
        ...baseAnalysis,
        narrativeCards: [
          { cardType: "critical_gap" }, { cardType: "critical_gap" }, { cardType: "critical_gap" },
          { cardType: "attention" }, { cardType: "attention" },
          { cardType: "healthy" },
        ],
      });
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(res.json().latestAnalysis.cards).toEqual({ critical_gap: 3, attention: 2, healthy: 1 });
    });

    it("ignora cardTypes desconhecidos (negativo)", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "assisted", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue({
        ...baseAnalysis,
        narrativeCards: [
          { cardType: "critical_gap" },
          { cardType: "unknown_legacy_type" },
          { cardType: "alert" },
        ],
      });
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(res.json().latestAnalysis.cards).toEqual({ critical_gap: 1, attention: 0, healthy: 0 });
    });
  });

  describe("R4 — ActionPlan agregado por horizonte", () => {
    it("soma impactCents por horizon e devolve total (positivo)", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "assisted", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue({
        ...baseAnalysis,
        actionItems: [
          { horizon: "short",  impactCents: 1000 },
          { horizon: "short",  impactCents: 2000 },
          { horizon: "medium", impactCents: 5000 },
          { horizon: "long",   impactCents: 9999 },
        ],
      });
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(res.json().latestAnalysis.actionPlan).toEqual({
        total: 4,
        shortImpactCents: 3000,
        mediumImpactCents: 5000,
        longImpactCents: 9999,
        totalImpactCents: 1000 + 2000 + 5000 + 9999,
      });
    });

    it("retorna actionPlan=null quando não há actionItems (negativo)", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "assisted", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue({ ...baseAnalysis, actionItems: [] });
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(res.json().latestAnalysis.actionPlan).toBeNull();
    });
  });

  describe("R5 — Modo `shadow` vs `assisted` (controla CTA no frontend)", () => {
    it("subscription.mode=shadow é exposto no payload (positivo)", async () => {
      // Arrange — em SHADOW o frontend bloqueia CTA "Iniciar nova análise" pro cliente
      db.subscription.findUnique.mockResolvedValue({
        tenantId: TENANT_A, plan: "starter", mode: "shadow", status: "active",
      });
      db.monthlyAnalysis.findFirst.mockResolvedValue(baseAnalysis);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(res.json().subscription.mode).toBe("shadow");
    });

    it("subscription.mode=assisted é exposto no payload (negativo: NÃO é shadow)", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({
        tenantId: TENANT_A, plan: "starter", mode: "assisted", status: "active",
      });
      db.monthlyAnalysis.findFirst.mockResolvedValue(baseAnalysis);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      const body = res.json();
      expect(body.subscription.mode).toBe("assisted");
      expect(body.subscription.mode).not.toBe("shadow");
    });
  });

  describe("R6 — Multi-tenancy: query usa tenantId do JWT", () => {
    it("findFirst recebe tenantId do auth (positivo)", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "assisted", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue(baseAnalysis);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(db.subscription.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_A } }),
      );
      expect(db.monthlyAnalysis.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_A } }),
      );
    });

    it("NÃO vaza dados entre tenants — query nunca usa tenant alheio (negativo)", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "assisted", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue(null);
      const app = await buildApp(db, { tenantId: TENANT_B });

      // Act
      await app.inject({ method: "GET", url: "/hub" });

      // Assert
      const callsSub = db.subscription.findUnique.mock.calls;
      const callsAna = db.monthlyAnalysis.findFirst.mock.calls;
      for (const [arg] of callsSub) expect(arg.where.tenantId).not.toBe(TENANT_A);
      for (const [arg] of callsAna) expect(arg.where.tenantId).not.toBe(TENANT_A);
    });
  });

  describe("R7 — Ordenação por referenceMonth desc (snapshot é a análise mais recente)", () => {
    it("findFirst usa orderBy referenceMonth desc (positivo)", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue(null);
      db.monthlyAnalysis.findFirst.mockResolvedValue(null);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(db.monthlyAnalysis.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { referenceMonth: "desc" } }),
      );
    });

    it("findFirst NÃO usa orderBy asc (negativo)", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue(null);
      db.monthlyAnalysis.findFirst.mockResolvedValue(null);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      await app.inject({ method: "GET", url: "/hub" });

      // Assert
      const [args] = db.monthlyAnalysis.findFirst.mock.calls[0];
      expect(args.orderBy.referenceMonth).not.toBe("asc");
    });
  });

  // === Edge cases ===

  describe("EC1 — Tenant novo: nenhuma análise ainda", () => {
    it("retorna latestAnalysis=null + subscription default", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue(null);
      db.monthlyAnalysis.findFirst.mockResolvedValue(null);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.latestAnalysis).toBeNull();
      expect(body.subscription).toEqual({ plan: "trial", mode: "shadow", status: "active" });
    });
  });

  describe("EC2 — DRE null (análise em draft sem dreJson populado)", () => {
    it("retorna latestAnalysis.dre=null mas mantém cards/actionPlan", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "assisted", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue({
        ...baseAnalysis,
        dreJson: null,
      });
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      const body = res.json();
      expect(body.latestAnalysis.dre).toBeNull();
      expect(body.latestAnalysis.cards).toEqual({ critical_gap: 2, attention: 1, healthy: 1 });
      expect(body.latestAnalysis.actionPlan).not.toBeNull();
    });
  });

  describe("EC3 — ActionPlan null (sem actionItems gerados)", () => {
    it("retorna actionPlan=null mantendo dre+cards", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "assisted", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue({ ...baseAnalysis, actionItems: [] });
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      const body = res.json();
      expect(body.latestAnalysis.dre).not.toBeNull();
      expect(body.latestAnalysis.actionPlan).toBeNull();
    });
  });

  describe("EC4 — Valores negativos no DRE (prejuízo / margem negativa)", () => {
    it("propaga valores negativos sem clamp/abs", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "assisted", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue({
        ...baseAnalysis,
        dreJson: {
          receitaBruta: 30000_00,
          lucroLiquido: -5000_00,
          margemLiquida: -0.17,
          ebitda: -2000_00,
          margemEbitda: -0.07,
        },
      });
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      const dre = res.json().latestAnalysis.dre;
      expect(dre.lucroLiquido).toBe(-5000_00);
      expect(dre.margemLiquida).toBe(-0.17);
      expect(dre.ebitda).toBe(-2000_00);
      expect(dre.margemEbitda).toBe(-0.07);
    });
  });

  describe("EC5 — actionItems com impactCents negativo (medida que reduz receita)", () => {
    it("soma respeitando sinal (não usa Math.abs)", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "assisted", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue({
        ...baseAnalysis,
        actionItems: [
          { horizon: "short",  impactCents:  10000 },
          { horizon: "short",  impactCents:  -3000 },
          { horizon: "medium", impactCents:   5000 },
          { horizon: "long",   impactCents:  -2000 },
        ],
      });
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      const ap = res.json().latestAnalysis.actionPlan;
      expect(ap.shortImpactCents).toBe(7000);
      expect(ap.longImpactCents).toBe(-2000);
      expect(ap.totalImpactCents).toBe(10000 + -3000 + 5000 + -2000);
    });
  });

  describe("EC6 — deliveredAt/approvedAt null (análise em draft)", () => {
    it("serializa datas null preservando null no payload", async () => {
      // Arrange
      db.subscription.findUnique.mockResolvedValue({ plan: "starter", mode: "shadow", status: "active" });
      db.monthlyAnalysis.findFirst.mockResolvedValue({
        ...baseAnalysis,
        deliveredAt: null,
        approvedAt:  null,
      });
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/hub" });

      // Assert
      const a = res.json().latestAnalysis;
      expect(a.deliveredAt).toBeNull();
      expect(a.approvedAt).toBeNull();
    });
  });
});

// SPEC COVERAGE
// R1 (hub_loaded outcome: home com snapshot da última análise) → describe "R1 — Snapshot completo" + "R1 — Snapshot indisponível"
// R2 (subscription default quando ausente — defesa de tenant novo) → describe "R2 — Subscription default" + "R2 — Subscription real prevalece"
// R3 (cards agregados por tipo: critical_gap / attention / healthy) → describe "R3 — Cards agregados por tipo"
// R4 (actionPlan agregado por horizonte short/medium/long + total) → describe "R4 — ActionPlan agregado por horizonte"
// R5 (modo shadow vs assisted exposto p/ controle de CTA frontend) → describe "R5 — Modo shadow vs assisted"
// R6 (multi-tenancy: queries respeitam tenantId do JWT) → describe "R6 — Multi-tenancy"
// R7 (ordenação: snapshot é a referenceMonth mais recente) → describe "R7 — Ordenação por referenceMonth desc"
// EC1 (tenant novo) → "EC1 — Tenant novo"
// EC2 (DRE null) → "EC2 — DRE null"
// EC3 (actionPlan null) → "EC3 — ActionPlan null"
// EC4 (valores negativos no DRE) → "EC4 — Valores negativos no DRE"
// EC5 (impactCents negativo) → "EC5 — actionItems com impactCents negativo"
// EC6 (datas null) → "EC6 — deliveredAt/approvedAt null"
```

---

## Arquivo 2 — `tests/hub/get-analyses.test.ts`

Cobre `GET /analyses` (histórico paginado, limite fixo 12 v1, sem cursor).

```ts
// tests/hub/get-analyses.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeFakeDb, buildApp, TENANT_A, TENANT_B, FakeDb } from "./_helpers";

function makeAnalysis(i: number, overrides: Partial<any> = {}) {
  return {
    id: `an_${i.toString().padStart(3, "0")}`,
    referenceMonth: `2026-${(12 - i).toString().padStart(2, "0")}`,
    status: "delivered",
    mode: "assisted",
    deliveredAt: new Date(`2026-${(12 - i).toString().padStart(2, "0")}-05T10:00:00Z`),
    approvedAt:  new Date(`2026-${(12 - i).toString().padStart(2, "0")}-06T10:00:00Z`),
    costCents: 1000 + i,
    actionPlanJson: { totalImpact: 10000 * (i + 1) },
    ...overrides,
  };
}

describe("GET /analyses", () => {
  let db: FakeDb;

  beforeEach(() => {
    vi.resetModules();
    db = makeFakeDb();
  });

  describe("R8 — Lista paginada do histórico (positivo)", () => {
    it("retorna array de análises mapeadas com campos do spec", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([makeAnalysis(0), makeAnalysis(1), makeAnalysis(2)]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.analyses).toHaveLength(3);
      expect(body.analyses[0]).toMatchObject({
        id: "an_000",
        referenceMonth: "2026-12",
        status: "delivered",
        mode: "assisted",
        costCents: 1000,
        totalImpactCents: 10000,
      });
      expect(body.analyses[0].deliveredAt).toBe("2026-12-05T10:00:00.000Z");
      expect(body.analyses[0].approvedAt).toBe("2026-12-06T10:00:00.000Z");
    });
  });

  describe("R8 — Lista vazia (negativo)", () => {
    it("retorna analyses=[] quando tenant não tem nenhuma análise", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ analyses: [] });
    });
  });

  describe("R9 — Limite fixo take=12 (v1, sem cursor)", () => {
    it("passa take:12 para o Prisma (positivo)", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(db.monthlyAnalysis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 12 }),
      );
    });

    it("NÃO aceita parâmetro cursor/offset/limit do query string (negativo — v1)", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      await app.inject({ method: "GET", url: "/analyses?limit=100&cursor=abc&offset=20" });

      // Assert — take continua fixo em 12, sem skip/cursor
      const [args] = db.monthlyAnalysis.findMany.mock.calls[0];
      expect(args.take).toBe(12);
      expect(args.skip).toBeUndefined();
      expect(args.cursor).toBeUndefined();
    });

    it("trunca em 12 mesmo quando há mais análises disponíveis (edge: exato no limite)", async () => {
      // Arrange — DB já devolve 12 (Prisma respeitou take), garantia adicional
      const twelve = Array.from({ length: 12 }, (_, i) => makeAnalysis(i));
      db.monthlyAnalysis.findMany.mockResolvedValue(twelve);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(res.json().analyses).toHaveLength(12);
    });
  });

  describe("R10 — Ordenação desc por referenceMonth", () => {
    it("findMany passa orderBy referenceMonth desc (positivo)", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(db.monthlyAnalysis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { referenceMonth: "desc" } }),
      );
    });

    it("NÃO usa orderBy asc (negativo)", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      const [args] = db.monthlyAnalysis.findMany.mock.calls[0];
      expect(args.orderBy.referenceMonth).not.toBe("asc");
    });
  });

  describe("R11 — Multi-tenancy: histórico filtrado por tenantId do JWT", () => {
    it("findMany recebe tenantId do auth (positivo)", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(db.monthlyAnalysis.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT_A } }),
      );
    });

    it("usa tenantId do JWT do request — não de query/header arbitrário (negativo)", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([]);
      const app = await buildApp(db, { tenantId: TENANT_B });

      // Act — cliente tenta forçar tenant alheio via query (deve ser ignorado)
      await app.inject({ method: "GET", url: `/analyses?tenantId=${TENANT_A}` });

      // Assert
      const [args] = db.monthlyAnalysis.findMany.mock.calls[0];
      expect(args.where.tenantId).toBe(TENANT_B);
      expect(args.where.tenantId).not.toBe(TENANT_A);
    });

    it("falha com 401 quando não há JWT", async () => {
      // Arrange
      const app = await buildApp(db, null);

      // Act
      const res = await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(res.statusCode).toBe(401);
      expect(db.monthlyAnalysis.findMany).not.toHaveBeenCalled();
    });
  });

  describe("R12 — totalImpactCents derivado de actionPlanJson.totalImpact", () => {
    it("extrai totalImpact do JSON (positivo)", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0, { actionPlanJson: { totalImpact: 42_000_00 } }),
      ]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(res.json().analyses[0].totalImpactCents).toBe(42_000_00);
    });

    it("retorna null quando actionPlanJson é null (negativo)", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0, { actionPlanJson: null }),
      ]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(res.json().analyses[0].totalImpactCents).toBeNull();
    });

    it("retorna null quando actionPlanJson existe mas não tem totalImpact (edge)", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0, { actionPlanJson: { somethingElse: 1 } }),
      ]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(res.json().analyses[0].totalImpactCents).toBeNull();
    });
  });

  // === Edge cases ===

  describe("EC7 — costCents null preservado", () => {
    it("propaga null sem coerção para 0", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0, { costCents: null }),
      ]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(res.json().analyses[0].costCents).toBeNull();
    });
  });

  describe("EC8 — totalImpactCents negativo (plano com impacto líquido negativo)", () => {
    it("preserva sinal negativo no payload", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0, { actionPlanJson: { totalImpact: -5000_00 } }),
      ]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      expect(res.json().analyses[0].totalImpactCents).toBe(-5000_00);
    });
  });

  describe("EC9 — datas null (análise em draft)", () => {
    it("serializa deliveredAt/approvedAt=null", async () => {
      // Arrange
      db.monthlyAnalysis.findMany.mockResolvedValue([
        makeAnalysis(0, { deliveredAt: null, approvedAt: null }),
      ]);
      const app = await buildApp(db, { tenantId: TENANT_A });

      // Act
      const res = await app.inject({ method: "GET", url: "/analyses" });

      // Assert
      const a = res.json().analyses[0];
      expect(a.deliveredAt).toBeNull();
      expect(a.approvedAt).toBeNull();
    });
  });
});

// SPEC COVERAGE
// R8 (history_listed outcome: análises anteriores ordenadas por data ref) → "R8 — Lista paginada"
// R9 (limite fixo 12 v1, sem cursor) → "R9 — Limite fixo take=12"
// R10 (ordenação desc por referenceMonth) → "R10 — Ordenação desc"
// R11 (multi-tenancy via JWT) → "R11 — Multi-tenancy"
// R12 (totalImpactCents derivado de actionPlanJson.totalImpact) → "R12 — totalImpactCents derivado"
// EC7 (costCents null) → "EC7 — costCents null preservado"
// EC8 (totalImpactCents negativo) → "EC8 — totalImpactCents negativo"
// EC9 (datas null) → "EC9 — datas null"
```

---

## Gaps

Regras presentes na spec `docs/specs/hub.md` (status: **stub**) que **não viraram teste neste plano** — exigirão expansão quando a spec for detalhada via `/acme:spec --module hub`:

1. **Outcome `new_analysis_triggered`** — a spec lista esse outcome, mas o backend atual em `_backend_hub.md` não expõe endpoint correspondente (ex.: `POST /hub/new-analysis`). Sem rota, não há o que testar. **Ação:** quando o módulo `ingest` ou `hub` expuser esse trigger, adicionar `tests/hub/new-analysis-trigger.test.ts`.
2. **CTA "Ver DRE completo"** — mencionado na spec como elemento da home. Como é UI, o teste real vive no frontend (repo separado). O backend só expõe `latestAnalysis.id` que o frontend usa pra navegar pra `/dre/{id}`. Cobertura indireta via R1.
3. **Tags "3 gargalos" / "Plano pronto"** — a spec menciona esses badges na tela current. O backend não retorna essas tags como string — elas são derivadas pelo frontend a partir de `cards.critical_gap >= 3` e `actionPlan != null`. Sem regra explícita serializada, sem teste backend (responsabilidade do frontend).
4. **Cláusula de outcome cobrável (C2)** — spec stub não define `outcome_clause`. Não há SLA testável no `hub`. **Ação:** quando a spec definir agreement_rate / latency p95 para `hub_loaded`, adicionar testes de performance/latência (provável Vitest `bench` ou suite separada).
5. **Eval suite mínima (≥10 casos)** — spec stub não declara casos de eval (Hub é Tier B sem LLM, então provavelmente N/A; confirmar quando spec for promovida de stub).
6. **Configuração por tenant (C8)** — spec stub não define overrides por tenant para o Hub (ex.: número configurável de meses no histórico). Hoje é fixo em 12. **Ação:** se uma config `hub.history_months` for adicionada à spec, transformar R9 em teste parametrizado.
7. **Plano de Ação 3-horizontes na home** — spec descreve "Plano 3-horizontes" mas não especifica se a home deve mostrar items individuais ou apenas o summary agregado. Testes atuais cobrem o **summary** (R4) porque é isso que o backend devolve. Se a spec exigir items, é **TEST-DRIFT** entre spec e backend — abrir issue.

> Nenhuma rota do backend atual contradiz a spec stub explicitamente, então não há blocos `// TEST-DRIFT` neste plano. Todos os testes refletem fielmente as regras derivadas dos outcomes `hub_loaded` e `history_listed` declarados na spec.
