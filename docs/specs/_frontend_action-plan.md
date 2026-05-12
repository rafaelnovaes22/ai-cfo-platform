# Frontend Contract — action-plan

**Módulo:** `action-plan`
**Onda:** 1
**Status backend:** complete (commit `4d5892a`, 2026-05-11)
**Gerado em:** 2026-05-12

---

### 1. OpenAPI 3.1 spec

```yaml
openapi: 3.1.0
info:
  title: Aicfo — action-plan
  version: 1.0.0
  description: >
    Endpoints do módulo action-plan. Gera, consulta e coleta feedback sobre
    o Plano de Ação 3-horizontes (curto / médio / longo prazo) de uma análise
    financeira mensal.

servers:
  - url: https://api.aicfo.com.br/v1
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
        JWT assinado pelo backend. O claim `tenant_id` identifica o tenant.
        Nunca enviar tenantId em path, query ou body.

  schemas:
    # ── Enums ──────────────────────────────────────────────────────────────
    PlanHorizon:
      type: string
      enum: [short, medium, long]
      description: >
        Horizonte do plano de ação.
        short = curto prazo (até 30 dias);
        medium = médio prazo (30–90 dias);
        long = longo prazo (90+ dias).

    EffortLevel:
      type: string
      enum: [low, medium, high]

    RiskLevel:
      type: string
      enum: [low, medium, high]

    AnalysisStatus:
      type: string
      enum: [pending, generating, ready, delivered, approved]

    # ── Objetos de domínio ─────────────────────────────────────────────────
    ActionPlanItem:
      type: object
      required:
        - id
        - horizon
        - title
        - description
        - effortLevel
        - riskLevel
        - impactCents
        - deadlineDays
        - doneWhen
        - clientApproved
        - clientComment
      properties:
        id:
          type: string
          format: uuid
          example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
        horizon:
          $ref: "#/components/schemas/PlanHorizon"
        title:
          type: string
          example: "Renegociar contrato de limpeza"
        description:
          type: string
          example: "Contatar fornecedor atual e solicitar proposta com desconto por volume."
        effortLevel:
          $ref: "#/components/schemas/EffortLevel"
        riskLevel:
          $ref: "#/components/schemas/RiskLevel"
        impactCents:
          type: integer
          format: int64
          description: Impacto financeiro estimado em centavos (R$ 1,00 = 100).
          example: 48000
        deadlineDays:
          type: integer
          nullable: true
          description: Prazo sugerido em dias a partir da data da análise. Null = sem prazo definido.
          example: 15
        doneWhen:
          type: string
          nullable: true
          description: Critério mensurável de conclusão ("feita quando...").
          example: "Novo contrato assinado com redução ≥10% no valor mensal."
        clientApproved:
          type: boolean
          nullable: true
          description: >
            Aprovação explícita do cliente (modo ASSISTED). Null = ainda não avaliado.
          example: null
        clientComment:
          type: string
          nullable: true
          description: Comentário livre do cliente (máx. 500 chars).
          example: null

    ActionPlanSummary:
      type: object
      required:
        - shortImpact
        - mediumImpact
        - longImpact
        - totalImpact
      properties:
        shortImpact:
          type: integer
          format: int64
          description: Soma de impactCents de todas as ações de horizonte short.
          example: 144000
        mediumImpact:
          type: integer
          format: int64
          description: Soma de impactCents de todas as ações de horizonte medium.
          example: 360000
        longImpact:
          type: integer
          format: int64
          description: Soma de impactCents de todas as ações de horizonte long.
          example: 1304200
        totalImpact:
          type: integer
          format: int64
          description: Soma de impactCents de todas as ações (todos os horizontes).
          example: 1808200

    # ── Responses padrão ────────────────────────────────────────────────────
    ProblemDetail:
      type: object
      required: [type, title, status, detail, instance]
      properties:
        type:
          type: string
          format: uri
          example: "https://api.aicfo.com.br/problems/not-found"
        title:
          type: string
          example: "Recurso não encontrado"
        status:
          type: integer
          example: 404
        detail:
          type: string
          example: "Análise não encontrada para o tenant autenticado."
        instance:
          type: string
          format: uri
          example: "/v1/analysis/abc123/action-plan"

  parameters:
    analysisId:
      name: analysisId
      in: path
      required: true
      schema:
        type: string
        format: uuid
      description: ID da análise mensal (MonthlyAnalysis).

    itemId:
      name: itemId
      in: path
      required: true
      schema:
        type: string
        format: uuid
      description: ID do item do plano de ação (ActionPlanItem).

  headers:
    X-Request-Id:
      schema:
        type: string
        format: uuid
      description: UUID v4 gerado pelo backend para rastreabilidade. Sempre presente.

paths:
  /analysis/{analysisId}/action-plan:
    get:
      operationId: getActionPlan
      summary: Retorna o plano de ação completo de uma análise
      description: >
        Lista todos os ActionPlanItems da análise, ordenados por horizonte (asc)
        e impacto (desc). Inclui sumário agregado por horizonte.
        Somente o tenant autenticado via JWT pode acessar suas próprias análises.
      tags: [action-plan]
      parameters:
        - $ref: "#/components/parameters/analysisId"
      responses:
        "200":
          description: Plano de ação retornado com sucesso.
          headers:
            X-Request-Id:
              $ref: "#/components/headers/X-Request-Id"
          content:
            application/json:
              schema:
                type: object
                required: [requestId, items, summary]
                properties:
                  requestId:
                    type: string
                    format: uuid
                  items:
                    type: array
                    items:
                      $ref: "#/components/schemas/ActionPlanItem"
                  summary:
                    $ref: "#/components/schemas/ActionPlanSummary"
              examples:
                success:
                  summary: Resposta típica com 6 ações
                  value:
                    requestId: "a1b2c3d4-0000-0000-0000-000000000001"
                    items:
                      - id: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
                        horizon: "short"
                        title: "Renegociar contrato de limpeza"
                        description: "Contatar fornecedor e solicitar desconto por volume."
                        effortLevel: "low"
                        riskLevel: "low"
                        impactCents: 48000
                        deadlineDays: 15
                        doneWhen: "Novo contrato assinado com redução ≥10%."
                        clientApproved: null
                        clientComment: null
                      - id: "b2c3d4e5-0001-0001-0001-000000000002"
                        horizon: "medium"
                        title: "Implantar controle de estoque"
                        description: "Adotar sistema simples de controle de estoque para reduzir perdas."
                        effortLevel: "medium"
                        riskLevel: "medium"
                        impactCents: 360000
                        deadlineDays: 60
                        doneWhen: "Sistema em uso por 30 dias consecutivos com redução de perda mensurada."
                        clientApproved: null
                        clientComment: null
                    summary:
                      shortImpact: 144000
                      mediumImpact: 360000
                      longImpact: 1304200
                      totalImpact: 1808200
                emptyPlan:
                  summary: Análise existe mas plano ainda não foi gerado
                  value:
                    requestId: "a1b2c3d4-0000-0000-0000-000000000099"
                    items: []
                    summary:
                      shortImpact: 0
                      mediumImpact: 0
                      longImpact: 0
                      totalImpact: 0
        "401":
          description: Token ausente ou inválido.
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"
        "404":
          description: Análise não encontrada ou não pertence ao tenant.
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"
              example:
                type: "https://api.aicfo.com.br/problems/not-found"
                title: "Recurso não encontrado"
                status: 404
                detail: "Análise não encontrada para o tenant autenticado."
                instance: "/v1/analysis/abc123/action-plan"

  /analysis/{analysisId}/action-plan/{itemId}/feedback:
    patch:
      operationId: submitActionItemFeedback
      summary: Registra aprovação/rejeição e comentário do cliente em um item
      description: >
        Disponível apenas no modo ASSISTED. Permite que o cliente aprove ou
        rejeite individualmente cada ação do plano e inclua um comentário livre.
        Ações com clientApproved=false não são excluídas — permanecem visíveis
        para auditoria.
      tags: [action-plan]
      parameters:
        - $ref: "#/components/parameters/analysisId"
        - $ref: "#/components/parameters/itemId"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [approved]
              properties:
                approved:
                  type: boolean
                  description: true = cliente aprova a ação; false = cliente rejeita.
                comment:
                  type: string
                  maxLength: 500
                  description: Comentário opcional (máx. 500 caracteres).
            examples:
              approve:
                summary: Cliente aprova sem comentário
                value:
                  approved: true
              reject:
                summary: Cliente rejeita com justificativa
                value:
                  approved: false
                  comment: "Já tentamos renegociar em março e o fornecedor não aceita desconto."
      responses:
        "200":
          description: Feedback registrado com sucesso.
          headers:
            X-Request-Id:
              $ref: "#/components/headers/X-Request-Id"
          content:
            application/json:
              schema:
                type: object
                required: [requestId, id]
                properties:
                  requestId:
                    type: string
                    format: uuid
                  id:
                    type: string
                    format: uuid
                    description: ID do ActionPlanItem atualizado.
              example:
                requestId: "a1b2c3d4-0000-0000-0000-000000000002"
                id: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
        "400":
          description: Body inválido (ex: comment excede 500 chars).
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"
              example:
                type: "https://api.aicfo.com.br/problems/validation-error"
                title: "Dados inválidos"
                status: 400
                detail: "O campo comment excede o limite de 500 caracteres."
                instance: "/v1/analysis/abc123/action-plan/item456/feedback"
        "401":
          description: Token ausente ou inválido.
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"
        "404":
          description: Item ou análise não encontrada para o tenant.
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"

  /analysis/{analysisId}/approve:
    post:
      operationId: approveAnalysis
      summary: Fecha o mês — cliente aprova a análise completa
      description: >
        Marca a MonthlyAnalysis como `approved` e registra o timestamp de aprovação.
        Operação idempotente: se a análise já estiver aprovada, retorna 200 com os
        dados existentes sem alteração. Após aprovado, o mês é considerado fechado
        e nenhum feedback adicional deve ser aceito pelo frontend.
      tags: [action-plan]
      parameters:
        - $ref: "#/components/parameters/analysisId"
      requestBody:
        description: Body vazio — nenhum dado necessário.
        required: false
        content:
          application/json:
            schema:
              type: object
      responses:
        "200":
          description: Análise aprovada (ou já estava aprovada — idempotente).
          headers:
            X-Request-Id:
              $ref: "#/components/headers/X-Request-Id"
          content:
            application/json:
              schema:
                type: object
                required: [requestId, status, approvedAt]
                properties:
                  requestId:
                    type: string
                    format: uuid
                  status:
                    type: string
                    enum: [approved]
                  approvedAt:
                    type: string
                    format: date-time
                    description: ISO-8601 com timezone.
              examples:
                firstApproval:
                  summary: Primeira aprovação
                  value:
                    requestId: "a1b2c3d4-0000-0000-0000-000000000003"
                    status: "approved"
                    approvedAt: "2026-05-11T14:32:00.000Z"
                alreadyApproved:
                  summary: Chamada idempotente (já aprovada)
                  value:
                    requestId: "a1b2c3d4-0000-0000-0000-000000000004"
                    status: "approved"
                    approvedAt: "2026-05-11T14:32:00.000Z"
        "401":
          description: Token ausente ou inválido.
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"
        "404":
          description: Análise não encontrada ou não pertence ao tenant.
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"
```

