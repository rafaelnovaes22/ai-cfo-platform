# Contract — ingest (frontend)

**Módulo:** `ingest`
**Onda:** 1 — Tier B
**Status backend:** complete (commit 46f94b0, 2026-05-11)
**Gerado em:** 2026-05-12

---

### 1. OpenAPI 3.1 spec

```yaml
openapi: "3.1.0"

info:
  title: Aicfo — Ingest API
  version: "1.0.0"
  description: |
    Endpoints de importação de lançamentos financeiros do módulo `ingest`.
    Suporta 3 modalidades: upload de arquivo (xlsx/xls/csv/pdf), texto colado
    (clipboard) e entrada manual (JSON). Toda chamada é idempotente por
    tenant + mês de referência — re-importar o mesmo mês apaga os dados
    anteriores e reinicia o pipeline de análise.

servers:
  - url: https://api.example.com/v1
    description: Produção
  - url: http://localhost:3000/v1
    description: Desenvolvimento local

security:
  - BearerAuth: []

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        JWT emitido pelo módulo `auth-tenant`. O claim `tenant_id` identifica
        o tenant — nunca envie tenantId no body/path/query.

  schemas:

    # ── Tipos compartilhados ────────────────────────────────────────────────

    ReferenceMonth:
      type: string
      pattern: '^\d{4}-(0[1-9]|1[0-2])$'
      example: "2025-04"
      description: Mês de referência dos lançamentos no formato YYYY-MM.

    IngestOutcome:
      type: string
      enum: [completed, partial, failed]
      description: |
        - `completed`: ≥50 lançamentos extraídos com sucesso; pipeline de
          classificação enfileirado automaticamente.
        - `partial`: <50 lançamentos ou linhas órfãs detectadas; análise
          aguarda revisão ou complemento manual.
        - `failed`: formato não reconhecido, arquivo corrompido ou zero
          lançamentos extraídos.

    IngestResponse:
      type: object
      required: [requestId, analysisId, referenceMonth, entryCount, orphanCount, outcome]
      properties:
        requestId:
          type: string
          format: uuid
          description: UUID v4 gerado pelo servidor para rastreamento da requisição.
          example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
        analysisId:
          type: string
          format: uuid
          description: |
            UUID da MonthlyAnalysis criada/atualizada. Vazio ("") quando
            outcome = failed. Use este ID para acompanhar o status no módulo
            `hub`.
          example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        referenceMonth:
          $ref: '#/components/schemas/ReferenceMonth'
        entryCount:
          type: integer
          minimum: 0
          description: Total de lançamentos importados com sucesso.
          example: 87
        orphanCount:
          type: integer
          minimum: 0
          description: |
            Número de linhas que não puderam ser parseadas (sem data, valor
            inválido, etc.). Exibir ao usuário quando >0.
          example: 3
        outcome:
          $ref: '#/components/schemas/IngestOutcome'

    ManualEntry:
      type: object
      required: [date, description, amount, direction]
      properties:
        date:
          type: string
          description: |
            Data do lançamento. Aceita os formatos DD/MM/YYYY, DD-MM-YYYY,
            YYYY-MM-DD e variantes com separadores '/'. O backend normaliza
            para YYYY-MM-DD internamente.
          example: "15/04/2025"
        description:
          type: string
          minLength: 1
          description: Descrição textual do lançamento.
          example: "Pagamento fornecedor ABC"
        amount:
          oneOf:
            - type: number
            - type: string
          description: |
            Valor do lançamento. Pode ser enviado como número (ex: 1500.50)
            ou string (ex: "1.500,50"). O backend normaliza para centavos
            inteiros internamente.
          example: 1500.50
        direction:
          type: string
          enum: [credit, debit]
          description: |
            Direção do lançamento: `credit` = entrada, `debit` = saída.

    # ── Erros RFC 7807 ─────────────────────────────────────────────────────

    ProblemDetail:
      type: object
      required: [type, title, status, detail, instance]
      properties:
        type:
          type: string
          format: uri
          description: URI que identifica o tipo de problema.
          example: "https://api.example.com/errors/validation-error"
        title:
          type: string
          description: Descrição curta e legível do tipo de erro.
          example: "Validation Error"
        status:
          type: integer
          description: Código HTTP.
          example: 422
        detail:
          type: string
          description: Explicação específica desta ocorrência.
          example: "O campo referenceMonth está fora do formato YYYY-MM."
        instance:
          type: string
          format: uri
          description: URI da ocorrência específica (incluindo requestId).
          example: "https://api.example.com/errors/f47ac10b"
        requestId:
          type: string
          format: uuid
          description: UUID da requisição para correlação com logs.
          example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"

paths:

  # ─────────────────────────────────────────────────────────────────────────
  /ingest/upload:
    post:
      operationId: ingestUpload
      summary: Importa lançamentos via arquivo (xlsx, xls, csv ou pdf)
      description: |
        Recebe um arquivo via `multipart/form-data`. O backend detecta o
        formato pela extensão do arquivo e escolhe o parser adequado.
        Limite de tamanho: **20 MB**.

        O mês de referência é obrigatório como query param `?referenceMonth=YYYY-MM`.

        Esta operação é idempotente: re-enviar o mesmo mês apaga todos os
        lançamentos, narrativas e itens de plano de ação anteriores do mês.
      tags: [Ingest]
      security:
        - BearerAuth: []
      parameters:
        - name: referenceMonth
          in: query
          required: true
          schema:
            $ref: '#/components/schemas/ReferenceMonth'
          description: Mês de referência dos lançamentos (YYYY-MM).
          example: "2025-04"
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [file]
              properties:
                file:
                  type: string
                  format: binary
                  description: |
                    Arquivo de lançamentos. Extensões suportadas: `.xlsx`, `.xls`,
                    `.csv`, `.pdf`. O nome do arquivo é usado para inferir o parser.
            encoding:
              file:
                contentType: >
                  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,
                  application/vnd.ms-excel,
                  text/csv,
                  application/pdf
      responses:
        "200":
          description: Ingestão concluída (pode ser completed, partial ou failed).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/IngestResponse'
              examples:
                completed:
                  summary: Arquivo processado, pipeline enfileirado
                  value:
                    requestId: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
                    analysisId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                    referenceMonth: "2025-04"
                    entryCount: 87
                    orphanCount: 3
                    outcome: "completed"
                partial:
                  summary: Menos de 50 lançamentos extraídos
                  value:
                    requestId: "b1c2d3e4-f5a6-7890-bcde-f12345678901"
                    analysisId: "b1b2b3b4-e5f6-7890-abcd-ef1234567891"
                    referenceMonth: "2025-04"
                    entryCount: 22
                    orphanCount: 0
                    outcome: "partial"
                failed:
                  summary: Arquivo não reconhecido
                  value:
                    requestId: "c1c2c3c4-f5a6-7890-cdef-123456789012"
                    analysisId: ""
                    referenceMonth: "2025-04"
                    entryCount: 0
                    orphanCount: 0
                    outcome: "failed"
        "400":
          description: Query param ausente/inválido ou arquivo não enviado.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
              example:
                type: "https://api.example.com/errors/missing-param"
                title: "Missing Required Parameter"
                status: 400
                detail: "Query ?referenceMonth=YYYY-MM obrigatório."
                instance: "https://api.example.com/errors/d1d2d3d4"
                requestId: "d1d2d3d4-e5f6-7890-abcd-ef1234567892"
        "401":
          description: Token ausente, inválido ou expirado.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
        "413":
          description: Arquivo excede limite de 20 MB.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'

  # ─────────────────────────────────────────────────────────────────────────
  /ingest/clipboard:
    post:
      operationId: ingestClipboard
      summary: Importa lançamentos via texto colado (clipboard)
      description: |
        Recebe texto tabulado copiado de uma planilha ou relatório. O parser
        detecta separadores automaticamente (tab, ponto-e-vírgula, pipe).
        Mínimo de 10 caracteres no campo `text`.
      tags: [Ingest]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [referenceMonth, text]
              properties:
                referenceMonth:
                  $ref: '#/components/schemas/ReferenceMonth'
                text:
                  type: string
                  minLength: 10
                  description: |
                    Texto tabulado colado pelo usuário. Normalmente conteúdo
                    copiado diretamente de uma aba de planilha (Excel/Sheets).
                  example: "Data\tDescrição\tValor\tTipo\n01/04/2025\tAluguel escritório\t3500,00\tD"
            examples:
              tabSeparated:
                summary: Texto separado por tabs (Excel)
                value:
                  referenceMonth: "2025-04"
                  text: "Data\tDescrição\tValor\tTipo\n01/04/2025\tAluguel escritório\t3500,00\tD\n05/04/2025\tVenda produto X\t8000,00\tC"
              semicolonSeparated:
                summary: Texto separado por ponto-e-vírgula
                value:
                  referenceMonth: "2025-04"
                  text: "01/04/2025;Aluguel escritório;3500,00;D\n05/04/2025;Venda produto X;8000,00;C"
      responses:
        "200":
          description: Ingestão concluída.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/IngestResponse'
              examples:
                completed:
                  summary: Texto processado com sucesso
                  value:
                    requestId: "e1e2e3e4-f5a6-7890-def0-f12345678903"
                    analysisId: "c1c2c3c4-e5f6-7890-abcd-ef1234567893"
                    referenceMonth: "2025-04"
                    entryCount: 63
                    orphanCount: 0
                    outcome: "completed"
                partialWithOrphans:
                  summary: Algumas linhas não parseadas
                  value:
                    requestId: "f1f2f3f4-a5b6-7890-ef01-123456789014"
                    analysisId: "d1d2d3d4-e5f6-7890-abcd-ef1234567894"
                    referenceMonth: "2025-04"
                    entryCount: 41
                    orphanCount: 7
                    outcome: "partial"
        "400":
          description: Body inválido (campo obrigatório ausente, text muito curto, etc.).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
        "401":
          description: Token ausente, inválido ou expirado.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
        "422":
          description: Dados semanticamente inválidos (ex.: referenceMonth com mês 13).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'

  # ─────────────────────────────────────────────────────────────────────────
  /ingest/manual:
    post:
      operationId: ingestManual
      summary: Importa lançamentos via formulário manual (JSON)
      description: |
        Recebe um array de lançamentos digitados pelo usuário no formulário
        do produto. Mínimo de 1 entrada. O campo `amount` aceita número ou
        string formatada (ex: "1.500,50").
      tags: [Ingest]
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [referenceMonth, entries]
              properties:
                referenceMonth:
                  $ref: '#/components/schemas/ReferenceMonth'
                entries:
                  type: array
                  minItems: 1
                  items:
                    $ref: '#/components/schemas/ManualEntry'
            examples:
              happyPath:
                summary: 2 lançamentos válidos
                value:
                  referenceMonth: "2025-04"
                  entries:
                    - date: "01/04/2025"
                      description: "Aluguel escritório"
                      amount: 3500.00
                      direction: "debit"
                    - date: "05/04/2025"
                      description: "Venda produto X"
                      amount: "8.000,00"
                      direction: "credit"
              singleEntry:
                summary: Mínimo válido (1 entrada)
                value:
                  referenceMonth: "2025-04"
                  entries:
                    - date: "15/04/2025"
                      description: "Pagamento avulso"
                      amount: 500
                      direction: "debit"
      responses:
        "200":
          description: Ingestão concluída.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/IngestResponse'
              examples:
                completed:
                  summary: 50+ lançamentos, pipeline enfileirado
                  value:
                    requestId: "a2b3c4d5-e6f7-8901-abcd-ef2345678905"
                    analysisId: "e1e2e3e4-e5f6-7890-abcd-ef1234567895"
                    referenceMonth: "2025-04"
                    entryCount: 52
                    orphanCount: 0
                    outcome: "completed"
                partial:
                  summary: Menos de 50 entradas
                  value:
                    requestId: "b2c3d4e5-f6a7-8901-bcde-f23456789016"
                    analysisId: "f1f2f3f4-e5f6-7890-abcd-ef1234567896"
                    referenceMonth: "2025-04"
                    entryCount: 2
                    orphanCount: 0
                    outcome: "partial"
        "400":
          description: Body inválido (array vazio, campo obrigatório ausente).
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
        "401":
          description: Token ausente, inválido ou expirado.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
        "422":
          description: Dados semanticamente inválidos.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProblemDetail'
```

