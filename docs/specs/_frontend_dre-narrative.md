---
module_key: "dre-narrative"
module_name: "DRE Narrative — Narrador da DRE"
contract_version: "1.0.0"
generated_at: "2026-05-12"
generated_by: "Contract Agent (Claude Sonnet 4.6)"
backend_commit: "cab4d85"
---

# Contrato Frontend — dre-narrative

> Três endpoints que expõem a DRE Facilitada e os cards de narrativa gerados por IA para uma análise mensal. O frontend lê a DRE e os 3 cards, e em modo ASSISTED permite que o cliente aprove ou comente cada card individualmente.

---

### 1. OpenAPI 3.1 spec

```yaml
openapi: "3.1.0"
info:
  title: "Aicfo API — dre-narrative"
  version: "1.0.0"
  description: |
    Endpoints do módulo dre-narrative.
    Autenticação via Bearer JWT; tenantId resolvido automaticamente do claim `tenant_id` do token — nunca passe tenantId em path, query ou body.

servers:
  - url: "https://api.aicfo.com.br/v1"
    description: "Produção"
  - url: "http://localhost:3000/v1"
    description: "Desenvolvimento local"

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    # ─── Evidência numérica de um card ───────────────────────────────────────
    Evidence:
      type: object
      required: [metric, value, unit]
      properties:
        metric:
          type: string
          description: "Nome da métrica (ex: 'Margem Bruta', 'Despesas Pessoal')"
          example: "Margem Bruta"
        value:
          type: number
          description: "Valor numérico da métrica (centavos quando monetário; % quando percentual)"
          example: 2350000
        unit:
          type: string
          description: "Unidade da métrica. Use 'BRL_CENTS' para monetário, '%' para percentual, ou string livre"
          example: "BRL_CENTS"

    # ─── Card de narrativa ────────────────────────────────────────────────────
    NarrativeCard:
      type: object
      required: [id, cardType, title, body, evidence, clientApproved, clientComment]
      properties:
        id:
          type: string
          format: uuid
          description: "UUID v4 do card"
          example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        cardType:
          type: string
          enum: [critical_gap, attention, healthy]
          description: |
            Categoria do card:
            - `critical_gap` — Gargalo crítico (vermelho)
            - `attention`    — Atenção (amarelo)
            - `healthy`      — Saudável (verde)
          example: "critical_gap"
        title:
          type: string
          description: "Título curto do card gerado pela IA"
          example: "Despesas de Pessoal consumindo 62% da Receita Líquida"
        body:
          type: string
          description: "Corpo do card — narrativa explicativa gerada pela IA (1–3 parágrafos)"
          example: "As despesas com folha de pagamento e pró-labore representaram R$ 124.000 em abril..."
        evidence:
          type: array
          description: "Lista de evidências numéricas que embasam o card (1–5 itens)"
          items:
            $ref: "#/components/schemas/Evidence"
        clientApproved:
          type: boolean
          nullable: true
          description: "null = sem feedback; true = aprovado; false = rejeitado. Só relevante em modo ASSISTED."
          example: null
        clientComment:
          type: string
          nullable: true
          description: "Comentário livre do cliente (máx. 500 chars). null se não preenchido."
          example: null

    # ─── DRE Facilitada ──────────────────────────────────────────────────────
    DreLines:
      type: object
      description: "Todos os valores monetários em centavos (integer). Percentuais como number com 2 casas decimais."
      required:
        - receitaBruta
        - deducoes
        - receitaLiquida
        - custosDiretos
        - lucroBruto
        - margemBruta
        - despesasPessoal
        - prolabore
        - despesasAdm
        - despesasComerciais
        - despesasTi
        - despesasViagem
        - despesasJuridicas
        - despesasFinanceiras
        - outrasDespesas
        - totalDespesasOp
        - ebitda
        - margemEbitda
        - depreciacao
        - ebit
        - receitaFinanceira
        - resultadoFinanceiro
        - resultadoAntesImpostos
        - impostos
        - lucroLiquido
        - margemLiquida
        - emprestimosEntrada
        - amortizacaoDividas
        - capex
        - transferenciaInterna
        - naoClassificado
      properties:
        # Receitas
        receitaBruta:           { type: integer, example: 20000000 }
        deducoes:               { type: integer, example: 1000000 }
        receitaLiquida:         { type: integer, example: 19000000 }
        # Custos
        custosDiretos:          { type: integer, example: 6000000 }
        lucroBruto:             { type: integer, example: 13000000 }
        margemBruta:            { type: number,  example: 68.42 }
        # Despesas operacionais
        despesasPessoal:        { type: integer, example: 5000000 }
        prolabore:              { type: integer, example: 1500000 }
        despesasAdm:            { type: integer, example: 800000 }
        despesasComerciais:     { type: integer, example: 600000 }
        despesasTi:             { type: integer, example: 300000 }
        despesasViagem:         { type: integer, example: 150000 }
        despesasJuridicas:      { type: integer, example: 200000 }
        despesasFinanceiras:    { type: integer, example: 250000 }
        outrasDespesas:         { type: integer, example: 100000 }
        totalDespesasOp:        { type: integer, example: 8900000 }
        # Resultados
        ebitda:                 { type: integer, example: 4100000 }
        margemEbitda:           { type: number,  example: 21.58 }
        depreciacao:            { type: integer, example: 200000 }
        ebit:                   { type: integer, example: 3900000 }
        receitaFinanceira:      { type: integer, example: 50000 }
        resultadoFinanceiro:    { type: integer, example: -200000 }
        resultadoAntesImpostos: { type: integer, example: 3700000 }
        impostos:               { type: integer, example: 444000 }
        lucroLiquido:           { type: integer, example: 3256000 }
        margemLiquida:          { type: number,  example: 17.14 }
        # Não-P&L
        emprestimosEntrada:     { type: integer, example: 0 }
        amortizacaoDividas:     { type: integer, example: 0 }
        capex:                  { type: integer, example: 0 }
        transferenciaInterna:   { type: integer, example: 0 }
        naoClassificado:        { type: integer, example: 15000 }

    # ─── Response da DRE ─────────────────────────────────────────────────────
    DreResponse:
      type: object
      required: [requestId, dreJson, referenceMonth, status]
      properties:
        requestId:
          type: string
          format: uuid
          description: "UUID v4 gerado por request — use para correlacionar logs/suporte"
          example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
        dreJson:
          oneOf:
            - $ref: "#/components/schemas/DreLines"
            - type: "null"
          description: "null se a análise ainda não foi processada (status pending ou generating)"
        referenceMonth:
          type: string
          pattern: "^\\d{4}-\\d{2}$"
          description: "Mês de referência no formato YYYY-MM"
          example: "2026-04"
        status:
          type: string
          enum: [pending, generating, ready, delivered, approved]
          description: "Status atual da análise mensal"
          example: "delivered"

    # ─── Response dos cards ───────────────────────────────────────────────────
    NarrativeCardsResponse:
      type: object
      required: [requestId, cards]
      properties:
        requestId:
          type: string
          format: uuid
          example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
        cards:
          type: array
          description: "Exatamente 3 cards ordenados por createdAt ASC quando geração concluída; array vazio se análise ainda não gerou narrativa."
          minItems: 0
          maxItems: 3
          items:
            $ref: "#/components/schemas/NarrativeCard"

    # ─── Body do feedback ────────────────────────────────────────────────────
    FeedbackBody:
      type: object
      required: [approved]
      properties:
        approved:
          type: boolean
          description: "true = cliente aprova o card; false = cliente rejeita"
          example: true
        comment:
          type: string
          maxLength: 500
          description: "Comentário opcional (máx. 500 caracteres)"
          example: "Concordo com a análise, mas as despesas de viagem incluem uma conferência pontual."

    # ─── Response do feedback ────────────────────────────────────────────────
    FeedbackResponse:
      type: object
      required: [requestId, id]
      properties:
        requestId:
          type: string
          format: uuid
          example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
        id:
          type: string
          format: uuid
          description: "UUID do card atualizado"
          example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

    # ─── RFC 7807 Problem Details ────────────────────────────────────────────
    ProblemDetails:
      type: object
      required: [type, title, status, detail, instance]
      properties:
        type:
          type: string
          format: uri
          example: "https://api.aicfo.com.br/errors/not-found"
        title:
          type: string
          example: "Recurso não encontrado"
        status:
          type: integer
          example: 404
        detail:
          type: string
          example: "A análise solicitada não existe ou não pertence ao tenant autenticado."
        instance:
          type: string
          format: uri
          example: "/v1/analysis/abc-123/dre"

security:
  - bearerAuth: []

paths:
  # ═══════════════════════════════════════════════════════════════════════════
  /analysis/{analysisId}/dre:
    get:
      operationId: "getDre"
      summary: "Retorna a DRE Facilitada de uma análise mensal"
      description: |
        Retorna a DRE agregada deterministicamente a partir dos lançamentos classificados.
        `dreJson` é `null` enquanto o pipeline não concluiu a etapa de agregação (status `pending` ou `generating`).
      tags: [dre-narrative]
      parameters:
        - name: analysisId
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: "UUID da análise mensal"
          example: "550e8400-e29b-41d4-a716-446655440000"
      responses:
        "200":
          description: "DRE retornada com sucesso"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/DreResponse"
        "401":
          description: "Token ausente ou inválido"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "403":
          description: "Token válido mas sem acesso a este recurso (tenant mismatch)"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "404":
          description: "Análise não encontrada"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "500":
          description: "Erro interno"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"

  # ═══════════════════════════════════════════════════════════════════════════
  /analysis/{analysisId}/narrative:
    get:
      operationId: "getNarrativeCards"
      summary: "Retorna os 3 cards de narrativa da análise"
      description: |
        Retorna os cards de leitura gerados pela IA (critical_gap, attention, healthy).
        Array vazio se a geração ainda não foi concluída. Array com 3 itens quando `status` é `ready`, `delivered` ou `approved`.
        Em modo ASSISTED, cada card traz os campos `clientApproved` e `clientComment` que o frontend deve exibir.
      tags: [dre-narrative]
      parameters:
        - name: analysisId
          in: path
          required: true
          schema:
            type: string
            format: uuid
          example: "550e8400-e29b-41d4-a716-446655440000"
      responses:
        "200":
          description: "Cards retornados com sucesso"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/NarrativeCardsResponse"
        "401":
          description: "Token ausente ou inválido"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "403":
          description: "Token válido mas sem acesso a este recurso"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "404":
          description: "Análise não encontrada"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "500":
          description: "Erro interno"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"

  # ═══════════════════════════════════════════════════════════════════════════
  /analysis/{analysisId}/narrative/{cardId}/feedback:
    patch:
      operationId: "submitCardFeedback"
      summary: "Registra aprovação ou comentário do cliente em um card (modo ASSISTED)"
      description: |
        Disponível apenas em modo ASSISTED. O cliente pode aprovar ou rejeitar cada card individualmente e deixar um comentário.
        Pode ser chamado múltiplas vezes — cada chamada sobrescreve o feedback anterior do card.
        Em modo AUTONOMOUS ou SHADOW, a chamada retorna 200 mas o campo pode ser ignorado no fluxo de entrega.
      tags: [dre-narrative]
      parameters:
        - name: analysisId
          in: path
          required: true
          schema:
            type: string
            format: uuid
          example: "550e8400-e29b-41d4-a716-446655440000"
        - name: cardId
          in: path
          required: true
          schema:
            type: string
            format: uuid
          example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/FeedbackBody"
      responses:
        "200":
          description: "Feedback registrado"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/FeedbackResponse"
        "400":
          description: "Payload inválido (ex: comment acima de 500 chars)"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "401":
          description: "Token ausente ou inválido"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "403":
          description: "Token válido mas sem acesso a este recurso"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "404":
          description: "Card ou análise não encontrados"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
        "500":
          description: "Erro interno"
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ProblemDetails"
```