---

### 2. Zod schema TypeScript

```ts
import { z } from "zod";

// ── Enums ──────────────────────────────────────────────────────────────────

export const PlanHorizonSchema = z.enum(["short", "medium", "long"]);
export type PlanHorizon = z.infer<typeof PlanHorizonSchema>;

export const EffortLevelSchema = z.enum(["low", "medium", "high"]);
export type EffortLevel = z.infer<typeof EffortLevelSchema>;

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const AnalysisStatusSchema = z.enum([
  "pending",
  "generating",
  "ready",
  "delivered",
  "approved",
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

// ── Objetos de domínio ──────────────────────────────────────────────────────

export const ActionPlanItemSchema = z.object({
  id: z.string().uuid(),
  horizon: PlanHorizonSchema,
  title: z.string(),
  description: z.string(),
  effortLevel: EffortLevelSchema,
  riskLevel: RiskLevelSchema,
  /** Impacto financeiro estimado em centavos (R$1,00 = 100). */
  impactCents: z.number().int(),
  /** Prazo sugerido em dias a partir da data da análise. Null = sem prazo. */
  deadlineDays: z.number().int().nullable(),
  /** Critério mensurável de conclusão. */
  doneWhen: z.string().nullable(),
  /** Aprovação do cliente (modo ASSISTED). Null = ainda não avaliado. */
  clientApproved: z.boolean().nullable(),
  /** Comentário livre do cliente (máx. 500 chars). */
  clientComment: z.string().max(500).nullable(),
});
export type ActionPlanItem = z.infer<typeof ActionPlanItemSchema>;

export const ActionPlanSummarySchema = z.object({
  /** Soma de impactCents das ações de horizonte short, em centavos. */
  shortImpact: z.number().int(),
  /** Soma de impactCents das ações de horizonte medium, em centavos. */
  mediumImpact: z.number().int(),
  /** Soma de impactCents das ações de horizonte long, em centavos. */
  longImpact: z.number().int(),
  /** Soma de impactCents de todas as ações, em centavos. */
  totalImpact: z.number().int(),
});
export type ActionPlanSummary = z.infer<typeof ActionPlanSummarySchema>;

// ── Responses ──────────────────────────────────────────────────────────────

/** GET /analysis/:analysisId/action-plan — 200 */
export const GetActionPlanResponseSchema = z.object({
  requestId: z.string().uuid(),
  items: z.array(ActionPlanItemSchema),
  summary: ActionPlanSummarySchema,
});
export type GetActionPlanResponse = z.infer<typeof GetActionPlanResponseSchema>;

/** PATCH /analysis/:analysisId/action-plan/:itemId/feedback — 200 */
export const FeedbackResponseSchema = z.object({
  requestId: z.string().uuid(),
  id: z.string().uuid(),
});
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;

/** POST /analysis/:analysisId/approve — 200 */
export const ApproveAnalysisResponseSchema = z.object({
  requestId: z.string().uuid(),
  status: z.literal("approved"),
  approvedAt: z.string().datetime({ offset: true }),
});
export type ApproveAnalysisResponse = z.infer<typeof ApproveAnalysisResponseSchema>;

// ── Requests ───────────────────────────────────────────────────────────────

/** PATCH /analysis/:analysisId/action-plan/:itemId/feedback — body */
export const FeedbackBodySchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(500).optional(),
});
export type FeedbackBody = z.infer<typeof FeedbackBodySchema>;

// ── RFC 7807 Problem Detail ────────────────────────────────────────────────

export const ProblemDetailSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
});
export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;

// ── Helpers de apresentação ────────────────────────────────────────────────

/**
 * Converte centavos para string formatada em BRL.
 * Exemplo: 48000 → "R$ 480,00"
 */
export function centsToBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/**
 * Label de horizonte para exibição em português.
 */
export const horizonLabel: Record<PlanHorizon, string> = {
  short: "Curto prazo",
  medium: "Médio prazo",
  long: "Longo prazo",
};

/**
 * Label de nível para exibição em português (esforço e risco).
 */
export const levelLabel: Record<EffortLevel | RiskLevel, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
};
```