---

### 2. Zod schema TypeScript

```ts
import { z } from "zod";

// ─── Tipos primitivos ────────────────────────────────────────────────────────

/** Mês de referência no formato YYYY-MM. */
export const ReferenceMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Formato esperado: YYYY-MM")
  .describe("Mês de referência dos lançamentos");

export type ReferenceMonth = z.infer<typeof ReferenceMonthSchema>;

/**
 * Resultado de outcome do ingest.
 * - completed: ≥50 lançamentos; pipeline de classificação enfileirado
 * - partial: <50 lançamentos ou linhas órfãs; aguarda complemento
 * - failed: formato não reconhecido ou arquivo corrompido
 */
export const IngestOutcomeSchema = z.enum(["completed", "partial", "failed"]);

export type IngestOutcome = z.infer<typeof IngestOutcomeSchema>;

// ─── Resposta comum (todos os 3 endpoints) ───────────────────────────────────

export const IngestResponseSchema = z.object({
  /** UUID v4 para correlação com logs do servidor. */
  requestId: z.string().uuid(),

  /**
   * UUID da MonthlyAnalysis criada/atualizada.
   * Será string vazia ("") quando outcome = "failed".
   * Use este ID para polling de status no módulo hub.
   */
  analysisId: z.string(),

  /** Mês de referência dos lançamentos importados. */
  referenceMonth: ReferenceMonthSchema,

  /** Total de lançamentos importados com sucesso. */
  entryCount: z.number().int().min(0),

  /**
   * Linhas que não puderam ser parseadas (data ausente, valor inválido, etc.).
   * Exibir alerta ao usuário quando > 0.
   */
  orphanCount: z.number().int().min(0),

  outcome: IngestOutcomeSchema,
});

export type IngestResponse = z.infer<typeof IngestResponseSchema>;

// ─── Corpo: POST /ingest/clipboard ──────────────────────────────────────────

export const ClipboardBodySchema = z.object({
  referenceMonth: ReferenceMonthSchema,
  /**
   * Texto tabulado colado pelo usuário (ex: conteúdo copiado do Excel/Sheets).
   * Separadores aceitos: tab, ponto-e-vírgula, pipe.
   * Mínimo 10 caracteres.
   */
  text: z.string().min(10, "O texto colado precisa ter ao menos 10 caracteres"),
});

export type ClipboardBody = z.infer<typeof ClipboardBodySchema>;

// ─── Corpo: POST /ingest/manual ──────────────────────────────────────────────

export const ManualEntrySchema = z.object({
  /**
   * Data do lançamento. Formatos aceitos: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD.
   * O backend normaliza para YYYY-MM-DD internamente.
   */
  date: z.string().min(1, "Data é obrigatória"),

  description: z
    .string()
    .min(1, "Descrição é obrigatória"),

  /**
   * Valor do lançamento. Aceita número (1500.50) ou string formatada ("1.500,50").
   * O backend converte para centavos inteiros internamente.
   * Valores monetários sempre são armazenados como centavos no banco.
   */
  amount: z.union([
    z.number().positive("Valor precisa ser positivo"),
    z
      .string()
      .min(1, "Valor é obrigatório")
      .describe("Aceita formatos como '1.500,50' ou '1500.50'"),
  ]),

  /** credit = entrada (receita), debit = saída (despesa). */
  direction: z.enum(["credit", "debit"]),
});

export type ManualEntry = z.infer<typeof ManualEntrySchema>;

export const ManualBodySchema = z.object({
  referenceMonth: ReferenceMonthSchema,
  entries: z
    .array(ManualEntrySchema)
    .min(1, "Informe ao menos um lançamento"),
});

export type ManualBody = z.infer<typeof ManualBodySchema>;

// ─── Erro RFC 7807 ────────────────────────────────────────────────────────────

export const ProblemDetailSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  /** Presente em todos os erros para correlação com logs. */
  requestId: z.string().uuid().optional(),
});

export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;

// ─── Upload (multipart) — sem schema Zod de body (é FormData) ────────────────

/**
 * Para POST /ingest/upload:
 * - Content-Type: multipart/form-data
 * - Campo `file`: binário do arquivo (xlsx, xls, csv, pdf)
 * - Query param: `?referenceMonth=YYYY-MM` (validar com ReferenceMonthSchema)
 * - Limite de tamanho: 20 MB
 */
export const UploadQuerySchema = z.object({
  referenceMonth: ReferenceMonthSchema,
});

export type UploadQuery = z.infer<typeof UploadQuerySchema>;

// ─── Helpers de UI ────────────────────────────────────────────────────────────

/** Mapeia outcome para texto amigável ao usuário. */
export const OUTCOME_LABEL: Record<IngestOutcome, string> = {
  completed: "Importação concluída",
  partial: "Importação parcial — revise os dados",
  failed: "Falha na importação — verifique o arquivo",
};

/** Fontes de ingest disponíveis. */
export const INGEST_SOURCE = ["upload", "clipboard", "manual"] as const;
export type IngestSource = (typeof INGEST_SOURCE)[number];
```