---

### 2. Zod schema TypeScript

```ts
import { z } from "zod";

// ─── Blocos base ─────────────────────────────────────────────────────────────

export const EvidenceSchema = z.object({
  metric: z.string(),
  value:  z.number(),
  unit:   z.string(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const CardTypeSchema = z.enum(["critical_gap", "attention", "healthy"]);
export type CardType = z.infer<typeof CardTypeSchema>;

export const NarrativeCardSchema = z.object({
  id:             z.string().uuid(),
  cardType:       CardTypeSchema,
  title:          z.string(),
  body:           z.string(),
  evidence:       z.array(EvidenceSchema),
  clientApproved: z.boolean().nullable(),
  clientComment:  z.string().nullable(),
});
export type NarrativeCard = z.infer<typeof NarrativeCardSchema>;

// ─── DRE Lines ────────────────────────────────────────────────────────────────
// Todos os campos monetários: integer (centavos).
// Campos de margem: number (%, 2 casas decimais).

export const DreLinesSchema = z.object({
  // Receitas
  receitaBruta:           z.number().int(),
  deducoes:               z.number().int(),
  receitaLiquida:         z.number().int(),
  // Custos
  custosDiretos:          z.number().int(),
  lucroBruto:             z.number().int(),
  margemBruta:            z.number(),          // %
  // Despesas operacionais
  despesasPessoal:        z.number().int(),
  prolabore:              z.number().int(),
  despesasAdm:            z.number().int(),
  despesasComerciais:     z.number().int(),
  despesasTi:             z.number().int(),
  despesasViagem:         z.number().int(),
  despesasJuridicas:      z.number().int(),
  despesasFinanceiras:    z.number().int(),
  outrasDespesas:         z.number().int(),
  totalDespesasOp:        z.number().int(),
  // Resultados
  ebitda:                 z.number().int(),
  margemEbitda:           z.number(),          // %
  depreciacao:            z.number().int(),
  ebit:                   z.number().int(),
  receitaFinanceira:      z.number().int(),
  resultadoFinanceiro:    z.number().int(),
  resultadoAntesImpostos: z.number().int(),
  impostos:               z.number().int(),
  lucroLiquido:           z.number().int(),
  margemLiquida:          z.number(),          // %
  // Não-P&L
  emprestimosEntrada:     z.number().int(),
  amortizacaoDividas:     z.number().int(),
  capex:                  z.number().int(),
  transferenciaInterna:   z.number().int(),
  naoClassificado:        z.number().int(),
});
export type DreLines = z.infer<typeof DreLinesSchema>;

// ─── Responses ────────────────────────────────────────────────────────────────

export const AnalysisStatusSchema = z.enum([
  "pending",
  "generating",
  "ready",
  "delivered",
  "approved",
]);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;

export const DreResponseSchema = z.object({
  requestId:      z.string().uuid(),
  dreJson:        DreLinesSchema.nullable(),
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
  status:         AnalysisStatusSchema,
});
export type DreResponse = z.infer<typeof DreResponseSchema>;

export const NarrativeCardsResponseSchema = z.object({
  requestId: z.string().uuid(),
  cards:     z.array(NarrativeCardSchema).max(3),
});
export type NarrativeCardsResponse = z.infer<typeof NarrativeCardsResponseSchema>;

export const FeedbackResponseSchema = z.object({
  requestId: z.string().uuid(),
  id:        z.string().uuid(),
});
export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;

// ─── Request bodies ──────────────────────────────────────────────────────────

export const FeedbackBodySchema = z.object({
  approved: z.boolean(),
  comment:  z.string().max(500).optional(),
});
export type FeedbackBody = z.infer<typeof FeedbackBodySchema>;

// ─── RFC 7807 Problem Details ─────────────────────────────────────────────────

export const ProblemDetailsSchema = z.object({
  type:     z.string().url(),
  title:    z.string(),
  status:   z.number().int(),
  detail:   z.string(),
  instance: z.string(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

// ─── Helpers de UI ───────────────────────────────────────────────────────────

/** Mapeamento canônico cardType → cor de badge/borda */
export const CARD_COLOR: Record<CardType, string> = {
  critical_gap: "red",
  attention:    "yellow",
  healthy:      "green",
} as const;

/** Mapeamento cardType → label PT-BR */
export const CARD_LABEL: Record<CardType, string> = {
  critical_gap: "Gargalo Crítico",
  attention:    "Atenção",
  healthy:      "Saudável",
} as const;

/** Status que indicam que a narrativa ainda não está disponível */
export function isDreLoading(status: AnalysisStatus): boolean {
  return status === "pending" || status === "generating";
}

/** Formata centavos → string BRL para exibição (ex: 2350000 → "R$ 23.500,00") */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style:    "currency",
    currency: "BRL",
  }).format(cents / 100);
}
```

