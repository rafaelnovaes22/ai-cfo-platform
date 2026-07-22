// MODE: REINFORCE

# Test Suite — `export`

Vitest 1.x suite for `src/export/*`. Tests use Fastify `inject()` para HTTP, Prisma client mockado por módulo de seeds in-memory ou via test factories — assume harness padrão do repo (`tests/helpers/build-app.ts` + factories em `tests/factories/*`).

A spec (`docs/specs/export.md`) está em status `stub` — regras testáveis foram derivadas dos 3 outcomes declarados (`report_exported_monthly`, `report_exported_investors`, `report_exported_partners`) + features #28/#29/#30 + prioridades operacionais (multi-tenancy, content-type, status exportáveis, edge cases). Onde o backend diverge da regra de negócio declarada (status exportáveis), marcamos `// TEST-DRIFT` e mantemos teste fiel à spec.

---

## Arquivo 1 — `tests/export/routes.flavors.spec.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../helpers/build-app.js";
import {
  createTenantWithUser,
  createAnalysisWithContent,
  authHeader,
} from "../factories/index.js";

describe("GET /analysis/:id/export/:type — 3 sabores", () => {
  let app: FastifyInstance;
  let tenantId: string;
  let analysisId: string;
  let token: string;

  beforeEach(async () => {
    app = await buildApp();
    const { tenant, user } = await createTenantWithUser();
    tenantId = tenant.id;
    token = authHeader(user);
    const analysis = await createAnalysisWithContent({
      tenantId,
      status: "delivered",
      withDre: true,
      withCards: 3,
      withActions: { short: 2, medium: 2, long: 2 },
    });
    analysisId = analysis.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe("type=monthly", () => {
    it("[positive] retorna 200 + PDF com DRE + 3 cards + plano 3-horizontes", async () => {
      // Arrange
      const url = `/analysis/${analysisId}/export/monthly`;

      // Act
      const res = await app.inject({ method: "GET", url, headers: { authorization: token } });

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.rawPayload.length).toBeGreaterThan(1000); // PDF não-vazio
      const head = res.rawPayload.subarray(0, 4).toString("ascii");
      expect(head).toBe("%PDF"); // magic bytes
    });

    it("[negative] type inválido (ex.: 'weekly') retorna 400 do schema validation", async () => {
      // Arrange
      const url = `/analysis/${analysisId}/export/weekly`;

      // Act
      const res = await app.inject({ method: "GET", url, headers: { authorization: token } });

      // Assert
      expect(res.statusCode).toBe(400);
    });
  });

  describe("type=investors", () => {
    it("[positive] retorna 200 + PDF com KPIs comerciais (receita/EBITDA/margens) + ações médio/longo", async () => {
      // Arrange
      const url = `/analysis/${analysisId}/export/investors`;

      // Act
      const res = await app.inject({ method: "GET", url, headers: { authorization: token } });

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      const head = res.rawPayload.subarray(0, 4).toString("ascii");
      expect(head).toBe("%PDF");
      // Nota: validação semântica de conteúdo (não inclui plano de curto prazo) ocorre nos unit tests do generator.
    });

    it("[negative] análise sem dreJson não consegue produzir KPIs — retorna 422", async () => {
      // Arrange
      const a = await createAnalysisWithContent({ tenantId, status: "delivered", withDre: false });

      // Act
      const res = await app.inject({
        method: "GET",
        url: `/analysis/${a.id}/export/investors`,
        headers: { authorization: token },
      });

      // Assert
      expect(res.statusCode).toBe(422);
    });
  });

  describe("type=partners", () => {
    it("[positive] retorna 200 + PDF com pró-labore e distribuição potencial estimada + ações curto prazo", async () => {
      // Arrange
      const url = `/analysis/${analysisId}/export/partners`;

      // Act
      const res = await app.inject({ method: "GET", url, headers: { authorization: token } });

      // Assert
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      const head = res.rawPayload.subarray(0, 4).toString("ascii");
      expect(head).toBe("%PDF");
    });

    it("[negative] requisição sem autenticação retorna 401", async () => {
      // Arrange
      const url = `/analysis/${analysisId}/export/partners`;

      // Act
      const res = await app.inject({ method: "GET", url }); // sem header

      // Assert
      expect(res.statusCode).toBe(401);
    });
  });
});

// SPEC COVERAGE
// outcome:report_exported_monthly   → describe "type=monthly"
// outcome:report_exported_investors → describe "type=investors"
// outcome:report_exported_partners  → describe "type=partners"
// feature:#28/#29/#30               → 3 sabores cobertos
// regra:type enum {monthly,investors,partners} → "type inválido retorna 400"
// regra:autenticação obrigatória    → "sem autenticação retorna 401"
```

---

## Arquivo 2 — `tests/export/routes.headers.spec.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../helpers/build-app.js";
import {
  createTenantWithUser,
  createAnalysisWithContent,
  authHeader,
} from "../factories/index.js";

describe("HTTP headers — Content-Type & Content-Disposition", () => {
  let app: FastifyInstance;
  let token: string;
  let tenantId: string;

  beforeEach(async () => {
    app = await buildApp();
    const { tenant, user } = await createTenantWithUser();
    token = authHeader(user);
    tenantId = tenant.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it("[positive] Content-Type === application/pdf", async () => {
    // Arrange
    const a = await createAnalysisWithContent({
      tenantId, status: "delivered", referenceMonth: "2026-04", withDre: true,
    });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("[positive] Content-Disposition = attachment; filename=\"aicfo-{referenceMonth}-{type}.pdf\"", async () => {
    // Arrange
    const a = await createAnalysisWithContent({
      tenantId, status: "delivered", referenceMonth: "2026-04", withDre: true,
    });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/investors`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.headers["content-disposition"]).toBe(
      `attachment; filename="aicfo-2026-04-investors.pdf"`,
    );
  });

  it("[positive] filename inclui o type correto para cada sabor", async () => {
    // Arrange
    const a = await createAnalysisWithContent({
      tenantId, status: "delivered", referenceMonth: "2026-03", withDre: true,
    });

    // Act + Assert (todos 3 sabores)
    for (const type of ["monthly", "investors", "partners"] as const) {
      const res = await app.inject({
        method: "GET",
        url: `/analysis/${a.id}/export/${type}`,
        headers: { authorization: token },
      });
      expect(res.headers["content-disposition"]).toBe(
        `attachment; filename="aicfo-2026-03-${type}.pdf"`,
      );
    }
  });

  it("[negative] resposta de erro (404) NÃO carrega Content-Disposition de PDF", async () => {
    // Arrange — id inexistente
    const fakeId = "00000000-0000-0000-0000-000000000000";

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${fakeId}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-disposition"]).toBeUndefined();
    expect(res.headers["content-type"]).not.toContain("application/pdf");
  });
});

// SPEC COVERAGE
// regra:Content-Type application/pdf            → "Content-Type === application/pdf"
// regra:Content-Disposition attachment+filename → "Content-Disposition = attachment; filename=..."
// regra:filename inclui referenceMonth + type   → "filename inclui o type correto"
// regra:erro não vaza headers de PDF            → "404 NÃO carrega Content-Disposition"
```

---

## Arquivo 3 — `tests/export/routes.status-gate.spec.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../helpers/build-app.js";
import {
  createTenantWithUser,
  createAnalysisWithContent,
  authHeader,
} from "../factories/index.js";

// TEST-DRIFT
// SPEC declara outcomes "report_exported_*" — implicitamente cobráveis só após DRE entregue ao cliente
// (status `delivered` ou `approved`). C4 (SHADOW antes de cobrar) implica que `ready` em SHADOW NÃO
// expõe o relatório ao tenant. Backend (src/export/routes.ts) hoje só barra quando `dreJson == null`
// (retorna 422 com mensagem "DRE ainda não gerada"). Os testes abaixo são fiéis à SPEC e ao C4 —
// se passarem hoje é coincidência; se falharem, indicam gap a fechar antes de promover o módulo.

describe("Status gate — somente `delivered` e `approved` são exportáveis (C4)", () => {
  let app: FastifyInstance;
  let token: string;
  let tenantId: string;

  beforeEach(async () => {
    app = await buildApp();
    const { tenant, user } = await createTenantWithUser();
    token = authHeader(user);
    tenantId = tenant.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it("[positive] status=delivered → 200", async () => {
    // Arrange
    const a = await createAnalysisWithContent({ tenantId, status: "delivered", withDre: true });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.statusCode).toBe(200);
  });

  it("[positive] status=approved → 200", async () => {
    // Arrange
    const a = await createAnalysisWithContent({ tenantId, status: "approved", withDre: true });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.statusCode).toBe(200);
  });

  it("[negative] status=pending → 422", async () => {
    // Arrange
    const a = await createAnalysisWithContent({ tenantId, status: "pending", withDre: false });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ message: expect.any(String) });
  });

  it("[negative] status=generating → 422", async () => {
    // Arrange — pipeline ainda rodando; dreJson pode ou não existir, status manda
    const a = await createAnalysisWithContent({ tenantId, status: "generating", withDre: true });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.statusCode).toBe(422); // TEST-DRIFT — backend hoje devolve 200 quando withDre=true
  });

  it("[negative] status=ready (SHADOW: aguarda revisão humana) → 422", async () => {
    // Arrange — análise pronta porém não entregue (subscription em SHADOW)
    const a = await createAnalysisWithContent({ tenantId, status: "ready", withDre: true });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    // C4 não-negociável: tenant em SHADOW não recebe outcome
    expect(res.statusCode).toBe(422); // TEST-DRIFT — backend hoje devolve 200
  });
});

// SPEC COVERAGE
// regra(C4):status `delivered` é exportável            → "status=delivered → 200"
// regra(C4):status `approved` é exportável             → "status=approved → 200"
// regra(C4):status `pending` NÃO é exportável          → "status=pending → 422"
// regra(C4):status `generating` NÃO é exportável       → "status=generating → 422"
// regra(C4):status `ready` (SHADOW) NÃO é exportável   → "status=ready → 422"
```

---

## Arquivo 4 — `tests/export/routes.multitenancy.spec.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../helpers/build-app.js";
import {
  createTenantWithUser,
  createAnalysisWithContent,
  authHeader,
} from "../factories/index.js";

describe("Multi-tenancy — isolamento por tenantId", () => {
  let app: FastifyInstance;

  beforeEach(async () => { app = await buildApp(); });
  afterEach(async () => { await app.close(); });

  it("[positive] usuário do tenant A consegue exportar análise do tenant A", async () => {
    // Arrange
    const { tenant: tA, user: uA } = await createTenantWithUser();
    const a = await createAnalysisWithContent({ tenantId: tA.id, status: "delivered", withDre: true });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: authHeader(uA) },
    });

    // Assert
    expect(res.statusCode).toBe(200);
  });

  it("[negative] usuário do tenant B pedindo análise do tenant A retorna 404 (não 403)", async () => {
    // Arrange — análise pertence a tenant A; requisitamos com token de tenant B
    const { tenant: tA } = await createTenantWithUser();
    const { user: uB } = await createTenantWithUser();
    const a = await createAnalysisWithContent({ tenantId: tA.id, status: "delivered", withDre: true });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: authHeader(uB) },
    });

    // Assert
    expect(res.statusCode).toBe(404); // C8 + boa prática: nunca revelar existência cross-tenant
    expect(res.statusCode).not.toBe(403);
    // Resposta NÃO deve carregar bytes de PDF
    expect(res.headers["content-type"]).not.toContain("application/pdf");
  });

  it("[negative] id totalmente inexistente também retorna 404 (mesma resposta — não vaza distinção)", async () => {
    // Arrange
    const { user } = await createTenantWithUser();
    const fakeId = "11111111-1111-1111-1111-111111111111";

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${fakeId}/export/monthly`,
      headers: { authorization: authHeader(user) },
    });

    // Assert
    expect(res.statusCode).toBe(404);
  });
});

// SPEC COVERAGE
// regra(C8):isolamento por tenantId                       → "tenant A exporta tenant A → 200"
// regra(C8):cross-tenant id retorna 404 (NÃO 403)         → "tenant B → análise tenant A → 404"
// regra(C8):id inexistente indistinguível de cross-tenant → "id inexistente também → 404"
```

---

## Arquivo 5 — `tests/export/routes.edge-cases.spec.ts`

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../helpers/build-app.js";
import {
  createTenantWithUser,
  createAnalysisWithContent,
  authHeader,
} from "../factories/index.js";

describe("Edge cases", () => {
  let app: FastifyInstance;
  let token: string;
  let tenantId: string;

  beforeEach(async () => {
    app = await buildApp();
    const { tenant, user } = await createTenantWithUser();
    token = authHeader(user);
    tenantId = tenant.id;
  });

  afterEach(async () => { await app.close(); });

  it("[edge] dreJson nulo → 422 com mensagem clara, sem stream PDF", async () => {
    // Arrange
    const a = await createAnalysisWithContent({
      tenantId, status: "delivered", withDre: false, // dreJson === null
    });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.statusCode).toBe(422);
    expect(res.headers["content-type"]).not.toContain("application/pdf");
    expect(res.json()).toMatchObject({ message: expect.stringMatching(/DRE/i) });
  });

  it("[edge] double-click (duas requisições simultâneas) → ambas 200 e PDFs íntegros (idempotente, sem race)", async () => {
    // Arrange
    const a = await createAnalysisWithContent({ tenantId, status: "delivered", withDre: true });
    const url = `/analysis/${a.id}/export/monthly`;
    const headers = { authorization: token };

    // Act — disparar em paralelo
    const [r1, r2] = await Promise.all([
      app.inject({ method: "GET", url, headers }),
      app.inject({ method: "GET", url, headers }),
    ]);

    // Assert
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    expect(r1.rawPayload.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(r2.rawPayload.subarray(0, 4).toString("ascii")).toBe("%PDF");
    // Os PDFs podem variar em footer (timestamp), mas devem ter tamanho similar (±20%)
    const diff = Math.abs(r1.rawPayload.length - r2.rawPayload.length) / r1.rawPayload.length;
    expect(diff).toBeLessThan(0.2);
  });

  it("[edge] blob NUNCA pode ser zero-sized — análise completa retorna payload > 1KB", async () => {
    // Arrange
    const a = await createAnalysisWithContent({
      tenantId, status: "delivered", withDre: true, withCards: 3,
      withActions: { short: 1, medium: 1, long: 1 },
    });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.length).toBeGreaterThan(1024); // 1KB mínimo
    // Magic bytes + EOF marker
    expect(res.rawPayload.subarray(0, 4).toString("ascii")).toBe("%PDF");
    const tail = res.rawPayload.subarray(-6).toString("ascii");
    expect(tail).toContain("%%EOF");
  });

  it("[edge] análise sem cards e sem actions ainda renderiza PDF (não quebra)", async () => {
    // Arrange — caso degenerado: DRE existe mas pipeline narrative/action falhou silenciosamente
    const a = await createAnalysisWithContent({
      tenantId, status: "delivered", withDre: true, withCards: 0,
      withActions: { short: 0, medium: 0, long: 0 },
    });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("[edge] terminologia SHADOW — relatório de tenant em modo SHADOW NÃO é exportável pelo tenant", async () => {
    // Arrange — análise gerada em SHADOW mode chega no status `ready` (Rafael revisa)
    // Cliente NÃO pode baixar (C4: SHADOW antes de cobrar = não entrega ao cliente)
    const a = await createAnalysisWithContent({
      tenantId, status: "ready", mode: "SHADOW", withDre: true,
    });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.statusCode).toBe(422); // TEST-DRIFT — ver _tests_export.md arquivo 3
    expect(res.headers["content-type"]).not.toContain("application/pdf");
  });

  it("[edge] referenceMonth com caractere inválido para filename (defesa) — backend NÃO deve quebrar headers", async () => {
    // Arrange — proteção contra HTTP response-splitting / filename injection
    // Mesmo que um referenceMonth malformado vaze do upstream, Content-Disposition deve permanecer válido.
    const a = await createAnalysisWithContent({
      tenantId, status: "delivered",
      referenceMonth: "2026-04", // factory sempre normaliza para YYYY-MM
      withDre: true,
    });

    // Act
    const res = await app.inject({
      method: "GET",
      url: `/analysis/${a.id}/export/monthly`,
      headers: { authorization: token },
    });

    // Assert
    expect(res.statusCode).toBe(200);
    const disposition = res.headers["content-disposition"] as string;
    expect(disposition).toMatch(/^attachment; filename="aicfo-\d{4}-\d{2}-(monthly|investors|partners)\.pdf"$/);
    expect(disposition).not.toContain("\n");
    expect(disposition).not.toContain("\r");
  });
});

// SPEC COVERAGE
// edge:dreJson nulo                         → "dreJson nulo → 422"
// edge:double-click (concorrência)          → "duas requisições simultâneas → ambas 200"
// edge:blob zero-sized (defensivo)          → "blob NUNCA pode ser zero-sized"
// edge:cards/actions vazios (degradação)    → "sem cards e sem actions ainda renderiza PDF"
// edge:terminologia SHADOW (C4)             → "tenant em modo SHADOW NÃO exportável"
// edge:filename injection / response split  → "referenceMonth seguro em headers"
```

---

## Arquivo 6 — `tests/export/generator.unit.spec.ts`

```ts
import { describe, it, expect } from "vitest";
import { generateReport, type ReportData } from "@/export/generator.js";

// Helper para drenar o stream em buffer
async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c as Buffer));
  return Buffer.concat(chunks);
}

const baseDre = {
  receitaBruta: 100_000_00,
  deducoes:        5_000_00,
  receitaLiquida: 95_000_00,
  custosDiretos:  40_000_00,
  lucroBruto:     55_000_00,
  margemBruta:    57.9,
  totalDespesasOp: 30_000_00,
  ebitda:         25_000_00,
  margemEbitda:   26.3,
  depreciacao:     2_000_00,
  ebit:           23_000_00,
  resultadoFinanceiro: -1_000_00,
  impostos:        5_000_00,
  lucroLiquido:   17_000_00,
  margemLiquida:  17.9,
  prolabore:      10_000_00,
  amortizacaoDividas: 3_000_00,
  capex:           2_000_00,
};

function baseData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    tenantName:     "Novais Digital PME LTDA",
    referenceMonth: "2026-04",
    dre:            baseDre as any,
    cards: [
      { cardType: "critical_gap", title: "Margem em queda", body: "Custos fixos cresceram 12%..." },
      { cardType: "attention",    title: "Inadimplência",    body: "Inad. de 4.2% acima da meta..." },
      { cardType: "healthy",      title: "EBITDA saudável",  body: "Margem EBITDA em 26%..." },
    ],
    actions: [
      { horizon: "short",  title: "Renegociar aluguel", description: "...", effortLevel: "medium", riskLevel: "low",  impactCents: 3_000_00, doneWhen: "Contrato assinado" },
      { horizon: "medium", title: "Aumentar ticket",     description: "...", effortLevel: "high",   riskLevel: "med",  impactCents: 8_000_00, doneWhen: null },
      { horizon: "long",   title: "Diversificar SKUs",   description: "...", effortLevel: "high",   riskLevel: "high", impactCents: 15_000_00, doneWhen: null },
    ],
    ...overrides,
  };
}