---

### 3. Handoff doc

## Módulo `ingest` — Handoff para dev frontend

O módulo `ingest` é o ponto de entrada de dados financeiros na plataforma Aicfo. Ele recebe lançamentos do mês de referência do cliente em 3 modalidades (upload de arquivo, texto colado e formulário manual), normaliza os dados e enfileira automaticamente o pipeline de análise quando há lançamentos suficientes (≥ 50). Esta é a primeira tela do fluxo principal do produto: o cliente começa aqui toda vez que vai fechar o mês financeiro.

---

### Tabela de endpoints

| Método | Path | Propósito |
|--------|------|-----------|
| `POST` | `/v1/ingest/upload` | Importar arquivo xlsx, xls, csv ou pdf |
| `POST` | `/v1/ingest/clipboard` | Importar texto colado (ex: copiar do Excel) |
| `POST` | `/v1/ingest/manual` | Digitar lançamentos manualmente via formulário |

Todos os endpoints:
- Requerem `Authorization: Bearer <JWT>`
- Retornam `200` independentemente do outcome (completed/partial/failed) — erros de negócio não são 4xx
- São idempotentes por tenant + mês: re-importar apaga e substitui

---

### POST `/v1/ingest/upload`

#### Request

- **Content-Type:** `multipart/form-data`
- **Query param obrigatório:** `?referenceMonth=YYYY-MM`
- **Campo `file`:** binário do arquivo (max 20 MB)
- Extensões suportadas: `.xlsx`, `.xls`, `.csv`, `.pdf`
- O backend infere o parser pela extensão do nome do arquivo

