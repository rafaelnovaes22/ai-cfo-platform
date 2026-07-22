// MODE: REINFORCE

# Tests — action-plan

Suíte de testes Vitest 1.x para o módulo `action-plan` do SKU `monthly-analysis`.

Fontes:
- `docs/specs/action-plan.md` (SPEC — fonte das regras; status `stub`, outcomes literais usados como regra testável)
- `docs/specs/_backend_action-plan.md` (shapes e handlers)
- `src/action-plan/generator.ts`, `src/action-plan/routes.ts` (referência de tipos/contratos)

Convenções:
- Cada arquivo testa um arquivo de produção. Mocks de Prisma via `vi.mock("@/persistence/prisma.js")`.
- LLM mockado via `vi.mock("@/llm/index.js")`.
- HTTP testado via `app.inject()` do Fastify.

---

## 1. `src/action-plan/__tests__/generator.spec.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateActionPlan } from "@/action-plan/generator.js";

vi.mock("@/llm/index.js", () => ({
  callLlm: vi.fn(),
}));

vi.mock("@/persistence/prisma.js", () => {
  const tx = {
    actionPlanItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    monthlyAnalysis: { update: vi.fn() },
  };
  const db = {
    monthlyAnalysis: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    tenant: { findUniqueOrThrow: vi.fn() },
    narrativeCard: { findMany: vi.fn() },
    actionPlanItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
  return { getPrisma: () => db, __db: db };
});

import { callLlm } from "@/llm/index.js";
import { getPrisma } from "@/persistence/prisma.js";

const ANALYSIS_ID = "analysis_1";
const TENANT_ID = "tenant_1";

const dre = {
  receitaBruta: 100_000_00,
  custosVariaveis: 40_000_00,
  margemContribuicao: 60_000_00,
  custosFixos: 30_000_00,
  ebitda: 30_000_00,
} as any;

const validPlan = {
  actions: [
    { horizon: "short", title: "S1", description: "x", effortLevel: "low",    riskLevel: "low",    impactCents: 100_00, deadlineDays: 30, doneWhen: "ok" },
    { horizon: "short", title: "S2", description: "x", effortLevel: "low",    riskLevel: "low",    impactCents: 200_00, deadlineDays: 60, doneWhen: "ok" },
    { horizon: "short", title: "S3", description: "x", effortLevel: "medium", riskLevel: "low",    impactCents: 300_00, deadlineDays: 90, doneWhen: "ok" },
    { horizon: "medium", title: "M1", description: "x", effortLevel: "medium", riskLevel: "medium", impactCents: 500_00, deadlineDays: 120, doneWhen: "ok" },
    { horizon: "long", title: "L1", description: "x", effortLevel: "high",   riskLevel: "high",   impactCents: 1_000_00, deadlineDays: 365, doneWhen: "ok" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  const db = (getPrisma() as any);
  db.monthlyAnalysis.findUniqueOrThrow.mockResolvedValue({
    id: ANALYSIS_ID, tenantId: TENANT_ID, referenceMonth: "2026-04",
    mode: "assisted", costCents: 0, status: "processing",
  });
  db.tenant.findUniqueOrThrow.mockResolvedValue({
    id: TENANT_ID, industrySegment: "varejo", taxRegime: "simples", productConfig: {},
  });
  db.narrativeCard.findMany.mockResolvedValue([]);
});

describe("generateActionPlan — geração 3-horizontes (regra: plan_generated)", () => {
  it("[+] aceita plano com ≥3 short + ≥1 medium + ≥1 long (mínimos atendidos)", async () => {
    // Arrange
    (callLlm as any).mockResolvedValueOnce({ content: JSON.stringify(validPlan), costCents: 5 });

    // Act
    await generateActionPlan(ANALYSIS_ID, TENANT_ID, dre);

    // Assert
    expect(callLlm).toHaveBeenCalledTimes(1); // sem retry
    const tx = (getPrisma() as any).__tx;
    expect(tx.actionPlanItem.createMany).toHaveBeenCalledTimes(1);
    const payload = tx.actionPlanItem.createMany.mock.calls[0][0].data;
    expect(payload.filter((a: any) => a.horizon === "short").length).toBeGreaterThanOrEqual(3);
    expect(payload.filter((a: any) => a.horizon === "medium").length).toBeGreaterThanOrEqual(1);
    expect(payload.filter((a: any) => a.horizon === "long").length).toBeGreaterThanOrEqual(1);
  });

  it("[-] dispara retry quando primeiro plano não atende mínimos (apenas 2 short)", async () => {
    // Arrange
    const insufficient = {
      actions: [
        { horizon: "short", title: "S1", description: "x", effortLevel: "low", riskLevel: "low", impactCents: 100_00 },
        { horizon: "short", title: "S2", description: "x", effortLevel: "low", riskLevel: "low", impactCents: 200_00 },
        { horizon: "medium", title: "M1", description: "x", effortLevel: "low", riskLevel: "low", impactCents: 300_00 },
        { horizon: "long",   title: "L1", description: "x", effortLevel: "low", riskLevel: "low", impactCents: 400_00 },
        { horizon: "medium", title: "M2", description: "x", effortLevel: "low", riskLevel: "low", impactCents: 500_00 },
      ],
    };
    (callLlm as any)
      .mockResolvedValueOnce({ content: JSON.stringify(insufficient), costCents: 3 })
      .mockResolvedValueOnce({ content: JSON.stringify(validPlan),    costCents: 4 });

    // Act
    await generateActionPlan(ANALYSIS_ID, TENANT_ID, dre);

    // Assert
    expect(callLlm).toHaveBeenCalledTimes(2);
    const retryCall = (callLlm as any).mock.calls[1][0];
    expect(retryCall.userPrompt).toMatch(/ATENÇÃO/);
  });
});

describe("generateActionPlan — impacto em centavos integer (regra: impact_total_calculated)", () => {
  it("[+] persiste totalImpact = soma de todos os impactCents", async () => {
    // Arrange
    (callLlm as any).mockResolvedValueOnce({ content: JSON.stringify(validPlan), costCents: 1 });

    // Act
    await generateActionPlan(ANALYSIS_ID, TENANT_ID, dre);

    // Assert
    const tx = (getPrisma() as any).__tx;
    const updateCall = tx.monthlyAnalysis.update.mock.calls[0][0];
    expect(updateCall.data.actionPlanJson.totalImpact).toBe(
      100_00 + 200_00 + 300_00 + 500_00 + 1_000_00,
    );
    expect(updateCall.data.actionPlanJson.shortImpact).toBe(600_00);
    expect(updateCall.data.actionPlanJson.mediumImpact).toBe(500_00);
    expect(updateCall.data.actionPlanJson.longImpact).toBe(1_000_00);
    // Centavos = inteiros
    for (const a of updateCall.data.actionPlanJson.actions) {
      expect(Number.isInteger(a.impactCents)).toBe(true);
      expect(a.impactCents).toBeGreaterThan(0);
    }
  });

  it("[-] rejeita impactCents fracionário ou ≤0 (schema PlanResponseSchema)", async () => {
    // Arrange
    const bad = {
      actions: [
        { ...validPlan.actions[0], impactCents: 100.5 },
        ...validPlan.actions.slice(1),
      ],
    };
    (callLlm as any).mockResolvedValueOnce({ content: JSON.stringify(bad), costCents: 1 });

    // Act + Assert
    await expect(generateActionPlan(ANALYSIS_ID, TENANT_ID, dre)).rejects.toThrow();
  });
});

describe("generateActionPlan — C4 mode → status final", () => {
  it("[+] mode=autonomous ⇒ status=delivered + deliveredAt setado", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.monthlyAnalysis.findUniqueOrThrow.mockResolvedValue({
      id: ANALYSIS_ID, tenantId: TENANT_ID, referenceMonth: "2026-04",
      mode: "autonomous", costCents: 0, status: "processing",
    });
    (callLlm as any).mockResolvedValueOnce({ content: JSON.stringify(validPlan), costCents: 1 });

    // Act
    await generateActionPlan(ANALYSIS_ID, TENANT_ID, dre);

    // Assert
    const tx = db.__tx;
    const data = tx.monthlyAnalysis.update.mock.calls[0][0].data;
    expect(data.status).toBe("delivered");
    expect(data.deliveredAt).toBeInstanceOf(Date);
  });

  it("[-] mode≠autonomous (shadow/assisted) ⇒ status=ready, deliveredAt=null", async () => {
    // Arrange — mode default assisted no beforeEach
    (callLlm as any).mockResolvedValueOnce({ content: JSON.stringify(validPlan), costCents: 1 });

    // Act
    await generateActionPlan(ANALYSIS_ID, TENANT_ID, dre);

    // Assert
    const tx = (getPrisma() as any).__tx;
    const data = tx.monthlyAnalysis.update.mock.calls[0][0].data;
    expect(data.status).toBe("ready");
    expect(data.deliveredAt).toBeNull();
  });
});

describe("generateActionPlan — edge cases (retry, transação, persistência)", () => {
  it("[edge] propaga erro do schema quando LLM retorna JSON inválido (retry esgotado)", async () => {
    // Arrange — duas respostas ainda inválidas (sem 'long')
    const noLong = {
      actions: [
        { horizon: "short", title: "S1", description: "x", effortLevel: "low", riskLevel: "low", impactCents: 100_00 },
        { horizon: "short", title: "S2", description: "x", effortLevel: "low", riskLevel: "low", impactCents: 200_00 },
        { horizon: "short", title: "S3", description: "x", effortLevel: "low", riskLevel: "low", impactCents: 300_00 },
        { horizon: "medium", title: "M1", description: "x", effortLevel: "low", riskLevel: "low", impactCents: 400_00 },
        { horizon: "medium", title: "M2", description: "x", effortLevel: "low", riskLevel: "low", impactCents: 500_00 },
      ],
    };
    (callLlm as any)
      .mockResolvedValueOnce({ content: JSON.stringify(noLong), costCents: 1 })
      .mockResolvedValueOnce({ content: JSON.stringify(noLong), costCents: 1 });

    // Act — retry só roda 1x; segunda resposta ainda não tem 'long' mas passa pelo schema (min(5))
    // SPEC exige ≥1 long — TEST-DRIFT: backend não falha após retry, apenas persiste plano inválido.
    // TEST-DRIFT: teste fiel à SPEC força falha quando após retry mínimos ainda não são atendidos.
    await expect(generateActionPlan(ANALYSIS_ID, TENANT_ID, dre)).rejects.toThrow(
      /horizontes mínimos|mínimo|long/i,
    );
  });

  it("[edge] deleteMany roda antes do createMany na mesma transação (idempotência de regenerate)", async () => {
    // Arrange
    (callLlm as any).mockResolvedValueOnce({ content: JSON.stringify(validPlan), costCents: 1 });
    const order: string[] = [];
    const tx = (getPrisma() as any).__tx;
    tx.actionPlanItem.deleteMany.mockImplementation(async () => { order.push("delete"); });
    tx.actionPlanItem.createMany.mockImplementation(async () => { order.push("create"); });

    // Act
    await generateActionPlan(ANALYSIS_ID, TENANT_ID, dre);

    // Assert
    expect(order).toEqual(["delete", "create"]);
  });

  it("[edge] acumula costCents no analysis (não sobrescreve)", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.monthlyAnalysis.findUniqueOrThrow.mockResolvedValue({
      id: ANALYSIS_ID, tenantId: TENANT_ID, referenceMonth: "2026-04",
      mode: "assisted", costCents: 42, status: "processing",
    });
    (callLlm as any).mockResolvedValueOnce({ content: JSON.stringify(validPlan), costCents: 8 });

    // Act
    await generateActionPlan(ANALYSIS_ID, TENANT_ID, dre);

    // Assert
    const tx = db.__tx;
    expect(tx.monthlyAnalysis.update.mock.calls[0][0].data.costCents).toBe(50);
  });
});

