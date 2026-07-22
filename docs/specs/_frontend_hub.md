# Frontend Contract — hub

**Módulo:** hub  
**Onda:** 1  
**Tier:** B  
**Gerado em:** 2026-05-12  
**Status backend:** complete (commit 8f51c09)

---

### 1. OpenAPI 3.1 spec

```yaml
openapi: "3.1.0"
info:
  title: Aicfo Hub API
  version: "1.0.0"
  description: >
    Endpoints da tela home pós-login (snapshot da última análise + histórico de
    análises dos últimos 12 meses). Módulo hub — Onda 1.

servers:
  - url: https://api.example.com/v1
    description: Produção
  - url: http://localhost:3000/v1
    description: Desenvolvimento local

security:
  - bearerAuth: []

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: >
        JWT assinado pelo backend. O claim `tenant_id` identifica o tenant — o
        frontend nunca envia tenantId no path, query ou body.

  schemas:
    # ── Compartilhados ──────────────────────────────────────────────────────

    RequestId:
      type: string
      format: uuid
      description: UUID v4 que identifica unicamente a requisição. Presente em toda resposta.
      example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

    ProblemDetail:
      type: object
      description: Erro RFC 7807
      required: [type, title, status, detail, instance]
      properties:
        type:
          type: string
          format: uri
          example: "https://api.example.com/errors/unauthorized"
        title:
          type: string
          example: "Unauthorized"
        status:
          type: integer
          example: 401
        detail:
          type: string
          example: "Token JWT ausente ou expirado."
        instance:
          type: string
          format: uri
          example: "/v1/hub"
        requestId:
          type: string
          format: uuid
          example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

    # ── Subscription ────────────────────────────────────────────────────────

    SubscriptionInfo:
      type: object
      required: [plan, mode, status]
      properties:
        plan:
          type: string
          enum: [trial, lite, pro, business]
          description: Plano contratado pelo tenant.
          example: "pro"
        mode:
          type: string
          enum: [shadow, assisted, autonomous]
          description: >
            Modo de operação da IA (C4).
            `shadow` — análise gerada mas não entregue ao cliente;
            `assisted` — entregue com revisão humana;
            `autonomous` — entregue diretamente.
          example: "assisted"
        status:
          type: string
          enum: [active, past_due, canceled, paused]
          description: Status da assinatura.
          example: "active"

    # ── DRE Snapshot ────────────────────────────────────────────────────────

    DreSnapshot:
      type: object
      description: >
        Cinco métricas financeiras da DRE do mês de referência.
        Valores percentuais (margemLiquida, margemEbitda) são decimais: 0.18 = 18 %.
        Valores monetários (receitaBruta, lucroLiquido, ebitda) são inteiros em centavos.
      required:
        - receitaBruta
        - lucroLiquido
        - margemLiquida
        - ebitda
        - margemEbitda
      properties:
        receitaBruta:
          type: integer
          description: Receita bruta em centavos.
          example: 120000000
        lucroLiquido:
          type: integer
          description: Lucro líquido em centavos.
          example: 21600000
        margemLiquida:
          type: number
          format: double
          description: Margem líquida (decimal, ex 0.18 = 18 %).
          example: 0.18
        ebitda:
          type: integer
          description: EBITDA em centavos.
          example: 24000000
        margemEbitda:
          type: number
          format: double
          description: Margem EBITDA (decimal).
          example: 0.20

    # ── Cards snapshot ───────────────────────────────────────────────────────

    CardsSnapshot:
      type: object
      description: Contagem de cards de narrativa por tipo no mês.
      required: [critical_gap, attention, healthy]
      properties:
        critical_gap:
          type: integer
          minimum: 0
          description: Quantidade de cards do tipo "gargalo crítico".
          example: 1
        attention:
          type: integer
          minimum: 0
          description: Quantidade de cards do tipo "atenção".
          example: 1
        healthy:
          type: integer
          minimum: 0
          description: Quantidade de cards do tipo "saudável".
          example: 1

    # ── Action Plan snapshot ─────────────────────────────────────────────────

    ActionPlanSnapshot:
      type: object
      description: Resumo financeiro do plano de ação 3-horizontes. Null quando não há plano.
      required:
        - total
        - shortImpactCents
        - mediumImpactCents
        - longImpactCents
        - totalImpactCents
      properties:
        total:
          type: integer
          description: Total de itens no plano.
          example: 5
        shortImpactCents:
          type: integer
          description: Soma do impacto estimado (centavos) dos itens de curto prazo (≤30 dias).
          example: 4800000
        mediumImpactCents:
          type: integer
          description: Soma do impacto estimado (centavos) dos itens de médio prazo (30-90 dias).
          example: 9600000
        longImpactCents:
          type: integer
          description: Soma do impacto estimado (centavos) dos itens de longo prazo (90+ dias).
          example: 7200000
        totalImpactCents:
          type: integer
          description: Soma total do impacto estimado do plano em centavos.
          example: 21600000

    # ── Latest Analysis (resposta de GET /hub) ───────────────────────────────

    LatestAnalysis:
      type: object
      description: Detalhes da análise mais recente do tenant. Null quando nenhuma análise existe ainda.
      required:
        - id
        - referenceMonth
        - status
        - mode
        - deliveredAt
        - approvedAt
        - dre
        - cards
        - actionPlan
      properties:
        id:
          type: string
          format: uuid
          example: "c9d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f"
        referenceMonth:
          type: string
          pattern: "^\\d{4}-\\d{2}$"
          description: Mês de referência no formato YYYY-MM.
          example: "2026-04"
        status:
          type: string
          enum: [pending, generating, ready, delivered, approved]
          description: >
            Status do pipeline da análise.
            `pending` — aguardando lançamentos suficientes;
            `generating` — pipeline rodando;
            `ready` — gerado, aguardando entrega (usado em modo shadow);
            `delivered` — entregue ao cliente;
            `approved` — cliente aprovou (mês fechado).
          example: "delivered"
        mode:
          type: string
          enum: [shadow, assisted, autonomous]
          description: Snapshot do modo de operação no momento da geração.
          example: "assisted"
        deliveredAt:
          type: string
          format: date-time
          nullable: true
          description: ISO-8601 com timezone. Null quando não entregue ainda.
          example: "2026-05-05T14:30:00-03:00"
        approvedAt:
          type: string
          format: date-time
          nullable: true
          description: ISO-8601 com timezone. Null quando não aprovado pelo cliente.
          example: null
        dre:
          $ref: "#/components/schemas/DreSnapshot"
          nullable: true
          description: DRE snapshot. Null quando a análise ainda não foi gerada.
        cards:
          $ref: "#/components/schemas/CardsSnapshot"
        actionPlan:
          $ref: "#/components/schemas/ActionPlanSnapshot"
          nullable: true
          description: Resumo do plano de ação. Null quando não há itens de ação.

    # ── Analysis Summary (resposta de GET /analyses) ─────────────────────────

    AnalysisSummary:
      type: object
      description: Item da lista de histórico de análises.
      required:
        - id
        - referenceMonth
        - status
        - mode
        - deliveredAt
        - approvedAt
        - costCents
        - totalImpactCents
      properties:
        id:
          type: string
          format: uuid
          example: "c9d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f"
        referenceMonth:
          type: string
          pattern: "^\\d{4}-\\d{2}$"
          example: "2026-04"
        status:
          type: string
          enum: [pending, generating, ready, delivered, approved]
          example: "approved"
        mode:
          type: string
          enum: [shadow, assisted, autonomous]
          example: "assisted"
        deliveredAt:
          type: string
          format: date-time
          nullable: true
          example: "2026-05-05T14:30:00-03:00"
        approvedAt:
          type: string
          format: date-time
          nullable: true
          example: "2026-05-07T09:15:00-03:00"
        costCents:
          type: integer
          nullable: true
          description: Custo de inferência da análise em centavos. Pode ser null em análises antigas.
          example: 380
        totalImpactCents:
          type: integer
          nullable: true
          description: Soma do impacto financeiro estimado do plano de ação em centavos. Null quando não há plano.
          example: 21600000

  responses:
    Unauthorized:
      description: Token JWT ausente, expirado ou inválido.
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"
          example:
            type: "https://api.example.com/errors/unauthorized"
            title: "Unauthorized"
            status: 401
            detail: "Token JWT ausente ou expirado."
            instance: "/v1/hub"
            requestId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    InternalError:
      description: Erro interno do servidor.
      content:
        application/problem+json:
          schema:
            $ref: "#/components/schemas/ProblemDetail"
          example:
            type: "https://api.example.com/errors/internal-server-error"
            title: "Internal Server Error"
            status: 500
            detail: "Erro inesperado ao processar a requisição."
            instance: "/v1/hub"
            requestId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

# ── Endpoints ────────────────────────────────────────────────────────────────

paths:
  /hub:
    get:
      operationId: getHubSnapshot
      summary: Home snapshot
      description: >
        Retorna a subscription do tenant e os dados da análise mais recente
        (DRE 5 métricas, contagem de cards, resumo do plano de ação).
        Usado para renderizar a tela home pós-login.
        `latestAnalysis` é `null` quando o tenant ainda não possui nenhuma análise.
      tags: [Hub]
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Snapshot obtido com sucesso.
          headers:
            X-Request-Id:
              schema:
                type: string
                format: uuid
              description: Mesmo UUID presente no body como `requestId`.
          content:
            application/json:
              schema:
                type: object
                required: [requestId, subscription, latestAnalysis]
                properties:
                  requestId:
                    $ref: "#/components/schemas/RequestId"
                  subscription:
                    $ref: "#/components/schemas/SubscriptionInfo"
                  latestAnalysis:
                    oneOf:
                      - $ref: "#/components/schemas/LatestAnalysis"
                      - type: "null"
              examples:
                com_analise:
                  summary: Tenant com análise entregue
                  value:
                    requestId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                    subscription:
                      plan: "pro"
                      mode: "assisted"
                      status: "active"
                    latestAnalysis:
                      id: "c9d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f"
                      referenceMonth: "2026-04"
                      status: "delivered"
                      mode: "assisted"
                      deliveredAt: "2026-05-05T14:30:00-03:00"
                      approvedAt: null
                      dre:
                        receitaBruta: 120000000
                        lucroLiquido: 21600000
                        margemLiquida: 0.18
                        ebitda: 24000000
                        margemEbitda: 0.20
                      cards:
                        critical_gap: 1
                        attention: 1
                        healthy: 1
                      actionPlan:
                        total: 5
                        shortImpactCents: 4800000
                        mediumImpactCents: 9600000
                        longImpactCents: 7200000
                        totalImpactCents: 21600000
                sem_analise:
                  summary: Novo tenant sem análises ainda
                  value:
                    requestId: "b2c3d4e5-f6a7-8901-bcde-f12345678901"
                    subscription:
                      plan: "trial"
                      mode: "shadow"
                      status: "active"
                    latestAnalysis: null
        "401":
          $ref: "#/components/responses/Unauthorized"
        "500":
          $ref: "#/components/responses/InternalError"

  /analyses:
    get:
      operationId: listAnalyses
      summary: Histórico de análises
      description: >
        Retorna as últimas 12 análises mensais do tenant, ordenadas pela mais
        recente primeiro. Endpoint sem paginação cursor (limite fixo de 12,
        equivalente a 1 ano de histórico — produto v1).
      tags: [Hub]
      security:
        - bearerAuth: []
      responses:
        "200":
          description: Histórico obtido com sucesso.
          headers:
            X-Request-Id:
              schema:
                type: string
                format: uuid
          content:
            application/json:
              schema:
                type: object
                required: [requestId, analyses]
                properties:
                  requestId:
                    $ref: "#/components/schemas/RequestId"
                  analyses:
                    type: array
                    maxItems: 12
                    items:
                      $ref: "#/components/schemas/AnalysisSummary"
              examples:
                historico_com_dados:
                  summary: Tenant com 2 análises no histórico
                  value:
                    requestId: "c3d4e5f6-a7b8-9012-cdef-123456789012"
                    analyses:
                      - id: "c9d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f"
                        referenceMonth: "2026-04"
                        status: "approved"
                        mode: "assisted"
                        deliveredAt: "2026-05-05T14:30:00-03:00"
                        approvedAt: "2026-05-07T09:15:00-03:00"
                        costCents: 380
                        totalImpactCents: 21600000
                      - id: "d0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a"
                        referenceMonth: "2026-03"
                        status: "approved"
                        mode: "assisted"
                        deliveredAt: "2026-04-04T11:00:00-03:00"
                        approvedAt: "2026-04-06T16:45:00-03:00"
                        costCents: 350
                        totalImpactCents: 18000000
                historico_vazio:
                  summary: Tenant sem análises ainda
                  value:
                    requestId: "d4e5f6a7-b8c9-0123-defa-234567890123"
                    analyses: []
        "401":
          $ref: "#/components/responses/Unauthorized"
        "500":
          $ref: "#/components/responses/InternalError"
```