**Exemplo feliz — upload de planilha xlsx:**
```
POST /v1/ingest/upload?referenceMonth=2025-04
Authorization: Bearer eyJhbGc...
Content-Type: multipart/form-data; boundary=----FormBoundary

------FormBoundary
Content-Disposition: form-data; name="file"; filename="lancamentos-abril.xlsx"
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

<binário do arquivo>
------FormBoundary--
```

**Exemplo edge — arquivo PDF (extrato contábil):**
```
POST /v1/ingest/upload?referenceMonth=2025-04
Authorization: Bearer eyJhbGc...
Content-Type: multipart/form-data; boundary=----FormBoundary

------FormBoundary
Content-Disposition: form-data; name="file"; filename="extrato-abril.pdf"
Content-Type: application/pdf

<binário do PDF>
------FormBoundary--
```

#### Response 200 (completed)
```json
{
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "analysisId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "referenceMonth": "2025-04",
  "entryCount": 87,
  "orphanCount": 3,
  "outcome": "completed"
}
```

#### Response 200 (failed — arquivo corrompido ou não reconhecido)
```json
{
  "requestId": "c1c2c3c4-f5a6-7890-cdef-123456789012",
  "analysisId": "",
  "referenceMonth": "2025-04",
  "entryCount": 0,
  "orphanCount": 0,
  "outcome": "failed"
}
```