---

### 3. Handoff doc

## Módulo dre-narrative — Handoff para o Dev Frontend

O módulo `dre-narrative` entrega dois artefatos centrais da análise financeira mensal do Aicfo: a **DRE Facilitada** (Demonstrativo de Resultado do Exercício estruturado, com todas as linhas do Receita Bruta ao Lucro Líquido) e os **3 cards de narrativa** gerados por IA (Gargalo Crítico, Atenção, Saudável). Em modo ASSISTED, o cliente pode aprovar ou comentar cada card antes de fechar o mês.

---

### Tabela de endpoints

| Método | Path | Propósito |
|--------|------|-----------|
| `GET`  | `/v1/analysis/{analysisId}/dre` | Lê a DRE Facilitada de uma análise |
| `GET`  | `/v1/analysis/{analysisId}/narrative` | Lê os 3 cards de narrativa IA |
| `PATCH`| `/v1/analysis/{analysisId}/narrative/{cardId}/feedback` | Registra aprovação/comentário de um card (modo ASSISTED) |

---

### Endpoint 1 — GET `/v1/analysis/{analysisId}/dre`

#### Request

Sem body. `analysisId` é o UUID da `MonthlyAnalysis` (obtido no hub/listagem de análises).

**Exemplo feliz (análise entregue):**
```http
GET /v1/analysis/550e8400-e29b-41d4-a716-446655440000/dre
Authorization: Bearer eyJhbGci...
```