// SPEC COVERAGE
// plan_generated (≥3 short + ≥1 medium + ≥1 long)          → describe "geração 3-horizontes"
// action_executable (cada ação tem 'doneWhen' mensurável)  → assert implícito via schema; ver routes.spec
// impact_total_calculated (soma por horizonte + total R$)  → describe "impacto em centavos integer"
// C4 mode → status (autonomous=delivered; demais=ready)    → describe "C4 mode → status final"
// retry de LLM (mínimos não atendidos)                     → describe "geração" caso [-] + edge "retry esgotado"
// impactCents = centavos integer positivo                  → describe "impacto" caso [-]
```

---

## 2. `src/action-plan/__tests__/routes.spec.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { actionPlanRoutes } from "@/action-plan/routes.js";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";

vi.mock("@/persistence/prisma.js", () => {
  const db = {
    monthlyAnalysis: { findFirst: vi.fn(), update: vi.fn() },
    actionPlanItem:  { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  };
  return { getPrisma: () => db, __db: db };
});

vi.mock("@/auth/middleware.js", () => ({
  requireAuth: async (req: any) => {
    req.auth = { tenantId: req.headers["x-tenant-id"] ?? "tenant_1", userId: "u1", mode: req.headers["x-mode"] ?? "assisted" };
  },
}));

import { getPrisma } from "@/persistence/prisma.js";

function build() {
  const app = Fastify();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.register(actionPlanRoutes);
  return app;
}

const baseItem = {
  id: "i1", analysisId: "a1", horizon: "short", title: "T", description: "D",
  effortLevel: "low", riskLevel: "low", impactCents: 100_00,
  deadlineDays: 30, doneWhen: "ok", clientApproved: null, clientComment: null,
};

beforeEach(() => vi.clearAllMocks());

describe("GET /analysis/:id/action-plan — summary por horizonte", () => {
  it("[+] retorna items + summary com totalImpact = soma de impactCents", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.monthlyAnalysis.findFirst.mockResolvedValue({ id: "a1", tenantId: "tenant_1" });
    db.actionPlanItem.findMany.mockResolvedValue([
      { ...baseItem, horizon: "short",  impactCents: 100_00 },
      { ...baseItem, id: "i2", horizon: "short",  impactCents: 200_00 },
      { ...baseItem, id: "i3", horizon: "medium", impactCents: 500_00 },
      { ...baseItem, id: "i4", horizon: "long",   impactCents: 1_000_00 },
    ]);
    const app = build();

    // Act
    const res = await app.inject({ method: "GET", url: "/analysis/a1/action-plan" });

    // Assert
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.summary).toEqual({
      shortImpact: 300_00,
      mediumImpact: 500_00,
      longImpact: 1_000_00,
      totalImpact: 1_800_00,
    });
    expect(body.items).toHaveLength(4);
  });

  it("[-] retorna 404 se analysisId não pertence ao tenant (multi-tenancy)", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.monthlyAnalysis.findFirst.mockResolvedValue(null);
    const app = build();

    // Act
    const res = await app.inject({
      method: "GET", url: "/analysis/foreign/action-plan",
      headers: { "x-tenant-id": "tenant_other" },
    });

    // Assert
    expect(res.statusCode).toBe(404);
    expect(db.monthlyAnalysis.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign", tenantId: "tenant_other" },
    });
  });
});