#### Response 400 — query param ausente
```json
{
  "type": "https://api.example.com/errors/missing-param",
  "title": "Missing Required Parameter",
  "status": 400,
  "detail": "Query ?referenceMonth=YYYY-MM obrigatório.",
  "instance": "https://api.example.com/errors/d1d2d3d4",
  "requestId": "d1d2d3d4-e5f6-7890-abcd-ef1234567892"
}
```

#### Códigos de erro e ação no frontend

| Status | Causa | Ação esperada no frontend |
|--------|-------|---------------------------|
| 400 | `referenceMonth` ausente ou fora do padrão YYYY-MM | Exibir erro de validação antes do submit; nunca deixar o campo em branco |
| 400 | Campo `file` não enviado | Verificar lógica do FormData — não exibir ao usuário; logar |
| 401 | Token ausente ou expirado | Redirecionar para tela de login; limpar token do storage |
| 413 | Arquivo > 20 MB | Exibir mensagem: "O arquivo excede o limite de 20 MB. Reduza ou divida em partes." |
| 200 + outcome=failed | Arquivo não reconhecido / corrompido | Exibir mensagem de erro inline: "Não foi possível ler o arquivo. Verifique se está no formato correto (xlsx, xls, csv ou pdf)." |

---

### POST `/v1/ingest/clipboard`