**Exemplo edge (análise ainda processando):**
```http
GET /v1/analysis/550e8400-e29b-41d4-a716-446655440000/dre
Authorization: Bearer eyJhbGci...
```
Neste caso o backend retorna 200 com `dreJson: null` e `status: "generating"`.

#### Response 200

```json
{
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "referenceMonth": "2026-04",
  "status": "delivered",
  "dreJson": {
    "receitaBruta": 20000000,
    "deducoes": 1000000,
    "receitaLiquida": 19000000,
    "custosDiretos": 6000000,
    "lucroBruto": 13000000,
    "margemBruta": 68.42,
    "despesasPessoal": 5000000,
    "prolabore": 1500000,
    "despesasAdm": 800000,
    "despesasComerciais": 600000,
    "despesasTi": 300000,
    "despesasViagem": 150000,
    "despesasJuridicas": 200000,
    "despesasFinanceiras": 250000,
    "outrasDespesas": 100000,
    "totalDespesasOp": 8900000,
    "ebitda": 4100000,
    "margemEbitda": 21.58,
    "depreciacao": 200000,
    "ebit": 3900000,
    "receitaFinanceira": 50000,
    "resultadoFinanceiro": -200000,
    "resultadoAntesImpostos": 3700000,
    "impostos": 444000,
    "lucroLiquido": 3256000,
    "margemLiquida": 17.14,
    "emprestimosEntrada": 0,
    "amortizacaoDividas": 0,
    "capex": 0,
    "transferenciaInterna": 0,
    "naoClassificado": 15000
  }
}
```