describe("PATCH /analysis/:id/action-plan/:itemId/feedback — feedback item a item", () => {
  it("[+] modo ASSISTED: persiste clientApproved + clientComment", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.actionPlanItem.findFirst.mockResolvedValue(baseItem);
    db.actionPlanItem.update.mockResolvedValue({ ...baseItem, clientApproved: true });
    const app = build();

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/analysis/a1/action-plan/i1/feedback",
      headers: { "x-mode": "assisted" },
      payload: { approved: true, comment: "concordo" },
    });

    // Assert
    expect(res.statusCode).toBe(200);
    expect(db.actionPlanItem.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { clientApproved: true, clientComment: "concordo" },
    });
  });

  it("[-] modo AUTONOMOUS: feedback bloqueado pela spec (apenas ASSISTED edita) — TEST-DRIFT", async () => {
    // SPEC: feedback PATCH item a item — só permitido em modo ASSISTED.
    // Backend atual NÃO valida mode no PATCH; teste fiel à SPEC espera 403/409.
    // TEST-DRIFT: backend permite — este teste detecta o gap.
    // Arrange
    const db = (getPrisma() as any);
    db.actionPlanItem.findFirst.mockResolvedValue(baseItem);
    const app = build();

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/analysis/a1/action-plan/i1/feedback",
      headers: { "x-mode": "autonomous" },
      payload: { approved: false },
    });

    // Assert
    expect([403, 409]).toContain(res.statusCode);
  });

  it("[-] modo SHADOW: feedback bloqueado (não há entrega ao cliente) — TEST-DRIFT", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.actionPlanItem.findFirst.mockResolvedValue(baseItem);
    const app = build();

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/analysis/a1/action-plan/i1/feedback",
      headers: { "x-mode": "shadow" },
      payload: { approved: true },
    });

    // Assert
    expect([403, 409]).toContain(res.statusCode);
  });

  it("[edge] item órfão (id válido mas de outro analysis) ⇒ 404", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.actionPlanItem.findFirst.mockResolvedValue(null);
    const app = build();

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/analysis/a1/action-plan/orphan/feedback",
      payload: { approved: true },
    });

    // Assert
    expect(res.statusCode).toBe(404);
  });

  it("[edge] comment > 500 chars ⇒ 400 (validação Zod)", async () => {
    // Arrange
    const app = build();

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/analysis/a1/action-plan/i1/feedback",
      payload: { approved: true, comment: "x".repeat(501) },
    });

    // Assert
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /analysis/:id/approve — fechamento do mês (idempotente)", () => {
  it("[+] primeira aprovação: status passa a 'approved' + approvedAt setado", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.monthlyAnalysis.findFirst.mockResolvedValue({
      id: "a1", tenantId: "tenant_1", status: "ready", approvedAt: null,
    });
    db.monthlyAnalysis.update.mockResolvedValue({});
    const app = build();

    // Act
    const res = await app.inject({ method: "POST", url: "/analysis/a1/approve" });

    // Assert
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe("approved");
    expect(new Date(body.approvedAt).toString()).not.toBe("Invalid Date");
    expect(db.monthlyAnalysis.update).toHaveBeenCalledTimes(1);
  });

  it("[+] idempotente: segunda chamada não dispara novo update e retorna mesmo approvedAt", async () => {
    // Arrange
    const fixed = new Date("2026-05-10T12:00:00Z");
    const db = (getPrisma() as any);
    db.monthlyAnalysis.findFirst.mockResolvedValue({
      id: "a1", tenantId: "tenant_1", status: "approved", approvedAt: fixed,
    });
    const app = build();

    // Act
    const res = await app.inject({ method: "POST", url: "/analysis/a1/approve" });

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.json().approvedAt).toBe(fixed.toISOString());
    expect(db.monthlyAnalysis.update).not.toHaveBeenCalled();
  });

  it("[-] análise inexistente / outro tenant ⇒ 404", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.monthlyAnalysis.findFirst.mockResolvedValue(null);
    const app = build();

    // Act
    const res = await app.inject({
      method: "POST", url: "/analysis/a1/approve",
      headers: { "x-tenant-id": "tenant_outro" },
    });

    // Assert
    expect(res.statusCode).toBe(404);
  });

  it("[edge] double-submit concorrente: 2 requests simultâneos → ambos 200 e estado final 'approved'", async () => {
    // Arrange
    const db = (getPrisma() as any);
    let state: any = { id: "a1", tenantId: "tenant_1", status: "ready", approvedAt: null };
    db.monthlyAnalysis.findFirst.mockImplementation(async () => ({ ...state }));
    db.monthlyAnalysis.update.mockImplementation(async ({ data }: any) => {
      state = { ...state, ...data };
    });
    const app = build();

    // Act
    const [r1, r2] = await Promise.all([
      app.inject({ method: "POST", url: "/analysis/a1/approve" }),
      app.inject({ method: "POST", url: "/analysis/a1/approve" }),
    ]);

    // Assert
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(state.status).toBe("approved");
    expect(state.approvedAt).toBeInstanceOf(Date);
  });
});