#### Request

- **Content-Type:** `application/json`
- Texto mínimo de 10 caracteres

**Exemplo feliz — texto separado por tab (colado do Excel):**
```json
{
  "referenceMonth": "2025-04",
  "text": "Data\tDescrição\tValor\tTipo\n01/04/2025\tAluguel escritório\t3500,00\tD\n05/04/2025\tVenda produto X\t8000,00\tC"
}
```

**Exemplo edge — texto com linhas mal formatadas (gerará orphanCount > 0):**
```json
{
  "referenceMonth": "2025-04",
  "text": "01/04/2025\tAluguel\t3500,00\tD\nLinha inválida sem campos\n05/04/2025\tVenda\t8000,00\tC"
}
```

#### Response 200 (completed)
```json
{
  "requestId": "e1e2e3e4-f5a6-7890-def0-f12345678903",
  "analysisId": "c1c2c3c4-e5f6-7890-abcd-ef1234567893",
  "referenceMonth": "2025-04",
  "entryCount": 63,
  "orphanCount": 0,
  "outcome": "completed"
}
```

#### Response 200 (partial — linhas órfãs)
```json
{
  "requestId": "f1f2f3f4-a5b6-7890-ef01-123456789014",
  "analysisId": "d1d2d3d4-e5f6-7890-abcd-ef1234567894",
  "referenceMonth": "2025-04",
  "entryCount": 41,
  "orphanCount": 7,
  "outcome": "partial"
}
```

#### Response 400 — text muito curto
```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "O campo text precisa ter ao menos 10 caracteres.",
  "instance": "https://api.example.com/errors/g1g2g3g4",
  "requestId": "g1g2g3g4-e5f6-7890-abcd-ef1234567897"
}
```

#### Códigos de erro e ação no frontend

| Status | Causa | Ação esperada no frontend |
|--------|-------|---------------------------|
| 400 | `text` com menos de 10 caracteres | Validar antes do submit: "Cole ao menos uma linha de dados." |
| 400 | `referenceMonth` inválido | Idem ao upload |
| 401 | Token ausente ou expirado | Redirecionar para login |
| 422 | Dados fora do range esperado | Exibir detalhe do erro retornado pela API |
| 200 + outcome=partial + orphanCount>0 | Linhas mal formatadas no texto | Exibir: "X linhas não puderam ser lidas. Verifique se o texto está no formato correto." |

---

### POST `/v1/ingest/manual`

#### Request

