---
module_key: "classification"
module_name: "Classification — Categorização DRE"
wave: 1
tier: "B"
contract_type: "frontend"
created_at: "2026-05-12"
last_updated: "2026-05-12"
---

# Contract — Classification (Frontend)

> Gerado pelo Contract Agent. Não editar manualmente sem justificativa em PR.

---

### 1. OpenAPI 3.1 spec

```yaml
openapi: "3.1.0"
info:
  title: Aicfo — Classification API
  version: "1.0.0"
  description: |
    Endpoints para revisão e correção de categorias DRE de lançamentos financeiros.
    Autenticação via Bearer JWT; tenantId é extraído do claim `tenant_id` do token.

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

  schemas:
    # ── Taxonomia DRE ──────────────────────────────────────────────────────────
    DreCategory:
      type: string
      enum:
        - receita_bruta
        - receita_financeira
        - outras_receitas
        - deducoes_receita
        - cpv_cmv
        - custo_servicos
        - despesas_pessoal
        - prolabore
        - despesas_administrativas
        - despesas_comerciais
        - despesas_ti
        - despesas_viagem
        - despesas_juridicas
        - despesas_financeiras
        - simples_nacional
        - irpj_csll
        - capex
        - emprestimos_entrada
        - amortizacao_dividas
        - transferencia_interna
        - depreciacao
        - outras_despesas
        - nao_classificado
      description: |
        23 categorias DRE padrão Aicfo.
        `nao_classificado` indica confiança insuficiente — requer revisão humana.

    CorrectionSource:
      type: string
      enum:
        - client
        - rafael
      description: Quem originou a correção. Frontend deve sempre enviar `client`.

    # ── Lançamento pendente de revisão ────────────────────────────────────────
    ReviewEntry:
      type: object
      required:
        - id
        - date
        - description
        - amountCents
        - direction
        - predictedCategory
        - classificationConfidence
      properties:
        id:
          type: string
          format: uuid
          example: "ent_01JXYZ123ABC"
        date:
          type: string
          format: date
          description: "Data do lançamento (YYYY-MM-DD)"
          example: "2026-04-15"
        description:
          type: string
          description: "Descrição original do lançamento"
          example: "FORNECEDOR ABC LTDA"
        amountCents:
          type: integer
          description: "Valor em centavos (sempre positivo; usar `direction` para sinal)"
          example: 150000
        direction:
          type: string
          enum: [debit, credit]
          description: "debit = saída de caixa; credit = entrada de caixa"
          example: "debit"
        predictedCategory:
          type: string
          nullable: true
          description: "Categoria sugerida pelo modelo (pode ser null se batch falhou)"
          example: "despesas_administrativas"
        classificationConfidence:
          type: number
          format: float
          minimum: 0
          maximum: 1
          nullable: true
          description: "Score de confiança do modelo. < 0.7 aciona revisão."
          example: 0.54

    # ── Resultado da correção ─────────────────────────────────────────────────
    CorrectionResult:
      type: object
      required: [id, confirmedCategory]
      properties:
        id:
          type: string
          format: uuid
          example: "ent_01JXYZ123ABC"
        confirmedCategory:
          $ref: "#/components/schemas/DreCategory"

    # ── RFC 7807 Problem Details ───────────────────────────────────────────────
    ProblemDetails:
      type: object
      required: [type, title, status, detail, instance]
      properties:
        type:
          type: string
          format: uri
          example: "https://api.example.com/problems/not-found"
        title:
          type: string
          example: "Lançamento não encontrado"
        status:
          type: integer
          example: 404
        detail:
          type: string
          example: "O lançamento ent_01JXYZ123ABC não pertence ao tenant autenticado."
        instance:
          type: string
          format: uri
          example: "/v1/classification/entries/ent_01JXYZ123ABC/correct"
        requestId:
          type: string
          format: uuid
          example: "req_f47ac10b-58cc-4372-a567-0e02b2c3d479"

paths:
  # ── GET /classification/{analysisId}/review ──────────────────────────────
  /classification/{analysisId}/review:
    get:
      operationId: listReviewEntries
      summary: Lista lançamentos de baixa confiança para revisão humana
      description: |
        Retorna todos os lançamentos de uma análise que receberam `classificationConfidence < 0.7`
        ou que o batch de classificação não conseguiu processar. O frontend deve exibir estes itens
        em uma fila de revisão para que o cliente corrija a categoria sugerida.
      tags: [Classification]
      parameters:
        - name: analysisId
          in: path
          required: true
          schema:
            type: string
          description: "ID da análise (ex: retornado pelo módulo ingest/hub)"
          example: "anl_01JXYZ456DEF"
        - name: cursor
          in: query
          required: false
          schema:
            type: string
          description: "Cursor para paginação. Omitir na primeira chamada."
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            default: 50
            minimum: 1
            maximum: 100
          description: "Quantidade de itens por página (padrão 50, máximo 100)"
      responses:
        "200":
          description: Lista paginada de lançamentos pendentes de revisão
          headers:
            X-Request-Id:
              schema:
                type: string
                format: uuid
              description: "UUID da requisição para rastreamento"
          content:
            application/json:
              schema:
                type: object
                required: [data, meta]
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/ReviewEntry"
                  meta:
                    type: object
                    required: [total, cursor, hasMore, requestId]
                    properties:
                      total:
                        type: integer
                        description: "Total de itens pendentes de revisão"
                        example: 12
                      cursor:
                        type: string
                        nullable: true
                        description: "Cursor para a próxima página (null se última página)"
                        example: "ent_01JXYZ999ZZZ"
                      hasMore:
                        type: boolean
                        example: false
                      requestId:
                        type: string
                        format: uuid
                        example: "req_f47ac10b-58cc-4372-a567-0e02b2c3d479"
              examples:
                happy_path:
                  summary: "Análise com 2 itens pendentes"
                  value:
                    data:
                      - id: "ent_01JXYZ123ABC"
                        date: "2026-04-15"
                        description: "FORNECEDOR ABC LTDA"
                        amountCents: 150000
                        direction: "debit"
                        predictedCategory: "despesas_administrativas"
                        classificationConfidence: 0.54
                      - id: "ent_01JXYZ124BCD"
                        date: "2026-04-18"
                        description: "TRF PIX 555"
                        amountCents: 300000
                        direction: "credit"
                        predictedCategory: null
                        classificationConfidence: null
                    meta:
                      total: 2
                      cursor: null
                      hasMore: false
                      requestId: "req_f47ac10b-58cc-4372-a567-0e02b2c3d479"
                empty_list:
                  summary: "Nenhum item pendente (todos classificados com alta confiança)"
                  value:
                    data: []
                    meta:
                      total: 0
                      cursor: null
                      hasMore: false
                      requestId: "req_a1b2c3d4-0000-0000-0000-111111111111"
        "401":
          description: Token ausente ou inválido
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
              example:
                type: "https://api.example.com/problems/unauthorized"
                title: "Não autorizado"
                status: 401
                detail: "Token JWT ausente ou expirado."
                instance: "/v1/classification/anl_01JXYZ456DEF/review"
                requestId: "req_00000000-0000-0000-0000-000000000000"
        "403":
          description: Análise não pertence ao tenant autenticado
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
              example:
                type: "https://api.example.com/problems/forbidden"
                title: "Acesso negado"
                status: 403
                detail: "A análise anl_01JXYZ456DEF não pertence ao seu workspace."
                instance: "/v1/classification/anl_01JXYZ456DEF/review"
                requestId: "req_00000000-0000-0000-0000-000000000000"
        "404":
          description: Análise não encontrada
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
              example:
                type: "https://api.example.com/problems/not-found"
                title: "Análise não encontrada"
                status: 404
                detail: "Nenhuma análise com ID anl_01JXYZ456DEF foi encontrada."
                instance: "/v1/classification/anl_01JXYZ456DEF/review"
                requestId: "req_00000000-0000-0000-0000-000000000000"

  # ── PATCH /classification/entries/{entryId}/correct ──────────────────────
  /classification/entries/{entryId}/correct:
    patch:
      operationId: correctEntryCategory
      summary: Corrige a categoria de um lançamento
      description: |
        Aplica a correção humana de categoria a um lançamento específico.
        O backend persiste `correctedCategory` e `confirmedCategory` no banco e alimenta o
        flywheel de treinamento contínuo do modelo. Após a correção, o item não deve mais
        aparecer na fila de revisão.
      tags: [Classification]
      parameters:
        - name: entryId
          in: path
          required: true
          schema:
            type: string
          description: "ID do lançamento a ser corrigido"
          example: "ent_01JXYZ123ABC"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [category]
              properties:
                category:
                  $ref: "#/components/schemas/DreCategory"
                source:
                  $ref: "#/components/schemas/CorrectionSource"
                  default: client
            examples:
              happy_path:
                summary: "Correção normal pelo cliente"
                value:
                  category: "despesas_ti"
                  source: "client"
              only_required:
                summary: "Apenas campo obrigatório (source assume 'client')"
                value:
                  category: "despesas_pessoal"
      responses:
        "200":
          description: Correção aplicada com sucesso
          headers:
            X-Request-Id:
              schema:
                type: string
                format: uuid
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/CorrectionResult"
                  - type: object
                    required: [requestId]
                    properties:
                      requestId:
                        type: string
                        format: uuid
                        example: "req_f47ac10b-58cc-4372-a567-0e02b2c3d479"
              examples:
                success:
                  value:
                    id: "ent_01JXYZ123ABC"
                    confirmedCategory: "despesas_ti"
                    requestId: "req_f47ac10b-58cc-4372-a567-0e02b2c3d479"
        "400":
          description: Categoria inválida (não pertence à taxonomia)
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
              example:
                type: "https://api.example.com/problems/validation-error"
                title: "Dados inválidos"
                status: 400
                detail: "O valor 'despesas_foo' não é uma categoria DRE válida."
                instance: "/v1/classification/entries/ent_01JXYZ123ABC/correct"
                requestId: "req_00000000-0000-0000-0000-000000000000"
        "401":
          description: Token ausente ou inválido
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "404":
          description: Lançamento não encontrado ou não pertence ao tenant
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
              example:
                type: "https://api.example.com/problems/not-found"
                title: "Lançamento não encontrado"
                status: 404
                detail: "O lançamento ent_01JXYZ123ABC não pertence ao tenant autenticado."
                instance: "/v1/classification/entries/ent_01JXYZ123ABC/correct"
                requestId: "req_00000000-0000-0000-0000-000000000000"
```