---

### 3. Handoff doc

## Resumo do módulo

O módulo `action-plan` entrega o Plano de Ação 3-horizontes de uma análise financeira mensal. A IA gera no mínimo 3 ações de curto prazo (até 30 dias), 1 de médio prazo (30–90 dias) e 1 de longo prazo (90+ dias), cada uma com título, descrição, nível de esforço, nível de risco, impacto financeiro estimado em centavos, prazo em dias e critério mensurável de conclusão. No modo **ASSISTED** o cliente pode aprovar ou rejeitar cada ação individualmente e, ao final, "fechar o mês" via endpoint de aprovação.

---

## Tabela de endpoints

| Método   | Path                                                      | Propósito                                              |
|----------|-----------------------------------------------------------|--------------------------------------------------------|
| `GET`    | `/v1/analysis/{analysisId}/action-plan`                   | Listar ações + sumário de impacto por horizonte        |
| `PATCH`  | `/v1/analysis/{analysisId}/action-plan/{itemId}/feedback` | Registrar aprovação/rejeição de uma ação (ASSISTED)    |
| `POST`   | `/v1/analysis/{analysisId}/approve`                       | Fechar o mês — aprovação final da análise              |

---

## Detalhamento dos endpoints

### GET /v1/analysis/{analysisId}/action-plan