- **Content-Type:** `application/json`
- Mínimo de 1 entrada no array `entries`
- `amount` aceita número (`1500.50`) ou string formatada (`"1.500,50"`)
- `direction`: `"credit"` = entrada, `"debit"` = saída

**Exemplo feliz — 2 lançamentos válidos:**
```json
{
  "referenceMonth": "2025-04",
  "entries": [
    {
      "date": "01/04/2025",
      "description": "Aluguel escritório",
      "amount": 3500.00,
      "direction": "debit"
    },
    {
      "date": "05/04/2025",
      "description": "Venda produto X",
      "amount": "8.000,00",
      "direction": "credit"
    }
  ]
}
```

**Exemplo edge — valor como string formatada em PT-BR:**
```json
{
  "referenceMonth": "2025-04",
  "entries": [
    {
      "date": "15/04/2025",
      "description": "Pagamento fornecedor",
      "amount": "1.500,50",
      "direction": "debit"
    }
  ]
}
```

#### Response 200 (partial — menos de 50 entradas)
```json
{
  "requestId": "b2c3d4e5-f6a7-8901-bcde-f23456789016",
  "analysisId": "f1f2f3f4-e5f6-7890-abcd-ef1234567896",
  "referenceMonth": "2025-04",
  "entryCount": 2,
  "orphanCount": 0,
  "outcome": "partial"
}
```

#### Response 400 — array vazio
```json
{
  "type": "https://api.example.com/errors/validation-error",
  "title": "Validation Error",
  "status": 400,
  "detail": "O campo entries precisa ter ao menos 1 item.",
  "instance": "https://api.example.com/errors/h1h2h3h4",
  "requestId": "h1h2h3h4-e5f6-7890-abcd-ef1234567898"
}
```

#### Códigos de erro e ação no frontend

| Status | Causa | Ação esperada no frontend |
|--------|-------|---------------------------|
| 400 | `entries` array vazio | Bloquear submit: "Adicione ao menos um lançamento." |
| 400 | Campo obrigatório ausente em alguma entrada | Realçar linha com erro e campo específico |
| 401 | Token ausente ou expirado | Redirecionar para login |
| 422 | `direction` fora de `credit`/`debit` | Dropdown de UI deve impedir — logar se ocorrer |

---

### Estados de UI sugeridos

#### Estados globais (todos os 3 endpoints)

| Estado | Condição | Comportamento sugerido |
|--------|----------|------------------------|
| **idle** | Antes do submit | Formulário habilitado, botão "Importar" ativo |
| **loading** | Request em andamento | Desabilitar formulário + botão; exibir spinner/progress |
| **success-completed** | `outcome = "completed"` | Toast "Importação concluída! Sua análise está sendo gerada." + redirecionar para hub do mês |
| **success-partial** | `outcome = "partial"` | Banner amarelo: "Importação parcial — X lançamentos importados. Você pode adicionar mais ou prosseguir." + não redirecionar automaticamente |
| **success-partial-orphans** | `outcome = "partial"` + `orphanCount > 0` | Banner amarelo com contagem de linhas não lidas + sugestão de revisão |
| **error-failed** | `outcome = "failed"` | Banner vermelho: "Não foi possível ler os dados." + dicas específicas por modalidade |
| **error-http** | Status 4xx/5xx | Mensagem inline baseada no `detail` do RFC 7807 |
| **error-network** | Falha de rede (sem response) | "Verifique sua conexão e tente novamente." |

#### Estados específicos por modalidade

**Upload de arquivo:**
- **drag-over**: Usuário arrastando arquivo sobre a área de drop
- **file-selected**: Arquivo selecionado, antes do submit — exibir nome + tamanho
- **file-too-large**: Arquivo > 20 MB antes do upload — bloquear submit localmente
- **unsupported-extension**: Extensão fora de xlsx/xls/csv/pdf — bloquear e avisar

**Clipboard:**
- **paste-empty**: Textarea vazia — botão desabilitado
- **paste-short**: Menos de 10 caracteres — feedback inline
- **paste-ready**: ≥10 chars — botão habilitado