---

### 2. Zod schema TypeScript

```ts
import { z } from "zod";

// ── Primitivos reutilizáveis ────────────────────────────────────────────────

export const RequestIdSchema = z.string().uuid();

export const ReferenceMonthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Formato esperado: YYYY-MM");

// ── Enums ──────────────────────────────────────────────────────────────────

export const SubscriptionPlanSchema = z.enum(["trial", "lite", "pro", "business"]);
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

export const SubscriptionModeSchema = z.enum(["shadow", "assisted", "autonomous"]);
export type SubscriptionMode = z.infer<typeof SubscriptionModeSchema>;

export const SubscriptionStatusSchema = z.enum(["active", "past_due", "canceled", "paused"]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const AnalysisStatusSchema = z.enum([
  "pending",
  "generating",
  "ready",
  "delivered",
  "approved",
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

// ── Subscription ───────────────────────────────────────────────────────────

export const SubscriptionInfoSchema = z.object({
  plan: SubscriptionPlanSchema,
  mode: SubscriptionModeSchema,
  status: SubscriptionStatusSchema,
});
export type SubscriptionInfo = z.infer<typeof SubscriptionInfoSchema>;

// ── DRE Snapshot ───────────────────────────────────────────────────────────

/**
 * receitaBruta, lucroLiquido, ebitda → inteiros em centavos.
 * margemLiquida, margemEbitda          → decimal (0.18 = 18 %).
 */
export const DreSnapshotSchema = z.object({
  receitaBruta: z.number().int().nonnegative(),
  lucroLiquido: z.number().int(),
  margemLiquida: z.number(),
  ebitda: z.number().int(),
  margemEbitda: z.number(),
});
export type DreSnapshot = z.infer<typeof DreSnapshotSchema>;

// ── Cards Snapshot ─────────────────────────────────────────────────────────

export const CardsSnapshotSchema = z.object({
  critical_gap: z.number().int().nonnegative(),
  attention: z.number().int().nonnegative(),
  healthy: z.number().int().nonnegative(),
});
export type CardsSnapshot = z.infer<typeof CardsSnapshotSchema>;

// ── Action Plan Snapshot ───────────────────────────────────────────────────

export const ActionPlanSnapshotSchema = z.object({
  total: z.number().int().nonnegative(),
  shortImpactCents: z.number().int(),
  mediumImpactCents: z.number().int(),
  longImpactCents: z.number().int(),
  totalImpactCents: z.number().int(),
});
export type ActionPlanSnapshot = z.infer<typeof ActionPlanSnapshotSchema>;

// ── Latest Analysis ────────────────────────────────────────────────────────

export const LatestAnalysisSchema = z.object({
  id: z.string().uuid(),
  referenceMonth: ReferenceMonthSchema,
  status: AnalysisStatusSchema,
  mode: SubscriptionModeSchema,
  deliveredAt: z.string().datetime({ offset: true }).nullable(),
  approvedAt: z.string().datetime({ offset: true }).nullable(),
  dre: DreSnapshotSchema.nullable(),
  cards: CardsSnapshotSchema,
  actionPlan: ActionPlanSnapshotSchema.nullable(),
});
export type LatestAnalysis = z.infer<typeof LatestAnalysisSchema>;

// ── Hub Snapshot Response — GET /v1/hub ───────────────────────────────────

export const HubSnapshotResponseSchema = z.object({
  requestId: RequestIdSchema,
  subscription: SubscriptionInfoSchema,
  latestAnalysis: LatestAnalysisSchema.nullable(),
});
export type HubSnapshotResponse = z.infer<typeof HubSnapshotResponseSchema>;

// ── Analysis Summary ───────────────────────────────────────────────────────

export const AnalysisSummarySchema = z.object({
  id: z.string().uuid(),
  referenceMonth: ReferenceMonthSchema,
  status: AnalysisStatusSchema,
  mode: SubscriptionModeSchema,
  deliveredAt: z.string().datetime({ offset: true }).nullable(),
  approvedAt: z.string().datetime({ offset: true }).nullable(),
  costCents: z.number().int().nullable(),
  totalImpactCents: z.number().int().nullable(),
});
export type AnalysisSummary = z.infer<typeof AnalysisSummarySchema>;

// ── Analyses List Response — GET /v1/analyses ─────────────────────────────

export const AnalysesListResponseSchema = z.object({
  requestId: RequestIdSchema,
  analyses: z.array(AnalysisSummarySchema).max(12),
});
export type AnalysesListResponse = z.infer<typeof AnalysesListResponseSchema>;

// ── RFC 7807 Problem Detail ────────────────────────────────────────────────

export const ProblemDetailSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  requestId: RequestIdSchema.optional(),
});
export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;

// ── Helpers de exibição ────────────────────────────────────────────────────

/**
 * Converte centavos para Real brasileiro formatado.
 * Exemplo: centsToBrl(120000000) → "R$ 1.200.000,00"
 */
export function centsToBrl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/**
 * Converte decimal para percentual formatado.
 * Exemplo: decimalToPercent(0.1823) → "18,23%"
 */
export function decimalToPercent(value: number, decimals = 1): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formata mês de referência para exibição.
 * Exemplo: formatReferenceMonth("2026-04") → "abril/2026"
 */
export function formatReferenceMonth(referenceMonth: string): string {
  const [year, month] = referenceMonth.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
```