**Propósito:** Buscar todas as ações do plano e o sumário de impacto agregado por horizonte.

**Request shape:**
- Header `Authorization: Bearer <JWT>` obrigatório.
- Path param `analysisId` (UUID) — ID da MonthlyAnalysis.
- Sem query params adicionais neste endpoint.

**Exemplos de request:**

Caso feliz:
```http
GET /v1/analysis/f47ac10b-58cc-4372-a567-0e02b2c3d400/action-plan
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```

Edge — análise em status `generating` (plano ainda não pronto):
```http
GET /v1/analysis/f47ac10b-58cc-4372-a567-0e02b2c3d401/action-plan
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```

**Response 200 — caso feliz:**
```json
{
  "requestId": "a1b2c3d4-0000-0000-0000-000000000001",
  "items": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "horizon": "short",
      "title": "Renegociar contrato de limpeza",
      "description": "Contatar fornecedor atual e solicitar proposta com desconto por volume.",
      "effortLevel": "low",
      "riskLevel": "low",
      "impactCents": 48000,
      "deadlineDays": 15,
      "doneWhen": "Novo contrato assinado com redução ≥10% no valor mensal.",
      "clientApproved": null,
      "clientComment": null
    }
  ],
  "summary": {
    "shortImpact": 144000,
    "mediumImpact": 360000,
    "longImpact": 1304200,
    "totalImpact": 1808200
  }
}
```