**Response 200 (análise gerando — dreJson null):**
```json
{
  "requestId": "c2a8b1d3-0011-4abc-8def-9900aabbccdd",
  "referenceMonth": "2026-04",
  "status": "generating",
  "dreJson": null
}
```

#### Response 4xx

```json
{
  "type": "https://api.aicfo.com.br/errors/not-found",
  "title": "Recurso não encontrado",
  "status": 404,
  "detail": "A análise solicitada não existe ou não pertence ao tenant autenticado.",
  "instance": "/v1/analysis/550e8400-e29b-41d4-a716-446655440000/dre"
}
```

#### Códigos de erro e ação esperada

| Status | Causa | Ação no frontend |
|--------|-------|-----------------|
| 401 | Token expirado ou ausente | Redirecionar para `/login` |
| 403 | analysisId pertence a outro tenant | Exibir erro genérico "Acesso negado" — não revelar detalhes |
| 404 | analysisId inválido ou excluído | Exibir estado "análise não encontrada" com link para voltar ao hub |
| 500 | Erro interno do servidor | Exibir banner de erro com `requestId` para suporte |

---

### Endpoint 2 — GET `/v1/analysis/{analysisId}/narrative`

#### Request

Sem body.

**Exemplo feliz (3 cards gerados):**
```http
GET /v1/analysis/550e8400-e29b-41d4-a716-446655440000/narrative
Authorization: Bearer eyJhbGci...
```