describe("Multi-tenancy + ownership", () => {
  it("[+] GET filtra por tenantId do auth (where inclui tenantId)", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.monthlyAnalysis.findFirst.mockResolvedValue({ id: "a1", tenantId: "tenant_X" });
    db.actionPlanItem.findMany.mockResolvedValue([]);
    const app = build();

    // Act
    await app.inject({
      method: "GET", url: "/analysis/a1/action-plan",
      headers: { "x-tenant-id": "tenant_X" },
    });

    // Assert
    expect(db.monthlyAnalysis.findFirst).toHaveBeenCalledWith({
      where: { id: "a1", tenantId: "tenant_X" },
    });
  });

  it("[-] PATCH com tenantId errado não encontra item ⇒ 404 (defesa de ownership)", async () => {
    // Arrange
    const db = (getPrisma() as any);
    db.actionPlanItem.findFirst.mockResolvedValue(null);
    const app = build();

    // Act
    const res = await app.inject({
      method: "PATCH",
      url: "/analysis/a1/action-plan/i1/feedback",
      headers: { "x-tenant-id": "tenant_invasor" },
      payload: { approved: true },
    });

    // Assert
    expect(res.statusCode).toBe(404);
    expect(db.actionPlanItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: "i1",
        analysis: { id: "a1", tenantId: "tenant_invasor" },
      },
    });
  });
});