---

### 2. Zod schema TypeScript

```ts
import { z } from "zod";

// ── Taxonomia DRE — 23 categorias ─────────────────────────────────────────────
export const DRE_CATEGORIES = [
  "receita_bruta",
  "receita_financeira",
  "outras_receitas",
  "deducoes_receita",
  "cpv_cmv",
  "custo_servicos",
  "despesas_pessoal",
  "prolabore",
  "despesas_administrativas",
  "despesas_comerciais",
  "despesas_ti",
  "despesas_viagem",
  "despesas_juridicas",
  "despesas_financeiras",
  "simples_nacional",
  "irpj_csll",
  "capex",
  "emprestimos_entrada",
  "amortizacao_dividas",
  "transferencia_interna",
  "depreciacao",
  "outras_despesas",
  "nao_classificado",
] as const;

export const DreCategorySchema = z.enum(DRE_CATEGORIES);
export type DreCategory = z.infer<typeof DreCategorySchema>;

export const CorrectionSourceSchema = z.enum(["client", "rafael"]);
export type CorrectionSource = z.infer<typeof CorrectionSourceSchema>;

// ── Lançamento pendente de revisão ────────────────────────────────────────────
export const ReviewEntrySchema = z.object({
  id: z.string(),
  /** Data do lançamento, formato YYYY-MM-DD */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string(),
  /** Valor em centavos, sempre positivo */
  amountCents: z.number().int().nonnegative(),
  /** debit = saída; credit = entrada */
  direction: z.enum(["debit", "credit"]),
  /** null se o batch de classificação falhou totalmente */
  predictedCategory: DreCategorySchema.nullable(),
  /** 0–1; null se batch falhou; < 0.7 aciona revisão */
  classificationConfidence: z.number().min(0).max(1).nullable(),
});
export type ReviewEntry = z.infer<typeof ReviewEntrySchema>;

// ── Meta de paginação ─────────────────────────────────────────────────────────
export const PaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
  requestId: z.string().uuid(),
});
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

// ── Resposta GET /classification/{analysisId}/review ─────────────────────────
export const ListReviewEntriesResponseSchema = z.object({
  data: z.array(ReviewEntrySchema),
  meta: PaginationMetaSchema,
});
export type ListReviewEntriesResponse = z.infer<typeof ListReviewEntriesResponseSchema>;

// ── Corpo PATCH /classification/entries/{entryId}/correct ─────────────────────
export const CorrectEntryBodySchema = z.object({
  category: DreCategorySchema,
  source: CorrectionSourceSchema.default("client"),
});
export type CorrectEntryBody = z.infer<typeof CorrectEntryBodySchema>;

// ── Resposta PATCH /classification/entries/{entryId}/correct ──────────────────
export const CorrectEntryResponseSchema = z.object({
  id: z.string(),
  confirmedCategory: DreCategorySchema,
  requestId: z.string().uuid(),
});
export type CorrectEntryResponse = z.infer<typeof CorrectEntryResponseSchema>;

// ── RFC 7807 Problem Details ──────────────────────────────────────────────────
export const ProblemDetailsSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  requestId: z.string().uuid().optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

// ── Query params GET /review ──────────────────────────────────────────────────
export const ListReviewQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListReviewQuery = z.infer<typeof ListReviewQuerySchema>;

// ── Helpers de UI ─────────────────────────────────────────────────────────────

/**
 * Retorna true se o lançamento precisa de revisão obrigatória pelo usuário.
 * Confiança null (batch falhou) também dispara revisão.
 */
export function needsHumanReview(entry: ReviewEntry): boolean {
  return (
    entry.predictedCategory === "nao_classificado" ||
    entry.classificationConfidence === null ||
    (entry.classificationConfidence !== null && entry.classificationConfidence < 0.7)
  );
}

/**
 * Formata valor em centavos para exibição em reais (BRL).
 * Usar direction para aplicar sinal visual — o backend sempre envia amountCents positivo.
 */
export function formatAmountBrl(amountCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);
}

/**
 * Rótulos legíveis em português para cada categoria DRE.
 * Mapeamento 1:1 com a taxonomia do backend.
 */
export const DRE_CATEGORY_LABELS: Record<DreCategory, string> = {
  receita_bruta:              "Receita Bruta de Vendas e Serviços",
  receita_financeira:         "Receitas Financeiras",
  outras_receitas:            "Outras Receitas Operacionais",
  deducoes_receita:           "Deduções da Receita",
  cpv_cmv:                    "Custo dos Produtos / Mercadorias Vendidas",
  custo_servicos:             "Custo dos Serviços Prestados",
  despesas_pessoal:           "Despesas com Pessoal",
  prolabore:                  "Pró-labore e Retirada de Sócios",
  despesas_administrativas:   "Despesas Administrativas",
  despesas_comerciais:        "Despesas Comerciais e Marketing",
  despesas_ti:                "Despesas com TI e Tecnologia",
  despesas_viagem:            "Despesas de Viagem e Representação",
  despesas_juridicas:         "Despesas Jurídicas e Contábeis",
  despesas_financeiras:       "Despesas Financeiras",
  simples_nacional:           "Simples Nacional (DAS)",
  irpj_csll:                  "IRPJ e CSLL",
  capex:                      "Investimentos / CAPEX",
  emprestimos_entrada:        "Entrada de Empréstimos e Financiamentos",
  amortizacao_dividas:        "Pagamento de Principal de Empréstimos",
  transferencia_interna:      "Transferência Interna entre Contas",
  depreciacao:                "Depreciação e Amortização",
  outras_despesas:            "Outras Despesas Operacionais",
  nao_classificado:           "Não Classificado — revisão necessária",
};
```