**Exemplo edge (análise ainda não gerou narrativa):**
Mesma chamada — backend retorna 200 com `cards: []`.

#### Response 200 (análise com narrativa gerada)

```json
{
  "requestId": "a9f3e211-cc44-4d5b-8899-001122334455",
  "cards": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "cardType": "critical_gap",
      "title": "Despesas de Pessoal consumindo 62% da Receita Líquida",
      "body": "Em abril/2026, a soma de folha de pagamento (R$ 50.000) e pró-labore (R$ 15.000) representou 62% da receita líquida — 18 pp acima do benchmark do segmento (44%). Esse nível compromete diretamente a margem EBITDA e limita a capacidade de reinvestimento.",
      "evidence": [
        { "metric": "Despesas Pessoal + Pró-labore", "value": 6500000, "unit": "BRL_CENTS" },
        { "metric": "% sobre Receita Líquida",        "value": 62.0,    "unit": "%" },
        { "metric": "Benchmark segmento",             "value": 44.0,    "unit": "%" }
      ],
      "clientApproved": null,
      "clientComment": null
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f01234567891",
      "cardType": "attention",
      "title": "Despesas financeiras cresceram 35% vs. março",
      "body": "As despesas financeiras subiram de R$ 1.852 para R$ 2.500 em relação ao mês anterior, reflexo de juros sobre cheque especial. O valor ainda é controlável mas, sem ação, a tendência é de piora progressiva.",
      "evidence": [
        { "metric": "Despesas Financeiras abr",  "value": 250000, "unit": "BRL_CENTS" },
        { "metric": "Despesas Financeiras mar",  "value": 185200, "unit": "BRL_CENTS" },
        { "metric": "Variação",                  "value": 35.0,   "unit": "%" }
      ],
      "clientApproved": null,
      "clientComment": null
    },
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-012345678912",
      "cardType": "healthy",
      "title": "Margem bruta de 68% acima da média do setor",
      "body": "A margem bruta de 68,42% supera o benchmark de serviços B2B (55–60%), indicando boa precificação e controle de CPV. Manter esse indicador exige atenção ao custo de entrega conforme a empresa escala.",
      "evidence": [
        { "metric": "Margem Bruta",        "value": 68.42, "unit": "%" },
        { "metric": "Benchmark serviços",  "value": 57.5,  "unit": "%" }
      ],
      "clientApproved": true,
      "clientComment": "Isso reflete nosso investimento em automação."
    }
  ]
}
```