---

### 3. Handoff doc

## Módulo hub — Handoff para o dev frontend

O módulo `hub` expõe dois endpoints que alimentam a **tela home pós-login** do Aicfo. `GET /v1/hub` retorna o snapshot da assinatura do tenant + dados da análise mais recente (DRE 5 métricas, contagem de cards de narrativa, resumo financeiro do plano de ação). `GET /v1/analyses` retorna o histórico das últimas 12 análises mensais. Ambos são consultas determinísticas ao banco — sem LLM, portanto latência baixa.

---

## Tabela de endpoints

| Método | Path | Propósito |
|--------|------|-----------|
| `GET` | `/v1/hub` | Snapshot home: subscription + última análise |
| `GET` | `/v1/analyses` | Histórico: últimas 12 análises do tenant |

---

## GET /v1/hub

### Request

- **Método:** `GET`
- **Path:** `/v1/hub`
- **Headers obrigatórios:**
  ```
  Authorization: Bearer <jwt>
  ```
- **Query params:** nenhum
- **Body:** nenhum

O `tenantId` é extraído automaticamente do JWT claim `tenant_id` pelo backend. Nunca envie tenantId no path, query ou body.

#### Exemplo feliz
```http
GET /v1/hub HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```

#### Exemplo edge — tenant sem análises (primeiro acesso)
```http
GET /v1/hub HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```
Resposta idêntica em estrutura, mas `latestAnalysis` será `null`.