**Response 200 — edge (plano ainda não gerado, `items` vazio):**
```json
{
  "requestId": "a1b2c3d4-0000-0000-0000-000000000099",
  "items": [],
  "summary": {
    "shortImpact": 0,
    "mediumImpact": 0,
    "longImpact": 0,
    "totalImpact": 0
  }
}
```

**Response 404:**
```json
{
  "type": "https://api.aicfo.com.br/problems/not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Análise não encontrada para o tenant autenticado.",
  "instance": "/v1/analysis/abc123/action-plan"
}
```

**Códigos de erro e ação esperada no frontend:**

| Status | Código/tipo                                   | Ação no frontend                                                                                     |
|--------|-----------------------------------------------|------------------------------------------------------------------------------------------------------|
| 401    | `unauthorized`                                | Redirecionar para login; limpar tokens locais.                                                       |
| 404    | `not-found`                                   | Exibir estado vazio informando que a análise não existe ou ainda não foi gerada para este mês.        |
| 500    | `internal-server-error`                       | Exibir banner de erro genérico com opção de tentar novamente.                                        |

---

### PATCH /v1/analysis/{analysisId}/action-plan/{itemId}/feedback

**Propósito:** Registrar a opinião do cliente sobre uma ação individual. Disponível apenas quando a análise está no modo `assisted`.

**Request shape:**
- Header `Authorization: Bearer <JWT>` obrigatório.
- Path params: `analysisId` (UUID) e `itemId` (UUID).
- Body JSON:

| Campo    | Tipo      | Obrigatório | Descrição                           |
|----------|-----------|-------------|-------------------------------------|
| approved | `boolean` | sim         | `true` = aprova, `false` = rejeita  |
| comment  | `string`  | não         | Comentário livre (máx. 500 chars)   |

**Exemplos de request:**

Caso feliz — aprovação simples:
```http
PATCH /v1/analysis/f47ac10b-0000/action-plan/f47ac10b-58cc/feedback
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
Content-Type: application/json

{
  "approved": true
}
```

Edge — rejeição com justificativa:
```http
PATCH /v1/analysis/f47ac10b-0000/action-plan/b2c3d4e5-0001/feedback
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
Content-Type: application/json

{
  "approved": false,
  "comment": "Já tentamos renegociar em março e o fornecedor não aceita."
}
```