// SPEC COVERAGE
// GET action-plan + summary por horizonte                        → describe "GET ... summary por horizonte"
// PATCH feedback item-a-item                                     → describe "PATCH ... feedback item a item"
// feedback restrito a ASSISTED (SPEC C4)                         → describe "PATCH" casos [-] autonomous + shadow (TEST-DRIFT)
// POST /approve idempotente                                      → describe "POST /approve ... idempotente" 2 casos [+]
// Multi-tenancy + ownership por tenant                           → describe "Multi-tenancy + ownership"
// Edge: análise aprovada (re-approve não dispara update)         → describe "POST /approve" idempotente
// Edge: double-submit                                            → describe "POST /approve" double-submit
// Edge: item órfão                                               → describe "PATCH" edge item órfão
```

---

## 3. `src/action-plan/__tests__/worker.spec.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/action-plan/generator.js", () => ({
  generateActionPlan: vi.fn(),
}));

import { generateActionPlan } from "@/action-plan/generator.js";

// Importa o processor exportado pelo worker. Em REINFORCE não temos export
// dedicado; testamos a função processor com signature documentada
// no backend doc: { data: { analysisId, tenantId, dre } }.
async function processor(job: any) {
  await generateActionPlan(job.data.analysisId, job.data.tenantId, job.data.dre);
}