---

### Response 200

```json
{
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "subscription": {
    "plan": "pro",
    "mode": "assisted",
    "status": "active"
  },
  "latestAnalysis": {
    "id": "c9d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
    "referenceMonth": "2026-04",
    "status": "delivered",
    "mode": "assisted",
    "deliveredAt": "2026-05-05T14:30:00-03:00",
    "approvedAt": null,
    "dre": {
      "receitaBruta": 120000000,
      "lucroLiquido": 21600000,
      "margemLiquida": 0.18,
      "ebitda": 24000000,
      "margemEbitda": 0.20
    },
    "cards": {
      "critical_gap": 1,
      "attention": 1,
      "healthy": 1
    },
    "actionPlan": {
      "total": 5,
      "shortImpactCents": 4800000,
      "mediumImpactCents": 9600000,
      "longImpactCents": 7200000,
      "totalImpactCents": 21600000
    }
  }
}
```

#### Exemplo de resposta — novo tenant (sem análises)
```json
{
  "requestId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "subscription": {
    "plan": "trial",
    "mode": "shadow",
    "status": "active"
  },
  "latestAnalysis": null
}
```

### Respostas de erro

| Status | `type` | Quando ocorre | Ação esperada no frontend |
|--------|--------|---------------|---------------------------|
| `401` | `.../errors/unauthorized` | JWT ausente, expirado ou assinatura inválida | Redirecionar para tela de login; limpar tokens do storage |
| `500` | `.../errors/internal-server-error` | Erro inesperado no servidor | Exibir mensagem genérica de erro; oferecer botão "Tentar novamente" |