**Response 200:**
```json
{
  "requestId": "a1b2c3d4-0000-0000-0000-000000000002",
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Response 400 — comment excede limite:**
```json
{
  "type": "https://api.aicfo.com.br/problems/validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "O campo comment excede o limite de 500 caracteres.",
  "instance": "/v1/analysis/abc123/action-plan/item456/feedback"
}
```

**Response 404:**
```json
{
  "type": "https://api.aicfo.com.br/problems/not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Item não encontrado para o tenant autenticado.",
  "instance": "/v1/analysis/abc123/action-plan/item456/feedback"
}
```

**Códigos de erro e ação esperada no frontend:**

| Status | Código/tipo          | Ação no frontend                                                                          |
|--------|----------------------|-------------------------------------------------------------------------------------------|
| 400    | `validation-error`   | Exibir mensagem inline no campo `comment` indicando o limite de 500 caracteres.           |
| 401    | `unauthorized`       | Redirecionar para login; limpar tokens locais.                                            |
| 404    | `not-found`          | Exibir toast de erro; recarregar a lista de ações (item pode ter sido removido).          |
| 500    | `server-error`       | Exibir toast genérico de erro; manter estado otimista revertido.                          |

---

### POST /v1/analysis/{analysisId}/approve

**Propósito:** Fechar o mês. Marca a análise como `approved`. Operação idempotente — pode ser chamada mais de uma vez com segurança.

**Request shape:**
- Header `Authorization: Bearer <JWT>` obrigatório.
- Path param `analysisId` (UUID).
- Body: vazio ou `{}`.

**Exemplos de request:**

Caso feliz:
```http
POST /v1/analysis/f47ac10b-0000/approve
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
Content-Type: application/json
```

Edge — chamada dupla (idempotente):
```http
POST /v1/analysis/f47ac10b-0000/approve
Authorization: Bearer eyJhbGciOiJSUzI1NiJ9...
```

**Response 200 — primeira aprovação:**
```json
{
  "requestId": "a1b2c3d4-0000-0000-0000-000000000003",
  "status": "approved",
  "approvedAt": "2026-05-11T14:32:00.000Z"
}
```

**Response 200 — chamada idempotente:**
```json
{
  "requestId": "a1b2c3d4-0000-0000-0000-000000000004",
  "status": "approved",
  "approvedAt": "2026-05-11T14:32:00.000Z"
}
```

**Response 404:**
```json
{
  "type": "https://api.aicfo.com.br/problems/not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "Análise não encontrada para o tenant autenticado.",
  "instance": "/v1/analysis/abc123/approve"
}
```

**Códigos de erro e ação esperada no frontend:**

| Status | Código/tipo     | Ação no frontend                                                                           |
|--------|-----------------|--------------------------------------------------------------------------------------------|
| 401    | `unauthorized`  | Redirecionar para login; limpar tokens locais.                                             |
| 404    | `not-found`     | Exibir modal de erro informando que a análise não foi encontrada.                          |
| 500    | `server-error`  | Exibir modal de erro com opção de tentar novamente; não mostrar mês como fechado.          |

---

## Estados de UI sugeridos

### Tela do Plano de Ação (GET /action-plan)

| Estado      | Quando ocorre                                              | O que exibir                                                                                      |
|-------------|------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `loading`   | Chamada em andamento                                       | Skeleton cards agrupados por horizonte (3 grupos: Curto / Médio / Longo)                           |
| `empty`     | `items.length === 0`                                       | Ilustração + texto "O plano de ação ainda está sendo gerado. Volte em instantes."                  |
| `error`     | 404 ou 5xx                                                 | Banner de erro com botão "Tentar novamente"                                                        |
| `success`   | `items.length > 0`                                         | Cards agrupados por horizonte + painel lateral de sumário (totalImpact em destaque)                |
| `approved`  | Análise com `status === "approved"`                        | Plano em modo somente-leitura com badge "Mês fechado em {approvedAt}"                             |

### Cards de Ação Individual

| Estado              | Quando ocorre                     | O que exibir                                                             |
|---------------------|-----------------------------------|--------------------------------------------------------------------------|
| `pending-feedback`  | `clientApproved === null`         | Botões Aprovar / Rejeitar ativos                                          |
| `approved`          | `clientApproved === true`         | Badge verde "Aprovada" + comentário (se houver) + botão Editar feedback   |
| `rejected`          | `clientApproved === false`        | Badge vermelho "Rejeitada" + comentário (se houver) + botão Editar feedback |
| `saving`            | PATCH em andamento                | Botões desabilitados + spinner inline                                    |
| `error`             | PATCH falhou                      | Toast de erro; reverter estado otimista                                  |

### Botão "Fechar mês" (POST /approve)

| Estado       | Quando exibir                                              | Comportamento                                                                 |
|--------------|------------------------------------------------------------|-------------------------------------------------------------------------------|
| `disabled`   | Análise não entregue (`status !== "delivered"`)            | Tooltip: "A análise ainda não foi entregue."                                  |
| `ready`      | `status === "delivered"`                                   | Ativo; abre modal de confirmação antes de chamar a API                        |
| `loading`    | POST em andamento                                          | Botão desabilitado + spinner                                                  |
| `done`       | `status === "approved"`                                    | Substituído por badge "Mês fechado" com data formatada                        |

---

## Convenções de paginação, filtros e auth

### Autenticação

- Toda chamada exige o header `Authorization: Bearer <JWT>`.
- O `tenantId` é lido pelo backend do claim `tenant_id` dentro do JWT — **nunca enviar tenantId em path, query ou body**.
- Se o backend retornar 401, o frontend deve limpar os tokens locais e redirecionar para `/login`.

### Paginação

O endpoint `GET /action-plan` retorna **todos os itens da análise sem paginação** (planos têm ≥5 e tipicamente ≤20 ações). Não há parâmetros `cursor` ou `limit` neste endpoint.

Para módulos futuros que listam múltiplas análises, a paginação será cursor-based: `?cursor=<opaque-string>&limit=50`.

### Filtros

Não há filtros expostos nesta versão. A ordenação é controlada pelo backend: horizonte crescente (`short → medium → long`) e, dentro do mesmo horizonte, impacto decrescente.

### Valores monetários

Todos os campos monetários (`impactCents`, `shortImpact`, `mediumImpact`, `longImpact`, `totalImpact`) chegam como **integer em centavos**. O frontend é responsável por formatar para BRL antes de exibir.

Exemplo de conversão:
```ts
// impactCents = 48000 → "R$ 480,00"
new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(48000 / 100);
```

### Datas

Todas as datas chegam em ISO-8601 com timezone UTC (sufixo `Z`). Use a locale `pt-BR` para formatar para exibição. Exemplo: `"2026-05-11T14:32:00.000Z"` → "11/05/2026 às 14:32".

### requestId

Toda response 200 inclui o campo `requestId` (UUID v4). Use-o em logs de erro no cliente e ao reportar bugs ao suporte.

---

## Edge cases que o frontend precisa tratar

| # | Situação                                                                         | Tratamento esperado                                                                                                                                      |
|---|----------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | `GET /action-plan` retorna `items: []`                                           | Exibir estado vazio com mensagem de geração em andamento (verificar `analysisStatus` via hub para decidir entre "gerando" e "sem dados").                |
| 2 | `clientApproved === null` após a análise ser aprovada (`status = approved`)      | Não exibir botões de feedback — modo leitura após fechamento.                                                                                           |
| 3 | Usuário clica "Fechar mês" enquanto nem todas as ações foram avaliadas            | Permitir (o backend não bloqueia por avaliação incompleta), mas exibir aviso: "X ações ainda não foram avaliadas. Deseja fechar mesmo assim?"            |
| 4 | `deadlineDays === null`                                                           | Exibir "Sem prazo definido" em vez de campo vazio ou zero.                                                                                              |
| 5 | `doneWhen === null`                                                               | Omitir o campo na UI ou exibir placeholder "Critério a definir".                                                                                        |
| 6 | Modo `autonomous` — análise entregue sem passar por ASSISTED                     | Botões de feedback de item **não devem aparecer**. O botão "Fechar mês" deve ser a única ação disponível.                                               |
| 7 | PATCH de feedback em análise já `approved`                                        | O backend aceitará a chamada (não há guard), mas o frontend não deve exibir os botões neste estado (ver estado `approved` dos cards).                   |
| 8 | `impactCents` muito alto (ex: R$ 1.000.000+)                                      | Garantir que a formatação BRL suporte valores grandes sem truncar; testar com `Intl.NumberFormat`.                                                      |
| 9 | Network timeout no POST `/approve`                                                | Não marcar o mês como fechado no estado local até receber 200 confirmado. Caso o usuário recarregue, re-buscar `analysisStatus` antes de exibir o badge. |
| 10 | Dois abas abertas no mesmo browser aprovam ao mesmo tempo                         | A operação é idempotente — a segunda chamada retorna 200 com o mesmo `approvedAt`. Não exibir erro de conflito.                                         |