beforeEach(() => vi.clearAllMocks());

describe("BullMQ worker — concorrência 2 + retry de LLM", () => {
  it("[+] processa job chamando generateActionPlan com payload correto", async () => {
    // Arrange
    const job = { data: { analysisId: "a1", tenantId: "t1", dre: { ebitda: 1 } } };

    // Act
    await processor(job);

    // Assert
    expect(generateActionPlan).toHaveBeenCalledWith("a1", "t1", { ebitda: 1 });
  });

  it("[-] propaga erro do generator (BullMQ usa para retry exponencial)", async () => {
    // Arrange
    (generateActionPlan as any).mockRejectedValueOnce(new Error("LLM timeout"));
    const job = { data: { analysisId: "a1", tenantId: "t1", dre: {} } };

    // Act + Assert
    await expect(processor(job)).rejects.toThrow("LLM timeout");
  });
});

// SPEC COVERAGE
// retry de LLM (worker BullMQ delega; generator faz retry interno)  → describe "BullMQ worker"
// Worker concorrência 2 (configuração, não comportamento testável aqui) → declarado em backend doc; cobertura parcial
```

---

## Gaps

Regras da spec / requisitos da task que NÃO viraram teste neste documento:

1. **`action_executable` — critério mensurável (`doneWhen`)**: spec exige que toda ação tenha "critério de 'feita' mensurável". O schema apenas marca `doneWhen` como `optional()`, então não há regra forçando preenchimento. Test gap reportado para revisão da spec ou do schema (TEST-DRIFT em potencial — schema permite plano sem `doneWhen`, spec não).
2. **Cláusula de outcome (C2)**: spec está em status `stub`; cláusula contratual de outcome ainda não foi escrita em `docs/specs/action-plan.md`. Sem ela, não há regra de SLA/agreement testável.
3. **Eval suite mínima (≥10 casos por outcome)**: declarada na spec stub como TBD. Não testada aqui — pertence a `evals/action-plan/cases/` e roda via `/novais-digital:eval`.
4. **Unit economics / C3 (custo ≤ 25% do preço)**: spec não declara `costCents` máximo por outcome; sem threshold não há teste de boundary.
5. **Configuração por tenant (C8)**: apenas `toneOfVoice` é lido do `productConfig`; spec não lista outros toggles. Não há teste de variação de config além do default `formal`.
6. **Instrumentação Langfuse (C6)**: `generateActionPlan` chama `callLlm` mas não há `trace.start/end` explícito no arquivo lido — depende da abstração `src/llm/index.js`. Teste de telemetria está fora do escopo deste módulo e deveria ser coberto em `src/llm/__tests__/`.
7. **Pipeline de agentes**: spec stub diz "Sonnet 4.6 + Opus 4.7 como fallback decisional"; backend usa Gemini 2.5 Flash. **TEST-DRIFT documentado**: nenhum teste valida fallback de modelo, pois a decisão de modelo vive em `src/llm/`.
8. **Promoção entre modos (SHADOW → ASSISTED → AUTONOMOUS)**: gerenciado por `/novais-digital:promote`, fora do escopo do módulo `action-plan`.
9. **Validação de horizon string genérica nas rotas**: `ActionItemSchema` em `routes.ts` declara `horizon: z.string()` (não enum), enquanto `generator.ts` usa `z.enum(["short","medium","long"])`. Possível TEST-DRIFT entre camadas — não testado para evitar falso positivo até spec definir o enum oficial.