---

## GET /v1/analyses

### Request

- **Método:** `GET`
- **Path:** `/v1/analyses`
- **Headers obrigatórios:**
  ```
  Authorization: Bearer <jwt>
  ```
- **Query params:** nenhum
- **Body:** nenhum

#### Exemplo feliz
```http
GET /v1/analyses HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```

#### Exemplo edge — tenant sem histórico
```http
GET /v1/analyses HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```
Resposta com `analyses: []` — array vazio, não `null`.

---

### Response 200

```json
{
  "requestId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "analyses": [
    {
      "id": "c9d2e3f4-5a6b-7c8d-9e0f-1a2b3c4d5e6f",
      "referenceMonth": "2026-04",
      "status": "approved",
      "mode": "assisted",
      "deliveredAt": "2026-05-05T14:30:00-03:00",
      "approvedAt": "2026-05-07T09:15:00-03:00",
      "costCents": 380,
      "totalImpactCents": 21600000
    },
    {
      "id": "d0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a",
      "referenceMonth": "2026-03",
      "status": "approved",
      "mode": "assisted",
      "deliveredAt": "2026-04-04T11:00:00-03:00",
      "approvedAt": "2026-04-06T16:45:00-03:00",
      "costCents": 350,
      "totalImpactCents": 18000000
    }
  ]
}
```