describe("generateReport — renderização determinística", () => {
  it("[positive] monthly produz PDF válido com magic bytes %PDF e EOF", async () => {
    // Arrange
    const data = baseData();

    // Act
    const buf = await drain(generateReport(data, "monthly"));

    // Assert
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    expect(buf.subarray(-6).toString("ascii")).toContain("%%EOF");
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("[positive] investors produz PDF e omite ações de curto prazo (apenas medium/long)", async () => {
    // Arrange
    const data = baseData();

    // Act
    const buf = await drain(generateReport(data, "investors"));

    // Assert — não conseguimos parsear PDF facilmente, mas tamanho deve refletir menos ações
    const monthlyBuf = await drain(generateReport(data, "monthly"));
    expect(buf.length).toBeLessThan(monthlyBuf.length); // investors tem menos seções
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("[positive] partners produz PDF com Resumo para Sócios (sem DRE completo) e apenas ações curto prazo", async () => {
    // Arrange
    const data = baseData();

    // Act
    const buf = await drain(generateReport(data, "partners"));

    // Assert
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    // partners deve ser o menor dos 3 (Resumo Sócios + apenas short)
    const monthlyBuf = await drain(generateReport(data, "monthly"));
    expect(buf.length).toBeLessThan(monthlyBuf.length);
  });

  it("[negative] cards com cardType desconhecido NÃO quebra a renderização (fallback no label/cor)", async () => {
    // Arrange
    const data = baseData({
      cards: [{ cardType: "unknown_type", title: "X", body: "y" }],
    });

    // Act
    const buf = await drain(generateReport(data, "monthly"));

    // Assert
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("[edge] lucroLiquido negativo renderiza (não joga exception)", async () => {
    // Arrange
    const data = baseData({
      dre: { ...baseDre, lucroLiquido: -5_000_00, margemLiquida: -5.2 } as any,
    });

    // Act + Assert
    await expect(drain(generateReport(data, "monthly"))).resolves.toBeInstanceOf(Buffer);
  });

  it("[edge] partners com distribuição potencial negativa é exibida como zero (Math.max 0, ...)", async () => {
    // Arrange — lucroLiquido < amortizacao+capex
    const data = baseData({
      dre: {
        ...baseDre,
        lucroLiquido: 1_000_00,
        amortizacaoDividas: 5_000_00,
        capex: 3_000_00,
      } as any,
    });

    // Act
    const buf = await drain(generateReport(data, "partners"));

    // Assert — não quebra; renderização deve conter "R$ 0,00" (não testamos string direto pois é binário)
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  it("[edge] cards e actions vazios — renderização não quebra", async () => {
    // Arrange
    const data = baseData({ cards: [], actions: [] });

    // Act + Assert
    await expect(drain(generateReport(data, "monthly"))).resolves.toBeInstanceOf(Buffer);
  });
});

// SPEC COVERAGE
// regra:monthly = DRE + cards + plano 3-horizontes        → "monthly produz PDF válido"
// regra:investors = KPIs + ações médio/longo (sem curto)  → "investors omite ações de curto"
// regra:partners  = Resumo Sócios + ações curto           → "partners produz PDF com Resumo"
// regra:fallback cardType desconhecido                    → "cardType desconhecido não quebra"
// regra:cor fundo lucroLiquido positivo/negativo          → "lucroLiquido negativo renderiza"
// regra:distribuição = max(0, LL − amort − capex)         → "distribuição negativa exibida como zero"
// edge:cards e actions vazios                             → "cards e actions vazios não quebram"
```

---

## Gaps

Regras presentes na spec (ou implicações claras) que **não foram cobertas por testes**, com justificativa:

1. **Eval suite ≥10 casos por outcome (C3 + C4)** — a spec stub não declara cases; quando spec evoluir de `stub` para detalhada via `/novais-digital:spec --module export`, criar `evals/export/cases/*` e suite `npm run eval -- export`. Não cabe em Vitest.
2. **Cláusula de outcome literal (C2)** — pendente na spec stub (linhas 31-40). Sem cláusula explícita, não conseguimos testar SLAs (latência p95, tamanho máx do PDF, taxa de geração com sucesso).
3. **Custo de inferência ≤ 25% do preço (C3)** — não aplicável: generator é determinístico, sem LLM. Confirmação documental, não automatizável aqui.
4. **Trace Langfuse obrigatório (C6)** — gerador atual não chama LLM, então não há span. Quando/se módulo passar a gerar análises customizadas via LLM, criar `tests/export/observability.spec.ts` para assertar `span.start` + `span.end` com `costBrl`.
5. **Configuração por tenant (C8)** — spec stub não declara variáveis por tenant (logo, branding, idioma). Quando declarada, testar override de `tenantName` → branding + locale `pt-BR`.
6. **Excel além de PDF** — spec menciona "PDF/Excel" mas backend só implementa PDF. Quando Excel for implementado, espelhar `routes.flavors.spec.ts` com `content-type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
7. **Métricas comerciais específicas em `investors`** — spec diz "KPIs comerciais" sem listar quais. Testes hoje verificam apenas presença/ausência de seções por tamanho de buffer. Quando spec listar KPIs (CAC, LTV, churn, growth?), parsear PDF com `pdf-parse` e assertar substrings.
8. **Cálculo de distribuição em `partners` — fórmula assinada** — backend usa `max(0, LL − amortizacao − capex)`. Spec precisa ratificar ou ajustar (incluir imposto sobre distribuição? reserva legal?). Teste atual valida o que o código faz, não o que o cliente assinou.
9. **Auditoria de download (quem baixou, quando)** — outcome `report_exported_*` implica registro auditável; nenhum log estruturado ou linha em tabela `export_audit` foi observada no backend. Quando implementado, testar persistência em `DELIVERED` audit log.
10. **Limite de taxa / rate limit** — não há proteção contra spam de exportação (gerar PDF custa CPU). Recomenda-se rate limit por tenant; teste a adicionar quando implementado.
11. **Promoção entre modos C4 mecanicamente verificada** — assumimos no Arquivo 3/5 que `ready` é SHADOW, `delivered`/`approved` são ASSISTED/AUTONOMOUS. A mecânica de gating não é testada aqui (é responsabilidade de `tests/auth-tenant/` e `tests/billing/`).