---

### 3. Handoff doc

## Módulo Classification — Handoff para Frontend

O módulo **Classification** é a etapa do pipeline em que cada lançamento financeiro importado recebe uma **categoria DRE** (ex: "Despesas com Pessoal", "Receita Bruta"). O modelo de IA classifica em batches; itens com confiança abaixo de 70% — ou que o batch não conseguiu processar — ficam em fila de revisão humana. O frontend precisa exibir essa fila e permitir que o cliente corrija a categoria sugerida. Toda correção alimenta o flywheel de aprendizado contínuo do modelo.

---

#### Tabela de endpoints

| Método | Path | Propósito |
|--------|------|-----------|
| GET | `/v1/classification/{analysisId}/review` | Lista lançamentos pendentes de revisão |
| PATCH | `/v1/classification/entries/{entryId}/correct` | Aplica correção de categoria a um lançamento |

---

#### GET `/v1/classification/{analysisId}/review`

**Propósito:** Busca todos os lançamentos da análise que precisam de revisão humana. Deve ser chamado quando o usuário abre a tela de revisão de categorias, ou quando o hub indica que a análise tem itens pendentes.

**Path param:**
- `analysisId` — ID da análise (string), recebido do módulo `hub` ou `ingest`

**Query params:**
| Param | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `cursor` | string | — | Omitir na primeira chamada; usar valor de `meta.cursor` para páginas seguintes |
| `limit` | integer | 50 | Itens por página (1–100) |