#### Exemplo de resposta — histórico vazio
```json
{
  "requestId": "d4e5f6a7-b8c9-0123-defa-234567890123",
  "analyses": []
}
```

### Respostas de erro

| Status | `type` | Quando ocorre | Ação esperada no frontend |
|--------|--------|---------------|---------------------------|
| `401` | `.../errors/unauthorized` | JWT ausente ou expirado | Redirecionar para login; limpar tokens |
| `500` | `.../errors/internal-server-error` | Erro inesperado no servidor | Exibir mensagem genérica; botão "Tentar novamente" |

---

## Estados de UI sugeridos

### Tela home (GET /v1/hub)

| Estado | Condição | O que renderizar |
|--------|----------|-----------------|
| **loading** | Requisição em andamento | Skeleton da home: placeholders para DRE, cards e plano de ação |
| **empty** | `latestAnalysis === null` | Banner de boas-vindas + CTA "Iniciar primeira análise" |
| **shadow** | `latestAnalysis` presente + `subscription.mode === "shadow"` | Exibir snapshot normalmente; esconder ou cinzar a opção "Ver DRE completo" (análise ainda não liberada para o cliente; apenas Rafael visualiza) |
| **ready** | `latestAnalysis.status === "ready"` | Banner informativo: "Sua análise está sendo revisada. Em breve disponível." |
| **generating** | `latestAnalysis.status === "generating"` | Progress indicator: "Gerando análise... aguarde alguns minutos" |
| **delivered** | `latestAnalysis.status === "delivered"` | Card principal com DRE snapshot + contagem de cards + resumo do plano de ação + CTA "Ver DRE completo" + CTA "Iniciar nova análise" |
| **approved** | `latestAnalysis.status === "approved"` | Igual ao `delivered` com badge "Mês aprovado" e `approvedAt` formatado |
| **error** | Requisição retornou erro HTTP | Mensagem de erro inline + botão "Tentar novamente" |

### Lista de análises (GET /v1/analyses)

| Estado | Condição | O que renderizar |
|--------|----------|-----------------|
| **loading** | Requisição em andamento | Skeleton de lista (3-4 linhas) |
| **empty** | `analyses.length === 0` | Mensagem "Nenhuma análise anterior disponível" |
| **success** | `analyses.length > 0` | Lista de cards por mês (máx 12 itens) com badge de status + data + impacto total |
| **error** | Erro HTTP | Mensagem inline + "Tentar novamente" |

---

## Convenções de paginação, filtros e auth

### Paginação
`GET /v1/analyses` **não aceita paginação** na v1 — retorna sempre as últimas 12 análises (1 ano) em ordem decrescente de `referenceMonth`. Não enviar parâmetros `cursor`, `limit` ou `page`.

### Filtros
Nenhum filtro disponível nesses endpoints na v1.