**Response 200 (narrativa ainda não gerada):**
```json
{
  "requestId": "dd113344-5566-7788-99aa-bbccddeeff00",
  "cards": []
}
```

#### Códigos de erro e ação esperada

| Status | Causa | Ação no frontend |
|--------|-------|-----------------|
| 401 | Token expirado ou ausente | Redirecionar para `/login` |
| 403 | Tenant mismatch | Exibir erro genérico "Acesso negado" |
| 404 | Análise não encontrada | Estado vazio com link para hub |
| 500 | Erro interno | Banner de erro com `requestId` |

---

### Endpoint 3 — PATCH `/v1/analysis/{analysisId}/narrative/{cardId}/feedback`

#### Request

**Exemplo feliz (cliente aprova card com comentário):**
```http
PATCH /v1/analysis/550e8400-e29b-41d4-a716-446655440000/narrative/a1b2c3d4-e5f6-7890-abcd-ef1234567890/feedback
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "approved": true,
  "comment": "Concordo com a análise, mas as despesas de viagem incluem uma conferência pontual."
}
```

**Exemplo edge (cliente rejeita sem comentário):**
```http
PATCH /v1/analysis/550e8400-e29b-41d4-a716-446655440000/narrative/a1b2c3d4-e5f6-7890-abcd-ef1234567890/feedback
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "approved": false
}
```

#### Response 200