**Request shape — exemplo feliz (primeira página):**
```
GET /v1/classification/anl_01JXYZ456DEF/review
Authorization: Bearer <jwt>
```

**Request shape — edge case (paginação):**
```
GET /v1/classification/anl_01JXYZ456DEF/review?cursor=ent_01JXYZ999ZZZ&limit=20
Authorization: Bearer <jwt>
```

**Response 200 — exemplo feliz:**
```json
{
  "data": [
    {
      "id": "ent_01JXYZ123ABC",
      "date": "2026-04-15",
      "description": "FORNECEDOR ABC LTDA",
      "amountCents": 150000,
      "direction": "debit",
      "predictedCategory": "despesas_administrativas",
      "classificationConfidence": 0.54
    },
    {
      "id": "ent_01JXYZ124BCD",
      "date": "2026-04-18",
      "description": "TRF PIX 555",
      "amountCents": 300000,
      "direction": "credit",
      "predictedCategory": null,
      "classificationConfidence": null
    }
  ],
  "meta": {
    "total": 2,
    "cursor": null,
    "hasMore": false,
    "requestId": "req_f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
}
```

**Response 200 — edge case (lista vazia; todos os lançamentos foram classificados com alta confiança):**
```json
{
  "data": [],
  "meta": {
    "total": 0,
    "cursor": null,
    "hasMore": false,
    "requestId": "req_a1b2c3d4-0000-0000-0000-111111111111"
  }
}
```