### Autenticação
- Todas as requisições exigem `Authorization: Bearer <jwt>` no header.
- O JWT é emitido pelo módulo `auth-tenant`.
- Ao receber `401`, limpar os tokens do storage (localStorage/sessionStorage/cookie) e redirecionar para `/login`.
- O `tenantId` **nunca** deve ser enviado pelo frontend — o backend extrai do JWT claim `tenant_id`.

### requestId
Toda resposta (sucesso e erro) contém um campo `requestId` (UUID v4). Armazene-o em logs/analytics do frontend para correlacionar com traces do backend.

---

## Formatação de valores no frontend

| Campo | Tipo retornado | Como exibir |
|-------|----------------|-------------|
| `receitaBruta`, `lucroLiquido`, `ebitda` | `integer` (centavos) | Dividir por `100` e formatar como moeda BRL: `R$ 1.200.000,00` |
| `shortImpactCents`, `mediumImpactCents`, `longImpactCents`, `totalImpactCents` | `integer` (centavos) | Idem |
| `costCents` | `integer` (centavos) | Opcional exibir para admin; dividir por `100` |
| `margemLiquida`, `margemEbitda` | `number` decimal (0.18 = 18 %) | Multiplicar por `100` e formatar como `%`: `18,0%` |
| `deliveredAt`, `approvedAt` | `string` ISO-8601 com offset | Usar `Date` nativo ou `date-fns`; exibir em pt-BR: `"5 de maio de 2026"` |
| `referenceMonth` | `"YYYY-MM"` | Converter para mês por extenso: `"abril/2026"` |

Os helpers `centsToBrl`, `decimalToPercent` e `formatReferenceMonth` no bloco Zod acima implementam essas conversões.

---

## Edge cases que o frontend precisa tratar

1. **`latestAnalysis === null`** — ocorre no primeiro acesso do tenant, antes de qualquer análise ser gerada. A tela home deve ter estado "empty" explícito com CTA de onboarding, não quebrar ou exibir NaN.

2. **`latestAnalysis.dre === null`** — a análise existe na base (ex: status `pending` ou `generating`) mas o conteúdo DRE ainda não foi gerado. Não tentar exibir métricas DRE; exibir estado "em processamento".

3. **`latestAnalysis.actionPlan === null`** — pode ocorrer quando a análise foi gerada mas nenhum item de plano foi produzido (edge raro). Tratar como "Plano de ação indisponível" sem quebrar o layout.

4. **`subscription.mode === "shadow"`** — neste modo a análise é gerada internamente mas **não é para ser entregue ao cliente**. O frontend deve esconder ou bloquear CTAs que levem ao DRE completo ou plano de ação detalhado; exibir apenas uma mensagem informativa sobre a assinatura.

5. **`status === "ready"`** — análise gerada mas aguardando revisão humana (Rafael). O cliente não deve ver o conteúdo ainda. Exibir banner de "em revisão".

6. **`analyses: []`** — array vazio é resposta válida para tenant sem histórico, não confundir com erro de rede. Verificar pelo campo `analyses` explicitamente.

7. **`costCents === null`** e **`totalImpactCents === null`** — ambos podem ser `null` em análises mais antigas ou análises sem plano de ação. Não exibir "R$ 0,00", exibir "—" ou omitir.

8. **Valores negativos em `lucroLiquido` e `ebitda`** — PMEs em prejuízo terão valores negativos. O frontend deve tratar o caso (cor diferente, prefixo negativo visível, não truncar com `Math.abs`).

9. **`margemLiquida` ou `margemEbitda` negativos** — idem: exibir negativo explicitamente (ex: `"-5,2%"`), não usar valor absoluto.

10. **Race condition ao iniciar nova análise** — se o usuário acionar o CTA "Iniciar nova análise" e em seguida re-carregar `GET /v1/hub`, o `status` pode alternar rapidamente entre `pending` e `generating`. Fazer polling leve (ex: 10 s) apenas enquanto `status` for `pending` ou `generating`; parar ao atingir `ready` ou `delivered`.

11. **`subscription.status !== "active"`** — para `past_due`, `canceled` ou `paused`, considerar exibir banner de alerta de assinatura antes dos dados de análise. O backend ainda retorna os dados normalmente; a decisão de bloquear acesso é UX do frontend.

12. **Timezone** — `deliveredAt` e `approvedAt` vêm com offset (`-03:00`). Usar o offset retornado, não assumir UTC nem fuso local do browser.