**Manual:**
- **form-empty**: Nenhuma linha adicionada — botão desabilitado
- **row-error**: Linha com campo inválido — highlight da célula + mensagem inline
- **below-threshold**: Após 200 — banner informativo: "Você tem X lançamentos. Para uma análise completa, adicione ao menos 50."

---

### Convenções de paginação, filtros e auth

**Auth:**
- Enviar sempre `Authorization: Bearer <token>` no header
- `tenantId` nunca vai em body, query ou path — vem do JWT claim `tid`
- Em `401`, limpar token do storage local e redirecionar para `/login`
- O token pode expirar durante o upload de um arquivo grande — considerar refresh proativo antes de submits longos

**Paginação:**
- O módulo `ingest` não possui endpoints de listagem — não há paginação neste módulo
- Para listar análises mensais de um tenant, use o módulo `hub`

**Idempotência:**
- Re-importar o mesmo mês (`referenceMonth`) apaga e substitui todos os dados anteriores (lançamentos, narrativas, itens do plano de ação)
- Exibir confirmação explícita ao usuário quando já existe uma análise para o mês selecionado: "Já existe uma importação para Abril 2025. Deseja substituí-la?"
- A UI deve consultar o módulo `hub` ao abrir a tela de ingest para detectar se o mês já foi importado

**Valores monetários:**
- A API recebe `amount` no formulário manual como número ou string PT-BR
- Internamente o backend armazena em centavos inteiros (`amountCents`)
- Na UI de entrada manual, formatar o campo com máscara de moeda BRL (ex: `R$ 1.500,50`)

**Datas:**
- O backend aceita DD/MM/YYYY, DD-MM-YYYY e YYYY-MM-DD para o campo `date` em entradas manuais
- `referenceMonth` é sempre YYYY-MM (nunca DD/MM/YYYY)

---

### Edge cases que o frontend precisa tratar

1. **Arquivo sem extensão ou extensão desconhecida** — validar localmente antes do upload; exibir "Arquivo não suportado. Use xlsx, xls, csv ou pdf."

2. **PDF sem texto selecionável (imagem escaneada)** — o backend retornará `outcome = "failed"` ou `orphanCount` alto; exibir mensagem: "PDFs escaneados podem não ser lidos corretamente. Prefira exportar o arquivo digital do seu sistema contábil."

3. **`analysisId` vazio string (`""`)** — ocorre quando `outcome = "failed"`. Nunca tentar navegar para `/hub/<analysisId>` nesses casos. Tratar `analysisId === ""` explicitamente.

4. **`orphanCount > 0` com `outcome = "completed"`** — possível quando >50 lançamentos foram importados mas algumas linhas falharam. Exibir alerta não-bloqueante: "X linhas não puderam ser lidas e foram ignoradas."

5. **`outcome = "partial"` (< 50 lançamentos)** — o pipeline de classificação NÃO é enfileirado automaticamente. O usuário precisa de uma ação clara: adicionar mais lançamentos ou continuar mesmo assim (aceitando análise limitada). Implementar botão "Continuar mesmo assim" que navega para o hub sem análise gerada.

6. **Re-import de mês existente** — o backend é idempotente e substitui silenciosamente. A UI é responsável por detectar e confirmar com o usuário antes do submit.

7. **Upload concorrente** — o usuário pode tentar submeter múltiplos arquivos em sequência rápida. Desabilitar o botão durante o request e cancelar requests pendentes ao iniciar um novo.

8. **`referenceMonth` de meses futuros** — o backend não bloqueia, mas a UI deve alertar: "Você está importando dados de um mês futuro. Confirma?"

9. **Texto colado com cabeçalho (header row)** — o parser tenta detectar automaticamente. Se `orphanCount` for igual ao número de linhas menos 1, provavelmente o texto estava vazio exceto pelo cabeçalho. Sugerir que o usuário cole os dados sem o cabeçalho.

10. **Timeout de rede em uploads grandes** — arquivos próximos de 20 MB podem demorar em conexões lentas. Exibir progress bar (se possível via XHR/fetch com upload progress) e mensagem de aguardo: "Enviando arquivo... isso pode levar alguns segundos."