```json
{
  "requestId": "99aabbcc-ddee-ff00-1122-334455667788",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

#### Response 400 (payload inválido)

```json
{
  "type": "https://api.aicfo.com.br/errors/validation",
  "title": "Payload inválido",
  "status": 400,
  "detail": "O campo 'comment' excede o limite de 500 caracteres.",
  "instance": "/v1/analysis/550e8400.../narrative/a1b2c3d4.../feedback"
}
```

#### Códigos de erro e ação esperada

| Status | Causa | Ação no frontend |
|--------|-------|-----------------|
| 400 | Campo `approved` ausente ou `comment` > 500 chars | Validar no cliente antes de enviar; exibir mensagem inline no campo |
| 401 | Token expirado | Redirecionar para `/login` |
| 403 | Tenant mismatch | Exibir erro genérico |
| 404 | cardId ou analysisId inválidos | Exibir "card não encontrado" |
| 500 | Erro interno | Banner com `requestId` |

---

### Estados de UI sugeridos

#### Tela DRE Facilitada

| Estado | Gatilho | UI sugerida |
|--------|---------|-------------|
| **loading** | Chamada em andamento | Skeleton da tabela DRE (3 seções: Receitas, Despesas, Resultados) |
| **generating** | `status` = `"pending"` ou `"generating"` | Banner informativo "Sua análise está sendo gerada..." com spinner; polling a cada 10s |
| **success** | `dreJson` preenchido | Tabela DRE com 3 grupos; valores em BRL formatados; margens em destaque |
| **empty** | `dreJson: null` e status não-generating | Impossível em operação normal; tratar como erro silencioso e logar |
| **error** | 4xx / 5xx / timeout | Inline error com `requestId` copiável para suporte |

#### Tela Cards de Narrativa

| Estado | Gatilho | UI sugerida |
|--------|---------|-------------|
| **loading** | Chamada em andamento | 3 card skeletons com largura completa |
| **empty** | `cards.length === 0` | Mensagem "Narrativa sendo gerada..." com polling a cada 10s se `analysisStatus` for `generating` |
| **success** | `cards.length === 3` | 3 cards coloridos (vermelho/amarelo/verde) com título, corpo e lista de evidências |
| **error** | 4xx / 5xx | Banner com `requestId` |

#### Feedback por card (modo ASSISTED)

| Estado | Gatilho | UI sugerida |
|--------|---------|-------------|
| **sem feedback** | `clientApproved: null` | Botões "Aprovar" e "Questionar" visíveis |
| **enviando** | PATCH em curso | Botões desabilitados + spinner |
| **aprovado** | `clientApproved: true` | Badge verde "Aprovado"; comentário exibido se preenchido; botão "Editar feedback" |
| **rejeitado** | `clientApproved: false` | Badge vermelho "Questionado"; comentário exibido; botão "Editar feedback" |
| **erro** | 4xx/5xx | Toast de erro; botões reabilitados |

---

### Convenções de paginação, filtros e autenticação

**Paginação:** Este módulo não possui endpoints paginados (a DRE é um objeto único; os cards são sempre exatamente 3). Não envie parâmetros `cursor` ou `limit` — serão ignorados.

**Filtros:** Nenhum filtro disponível nos endpoints deste módulo. O `analysisId` no path já é o identificador único da análise.

**Autenticação:**
- Todo request exige o header `Authorization: Bearer <jwt>`.
- O `tenantId` é extraído automaticamente do claim `tenant_id` do JWT pelo backend. **Nunca passe `tenantId` em path, query string ou body** — será rejeitado ou ignorado silenciosamente, e pode revelar dados de outro tenant por bug de injeção.
- Ao receber 401, invalidar o token local e redirecionar para login.
- Tokens expiram conforme configurado no módulo `auth-tenant` (consultar handoff daquele módulo).

**`requestId`:** Cada response inclui `requestId` (UUID v4). Exibir no modal/toast de erro para facilitar o rastreamento pelo suporte. Logar no console de produção junto com o timestamp.

---

### Edge cases que o frontend precisa tratar

1. **`dreJson: null` com `status: "delivered"` ou `"approved"`** — Situação que não deveria ocorrer em operação normal, mas pode surgir se houve falha de pipeline. Exibir mensagem "DRE temporariamente indisponível" e mostrar o `requestId` para suporte. Não mostrar tela de "generating".

2. **`cards.length` entre 1 e 2** — Situação de pipeline parcialmente falho. Exibir os cards recebidos e um placeholder "Card em processamento" para os slots faltantes. Não bloquear o feedback nos cards já disponíveis.

3. **Feedback enviado com análise já em status `"approved"`** — O backend aceita a gravação (200), mas o fechamento do mês já ocorreu. Considerar exibir aviso: "Esta análise já foi fechada. Seu comentário foi salvo, mas não impacta o fechamento."

4. **Polling enquanto gerando:** Quando `status` for `"pending"` ou `"generating"`, pollar ambos os endpoints (`/dre` e `/narrative`) a cada 10 segundos. Parar o polling ao receber `status !== "pending" && status !== "generating"` ou `cards.length === 3`. Usar `requestId` de cada response para evitar race conditions na UI.

5. **Valores negativos na DRE** — Campos como `resultadoFinanceiro` e `lucroLiquido` podem ser negativos (empresa operando no prejuízo). O frontend deve suportar valores negativos sem quebrar a formatação. Sugestão: exibir valores negativos em vermelho.

6. **`naoClassificado > 0`** — Indica lançamentos que o pipeline não classificou. Exibir nota explicativa próxima à linha "Não Classificados" orientando o cliente a revisar os lançamentos no módulo de ingestão.

7. **Comentário com 500 caracteres exatos** — Válido. O limite é `≤ 500`. Implementar contador regressivo no campo de comentário para guiar o usuário.

8. **Re-envio de feedback** — O PATCH sobrescreve o feedback anterior; não existe histórico de versões de feedback exposto pela API. Se o UX demandar histórico, tratar apenas no frontend (estado local antes de enviar).

9. **Usuário com role `viewer`** — O módulo `auth-tenant` define as roles. Um `viewer` pode chamar os GETs normalmente. O PATCH de feedback deve ser bloqueado no frontend para `viewer` (verificar `role` no JWT decode) antes de exibir os botões de aprovação, evitando um 403 desnecessário.

10. **Timeout de rede** — Nos GETs com polling, implementar timeout de 8s por request. Se expirar, exibir estado de erro temporário e tentar novamente no próximo ciclo de polling sem incrementar contador de falhas imediatamente.