**Códigos de erro:**

| Status | `type` | Causa | Ação esperada no frontend |
|--------|--------|-------|--------------------------|
| 401 | `problems/unauthorized` | JWT ausente, expirado ou inválido | Redirecionar para login; limpar token local |
| 403 | `problems/forbidden` | `analysisId` não pertence ao tenant do JWT | Exibir mensagem de acesso negado; não tentar novamente com o mesmo ID |
| 404 | `problems/not-found` | `analysisId` inexistente | Exibir erro e voltar para a listagem de análises |

---

#### PATCH `/v1/classification/entries/{entryId}/correct`

**Propósito:** Permite que o cliente corrija a categoria de um lançamento específico. Deve ser chamado ao confirmar a seleção na interface de revisão. Após 200, o item corrigido deve ser removido da fila de revisão no estado local.

**Path param:**
- `entryId` — ID do lançamento (string), obtido de `ReviewEntry.id`

**Body — exemplo feliz:**
```json
{
  "category": "despesas_ti",
  "source": "client"
}
```

**Body — edge case (campo `source` omitido; backend assume `client`):**
```json
{
  "category": "despesas_pessoal"
}
```

**Response 200 — sucesso:**
```json
{
  "id": "ent_01JXYZ123ABC",
  "confirmedCategory": "despesas_ti",
  "requestId": "req_f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Response 4xx — exemplos:**

400 — categoria inválida:
```json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Dados inválidos",
  "status": 400,
  "detail": "O valor 'despesas_foo' não é uma categoria DRE válida.",
  "instance": "/v1/classification/entries/ent_01JXYZ123ABC/correct",
  "requestId": "req_00000000-0000-0000-0000-000000000000"
}
```

404 — lançamento não encontrado:
```json
{
  "type": "https://api.example.com/problems/not-found",
  "title": "Lançamento não encontrado",
  "status": 404,
  "detail": "O lançamento ent_01JXYZ123ABC não pertence ao tenant autenticado.",
  "instance": "/v1/classification/entries/ent_01JXYZ123ABC/correct",
  "requestId": "req_00000000-0000-0000-0000-000000000000"
}
```

**Códigos de erro:**

| Status | `type` | Causa | Ação esperada no frontend |
|--------|--------|-------|--------------------------|
| 400 | `problems/validation-error` | Categoria enviada não existe na taxonomia DRE | Impedir envio se o select estiver populado com os valores do contrato; exibir toast de erro técnico |
| 401 | `problems/unauthorized` | JWT expirado | Redirecionar para login |
| 404 | `problems/not-found` | `entryId` inválido ou não pertence ao tenant | Remover item do estado local (pode ter sido corrigido por outra aba); exibir toast |

---

#### Estados de UI sugeridos

**Tela de fila de revisão (`GET /review`)**

| Estado | Condição | Comportamento sugerido |
|--------|----------|----------------------|
| **loading** | Request em voo | Skeleton de linha para cada item esperado (ou spinner centralizado na primeira carga) |
| **empty** | `data.length === 0` | Ilustração + mensagem "Todos os lançamentos foram classificados automaticamente" + CTA para avançar ao DRE |
| **error 401** | HTTP 401 | Toast de sessão expirada + redirect para login |
| **error 403** | HTTP 403 | Mensagem de acesso negado embutida na página |
| **error 404** | HTTP 404 | Banner de análise não encontrada + botão "Voltar" |
| **error 5xx** | HTTP 5xx / network | Toast com mensagem genérica + botão "Tentar novamente" com backoff |
| **success** | `data.length > 0` | Lista de lançamentos com select de categoria e botão "Confirmar" por item |
| **paginação** | `meta.hasMore === true` | Botão "Carregar mais" ou scroll infinito usando `meta.cursor` |

**Ação de correção (`PATCH /correct`)**

| Estado | Condição | Comportamento sugerido |
|--------|----------|----------------------|
| **loading** | PATCH em voo | Desabilitar botão "Confirmar" e mostrar spinner inline no item |
| **success** | HTTP 200 | Remover item da lista local com animação de fade-out; decrementar contador de pendentes |
| **error 400** | HTTP 400 | Nunca deve ocorrer se o select usar os valores do contrato; se ocorrer, toast de erro técnico |
| **error 404** | HTTP 404 | Remover item da lista local (conflito de estado); toast "Item já processado" |
| **error 5xx** | HTTP 5xx | Toast com erro + item permanece na lista para nova tentativa |

---

#### Convenções de paginação, filtros e auth

**Paginação cursor-based:**
- Primeira chamada: omitir `cursor`
- Páginas seguintes: passar o valor de `meta.cursor` da resposta anterior em `?cursor=...`
- `meta.hasMore === false` indica última página
- `meta.cursor === null` também indica última página (mesmo que `hasMore` seja false)
- O `limit` pode ser ajustado por chamada, mas o cursor gerado pelo backend é baseado no `limit` original — não misture limites diferentes durante uma sessão de paginação

**Auth:**
- Sempre enviar `Authorization: Bearer <jwt>` em todas as chamadas
- `tenantId` nunca vai no body, path ou query — é extraído pelo backend do JWT claim `tenant_id`
- JWT expirado retorna 401; o frontend deve interceptar 401 globalmente e redirecionar para login

**Nenhum endpoint de escrita aceita `tenantId` explícito.** O backend aplica isolamento automático por tenant em todas as queries.

---

#### Edge cases que o frontend precisa tratar

1. **`predictedCategory === null` e `classificationConfidence === null`**: o batch de classificação falhou para este lançamento. Exibir label "Não classificado" como placeholder no select, com a categoria `nao_classificado` pré-selecionada. O cliente deve escolher manualmente.

2. **`predictedCategory === "nao_classificado"` com `classificationConfidence` presente**: o modelo tinha confiança mas nenhuma categoria conhecida se encaixou. Também exigir seleção manual.

3. **Correcting the same entry twice (duas abas)**: se um PATCH retornar 404, o item foi corrigido em outra sessão. Remover do estado local sem exibir erro destrutivo — apenas o toast "Item já processado".

4. **Lista vazia no primeiro carregamento**: não deve ser tratado como erro. Exibir o estado "empty" e oferecer CTA para continuar o fluxo (ex: "Ver DRE").

5. **`amountCents` sempre positivo**: a direção financeira (entrada vs. saída) vem exclusivamente em `direction: "debit" | "credit"`. Não interpretar `amountCents` como negativo mesmo que o lançamento seja uma saída.

6. **Valores altos**: `amountCents` pode representar valores muito grandes (> R$ 1 milhão). Usar `Intl.NumberFormat` com locale `pt-BR` e currency `BRL` para formatação; nunca usar `toFixed(2)` diretamente.

7. **`date` é string `YYYY-MM-DD` sem timezone**: ao exibir, formatar como data local. Não converter para `Date` sem cuidado — `new Date("2026-04-15")` é interpretado como UTC e pode exibir o dia anterior dependendo do timezone do browser.

8. **Categoria `nao_classificado` no select de correção**: deve aparecer na lista de opções (o cliente pode explicitamente marcar como "não se aplica"), mas deve ser a última opção e preferencialmente ter visual diferenciado (ex: cor amarela ou ícone de alerta) para indicar que é um fallback.

9. **Tamanho da taxonomia**: são 23 categorias. Usar um componente de select com busca (searchable dropdown / combobox) para facilitar a navegação.

10. **Progresso da revisão**: o campo `meta.total` reflete o total de pendentes no momento da chamada. Se o usuário corrigir itens e depois recarregar, o total diminui. O frontend pode calcular "X de Y revisados" comparando o total inicial com o atual — mas deve re-buscar `meta.total` ao reload.
