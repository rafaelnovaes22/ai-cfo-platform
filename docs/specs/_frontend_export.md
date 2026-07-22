# Frontend Contract — export

**Module:** `export`
**Wave:** 1 — SKU `monthly-analysis`
**Generated:** 2026-05-12
**Backend status:** complete (commit `8f51c09`)

---

### 1. OpenAPI 3.1 spec

```yaml
openapi: "3.1.0"
info:
  title: Aicfo Export API
  version: "1.0.0"
  description: >
    Gera e faz download de relatórios PDF da análise mensal em três sabores:
    Mensal (interno), Investidores (KPIs + ações médio/longo prazo) e
    Sócios (distribuição + ações curto prazo). Renderização determinística —
    sem LLM; usa os dados já produzidos pelo pipeline ingest→classification→
    dre-narrative→action-plan.

servers:
  - url: https://api.example.com/v1
    description: Produção
  - url: http://localhost:3000/v1
    description: Desenvolvimento local

security:
  - bearerAuth: []

paths:
  /analysis/{analysisId}/export/{type}:
    get:
      operationId: exportAnalysisReport
      summary: Exportar análise como PDF
      description: >
        Gera e retorna o PDF da análise indicada no sabor solicitado.
        O arquivo é entregue como stream binário com Content-Disposition
        attachment. O `tenantId` é extraído do JWT — nunca enviar no path
        ou na query string. A resposta é o binário do PDF (não JSON).
      tags:
        - export
      parameters:
        - name: analysisId
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: UUID da MonthlyAnalysis
        - name: type
          in: path
          required: true
          schema:
            type: string
            enum: [monthly, investors, partners]
          description: |
            Sabor do relatório:
            - `monthly` — DRE completo + 3 narrative cards + plano 3-horizontes
            - `investors` — métricas-chave (receita, EBITDA, margens) + ações médio/longo prazo
            - `partners` — lucro líquido, pró-labore, distribuição potencial + ações curto prazo
      responses:
        "200":
          description: PDF gerado com sucesso
          headers:
            Content-Disposition:
              schema:
                type: string
              example: 'attachment; filename="aicfo-2026-04-monthly.pdf"'
            X-Request-Id:
              schema:
                type: string
                format: uuid
              description: UUID v4 para rastreabilidade
          content:
            application/pdf:
              schema:
                type: string
                format: binary
        "401":
          description: Token ausente, inválido ou expirado
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"
              example:
                type: "https://example.com/errors/unauthorized"
                title: "Não autorizado"
                status: 401
                detail: "Token inválido ou expirado"
                instance: "/v1/analysis/abc-123/export/monthly"
        "403":
          description: Análise não pertence ao tenant do token
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"
              example:
                type: "https://example.com/errors/forbidden"
                title: "Acesso negado"
                status: 403
                detail: "Você não tem permissão para acessar esta análise"
                instance: "/v1/analysis/abc-123/export/monthly"
        "404":
          description: Análise não encontrada (ou não pertence ao tenant)
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"
              example:
                type: "https://example.com/errors/not-found"
                title: "Análise não encontrada"
                status: 404
                detail: "Nenhuma análise com o id informado foi encontrada para este tenant"
                instance: "/v1/analysis/abc-123/export/monthly"
        "422":
          description: DRE ainda não foi gerada para esta análise
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"
              example:
                type: "https://example.com/errors/unprocessable"
                title: "Dados incompletos"
                status: 422
                detail: "DRE ainda não gerada para esta análise. Verifique o status antes de exportar."
                instance: "/v1/analysis/abc-123/export/monthly"
        "500":
          description: Erro interno ao gerar o PDF
          content:
            application/problem+json:
              schema:
                $ref: "#/components/schemas/ProblemDetail"

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: >
        JWT emitido pelo módulo auth. O claim `tid` (tenant_id) é extraído
        pelo backend — nunca informar tenantId na request.

  schemas:
    ProblemDetail:
      type: object
      required: [type, title, status, detail, instance]
      properties:
        type:
          type: string
          format: uri
          description: URI que identifica o tipo de erro
        title:
          type: string
          description: Título legível por humanos
        status:
          type: integer
          description: Código HTTP
        detail:
          type: string
          description: Descrição detalhada do problema
        instance:
          type: string
          description: Path da request que originou o erro
        requestId:
          type: string
          format: uuid
          description: UUID v4 de rastreabilidade (presente em todos os erros)
```

---

### 2. Zod schema TypeScript

```ts
import { z } from "zod";

// ----------------------------------------------------------------
// Path params
// ----------------------------------------------------------------

export const ReportTypeSchema = z.enum(["monthly", "investors", "partners"]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ExportParamsSchema = z.object({
  analysisId: z.string().uuid(),
  type: ReportTypeSchema,
});
export type ExportParams = z.infer<typeof ExportParamsSchema>;

// ----------------------------------------------------------------
// RFC 7807 Problem Detail — usado em todos os erros
// ----------------------------------------------------------------

export const ProblemDetailSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  instance: z.string(),
  requestId: z.string().uuid().optional(),
});
export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;

// ----------------------------------------------------------------
// Tipos de erro por código HTTP
// ----------------------------------------------------------------

export const ExportErrorCodeSchema = z.enum([
  "UNAUTHORIZED",      // 401 — token ausente/inválido/expirado
  "FORBIDDEN",         // 403 — análise não pertence ao tenant
  "NOT_FOUND",         // 404 — analysisId não existe
  "DRE_NOT_READY",     // 422 — dreJson ainda null (status != delivered/approved)
  "INTERNAL_ERROR",    // 500 — falha na geração do PDF
]);
export type ExportErrorCode = z.infer<typeof ExportErrorCodeSchema>;

// ----------------------------------------------------------------
// Metadados do arquivo gerado (extraídos dos headers da response)
// ----------------------------------------------------------------

export const ExportResponseMetaSchema = z.object({
  filename: z.string(),           // ex: "aicfo-2026-04-monthly.pdf"
  requestId: z.string().uuid().optional(),
  contentType: z.literal("application/pdf"),
});
export type ExportResponseMeta = z.infer<typeof ExportResponseMetaSchema>;

// ----------------------------------------------------------------
// Helper — parseia o Content-Disposition header
// filename="aicfo-{referenceMonth}-{type}.pdf"
// ----------------------------------------------------------------

export function parseContentDisposition(header: string): string | null {
  const match = header.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

// ----------------------------------------------------------------
// Nomes de sabor para exibição na UI
// ----------------------------------------------------------------

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  monthly:   "Relatório Mensal",
  investors: "Relatório Investidores",
  partners:  "Relatório Sócios",
};

// ----------------------------------------------------------------
// Status de análise que permitem exportação
// (análise precisa ter dreJson preenchido)
// ----------------------------------------------------------------

export const EXPORTABLE_STATUSES = ["delivered", "approved"] as const;
export type ExportableStatus = (typeof EXPORTABLE_STATUSES)[number];

export function canExport(status: string): status is ExportableStatus {
  return (EXPORTABLE_STATUSES as readonly string[]).includes(status);
}
```

---

### 3. Handoff doc

#### Resumo do módulo

O módulo `export` expõe um único endpoint que gera e faz download de relatórios PDF a partir de uma análise mensal já processada. O relatório é renderizado deterministicamente a partir dos dados do pipeline (DRE + narrative cards + action plan) — não há chamada LLM. O PDF é retornado como stream binário diretamente na response; o frontend deve tratar a resposta como `Blob` e acionar o download no browser. Três sabores estão disponíveis: **Mensal** (visão completa interna), **Investidores** (métricas-chave + ações estratégicas) e **Sócios** (distribuição de lucro + ações imediatas).

---

#### Tabela de endpoints

| Método | Path                                        | Propósito                                     |
|--------|---------------------------------------------|-----------------------------------------------|
| GET    | `/v1/analysis/{analysisId}/export/{type}`   | Gera e faz download do PDF da análise          |

> Não há endpoint de listagem próprio do módulo export. Os `analysisId` válidos são obtidos via `GET /v1/analyses` (módulo `hub`) ou `GET /v1/hub`.

---

#### Endpoint: GET /v1/analysis/{analysisId}/export/{type}

##### Request

```
GET /v1/analysis/550e8400-e29b-41d4-a716-446655440000/export/monthly
Authorization: Bearer <JWT>
```

| Campo         | Onde    | Tipo    | Obrigatório | Descrição                                        |
|---------------|---------|---------|-------------|--------------------------------------------------|
| `analysisId`  | path    | uuid    | sim         | UUID da `MonthlyAnalysis`                        |
| `type`        | path    | enum    | sim         | `monthly` \| `investors` \| `partners`           |
| `Authorization` | header | string | sim        | `Bearer <JWT>` — `tenantId` extraído do claim `tid` |

**O `tenantId` nunca deve ser enviado na URL ou no corpo da request.** O backend extrai do JWT claim `tid`.

##### Exemplos de request

**Caso feliz — download do relatório mensal:**
```
GET /v1/analysis/550e8400-e29b-41d4-a716-446655440000/export/monthly
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Edge case — type inválido (retorna 400 da validação Zod):**
```
GET /v1/analysis/550e8400-e29b-41d4-a716-446655440000/export/executive
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

##### Response — 200 (PDF stream)

A resposta é o binário do arquivo PDF. Não há corpo JSON.

| Header                | Valor exemplo                                    |
|-----------------------|--------------------------------------------------|
| `Content-Type`        | `application/pdf`                                |
| `Content-Disposition` | `attachment; filename="aicfo-2026-04-monthly.pdf"` |
| `X-Request-Id`        | `7c9e6679-7425-40de-944b-e07fc1f90ae7`           |

**Padrão do filename:** `aicfo-{referenceMonth}-{type}.pdf`
- `referenceMonth` no formato `YYYY-MM` (ex: `2026-04`)
- `type` é um dos três sabores (`monthly`, `investors`, `partners`)

**Como consumir no frontend:**
```ts
const response = await fetch(
  `/v1/analysis/${analysisId}/export/${type}`,
  { headers: { Authorization: `Bearer ${token}` } }
);

if (!response.ok) {
  const problem: ProblemDetail = await response.json();
  // tratar erro
  return;
}

const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = parseContentDisposition(
  response.headers.get("Content-Disposition") ?? ""
) ?? `aicfo-export.pdf`;
a.click();
URL.revokeObjectURL(url);
```

---

##### Respostas de erro

| Código | `type` (RFC 7807)                              | Quando ocorre                                      | Ação esperada no frontend                                                                                          |
|--------|------------------------------------------------|----------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| 401    | `.../errors/unauthorized`                      | Token ausente, inválido ou expirado                | Redirecionar para login; limpar token do storage                                                                   |
| 403    | `.../errors/forbidden`                         | Análise pertence a outro tenant                    | Exibir mensagem "Você não tem acesso a esta análise"; não expor detalhes técnicos                                   |
| 404    | `.../errors/not-found`                         | `analysisId` inexistente ou de outro tenant        | Exibir "Análise não encontrada"; oferecer link para o hub                                                          |
| 422    | `.../errors/unprocessable`                     | `dreJson` ainda é null (análise em status `pending` / `generating` / `ready`) | Exibir "Relatório não disponível ainda — a análise ainda está sendo processada"; mostrar status atual e botão de atualizar |
| 500    | `.../errors/internal`                          | Falha interna ao gerar o PDF                       | Exibir mensagem genérica de erro; oferecer botão "Tentar novamente"; registrar `requestId` para suporte             |

**Exemplo de corpo de erro 422:**
```json
{
  "type": "https://example.com/errors/unprocessable",
  "title": "Dados incompletos",
  "status": 422,
  "detail": "DRE ainda não gerada para esta análise. Verifique o status antes de exportar.",
  "instance": "/v1/analysis/550e8400-e29b-41d4-a716-446655440000/export/monthly",
  "requestId": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

---

#### Conteúdo de cada sabor de relatório

| Sabor       | Seções do PDF gerado                                                                                         |
|-------------|--------------------------------------------------------------------------------------------------------------|
| `monthly`   | Cabeçalho Aicfo → DRE Facilitado completo → Análise do Mês (3 narrative cards) → Plano de Ação (3 horizontes) |
| `investors` | Cabeçalho Aicfo → DRE Facilitado completo → Plano de Ação (médio e longo prazo apenas)                       |
| `partners`  | Cabeçalho Aicfo → Resumo para Sócios (receita bruta, pró-labore, EBITDA, lucro líquido, distribuição potencial estimada*) → Plano de Ação (curto prazo apenas) |

*Distribuição potencial = Lucro Líquido − Amortização de Dívidas − CAPEX. O PDF inclui disclaimer indicando que o cliente deve consultar o contador para valores exatos.

---

#### Estados de UI sugeridos

##### Botão/link de exportação (por sabor)

| Estado    | Quando exibir                                               | Comportamento esperado                                              |
|-----------|-------------------------------------------------------------|---------------------------------------------------------------------|
| Disabled  | `analysis.status` é `pending`, `generating` ou `ready`     | Botão cinza com tooltip "Análise ainda em processamento"            |
| Enabled   | `analysis.status` é `delivered` ou `approved`              | Botão ativo com ícone de download; label com o nome do sabor        |
| Loading   | Request em andamento (fetch do PDF)                         | Spinner no botão; desabilitar para evitar duplo-clique              |
| Error     | Response não-2xx                                            | Exibir mensagem de erro inline; restaurar botão                      |
| Success   | Download iniciado (blob criado)                             | Feedback visual breve ("Download iniciado"); restaurar botão        |

##### Página/seção de exportação

```
[Estado: análise ainda em processamento]
  - Botões de exportação desabilitados
  - Badge de status: "Gerando análise..." ou "Aguardando aprovação"
  - Botão "Atualizar" para refetch do status

[Estado: análise disponível — delivered / approved]
  - 3 botões de download (Mensal | Investidores | Sócios)
  - Cada botão mostra o nome do sabor e ícone PDF
  - Feedback de loading por botão (não bloqueia os outros)

[Estado: erro ao baixar]
  - Mensagem de erro específica por código (ver tabela acima)
  - Botão "Tentar novamente" para re-disparar a mesma request
  - Para erros 500: exibir requestId para facilitar suporte

[Estado: sem análise]
  - Seção de exportação oculta ou com CTA para iniciar importação
```

---

#### Convenções de auth

- Toda request requer header `Authorization: Bearer <JWT>`.
- O JWT é obtido no login (`POST /v1/auth/login`) e renovado via refresh token.
- O `tenantId` **nunca** é enviado pelo frontend na URL ou no corpo — é extraído pelo backend do claim `tid` do JWT.
- Se qualquer request do módulo export retornar 401, o frontend deve redirecionar para a tela de login e limpar os tokens do storage.

---

#### Convenções de paginação e filtros

O módulo export não possui listagem própria — há apenas o endpoint de geração de PDF. Os `analysisId` são obtidos pelos endpoints do módulo `hub`:

- `GET /v1/hub` — snapshot da última análise (retorna `latestAnalysis.id`)
- `GET /v1/analyses` — histórico das últimas 12 análises (retorna array com `id`, `referenceMonth`, `status`)

Ambos retornam o campo `status` que deve ser checado antes de exibir os botões de exportação.

---

#### Edge cases que o frontend precisa tratar

1. **Análise ainda processando (422):** O status da análise pode ser `pending`, `generating` ou `ready` quando o usuário tenta exportar (ex: página aberta em background enquanto pipeline roda). O frontend deve checar `canExport(analysis.status)` antes de habilitar os botões. Se receber 422, exibir estado explicativo com botão de atualização.

2. **Double-click / múltiplos downloads simultâneos:** O fetch de PDF pode demorar alguns segundos em análises grandes. Desabilitar o botão após o primeiro clique até o blob estar disponível para evitar múltiplos downloads sobrepostos.

3. **Filename ausente no Content-Disposition:** Tratar como fallback caso o header não esteja presente. Usar `aicfo-export.pdf` como nome padrão seguro.

4. **Blob de tamanho zero ou corrompido:** Após receber o blob, verificar `blob.size > 0` antes de criar a URL de objeto. Se zero, tratar como erro interno.

5. **Tenant em modo SHADOW:** No modo SHADOW a análise pode estar com status `ready` (gerada mas não entregue ao cliente). Nesse caso o endpoint retornará 422 pois a DRE pode estar preenchida mas o status semântico não permite exportação pelo cliente. O frontend deve exibir o status atual sem expor a terminologia interna "SHADOW" — usar "Análise em revisão".

6. **Análise no modo `approved` com edições do cliente (ASSISTED):** A análise pode ter `clientEditedNarrative` e `clientEditedActionPlan` preenchidos. O PDF exportado usa os dados originais do pipeline, não as edições textuais do cliente. Se a UX precisar destacar isso, exibir nota informativa na tela de exportação ("O relatório reflete a análise gerada automaticamente").

7. **Revogação de token durante download:** Se o JWT expirar durante um download longo (improvável, mas possível com PDFs grandes em conexões lentas), o browser pode receber um 401 parcial. Tratar qualquer erro durante o `response.blob()` como falha de download e oferecer retry.

8. **Usuário sem permissão (`role: viewer`):** O backend não implementa restrição por role no export nesta versão (Onda 1), mas roles `viewer` são válidos para leitura. Caso futuramente haja restrição, o backend retornará 403. O frontend deve estar preparado para esse código mesmo que hoje ele não ocorra por role.

9. **`analysisId` de outro tenant:** O backend faz lookup com `WHERE id = ? AND tenantId = ?`. Um analysisId válido de outro tenant retorna 404 (não 403) para não vazar a existência do recurso. O frontend não precisa diferenciar — tratar 404 uniformemente.

10. **Múltiplos sabores para o mesmo mês:** Os três sabores (`monthly`, `investors`, `partners`) são gerados on-demand a partir dos mesmos dados. Não há "versão salva" do PDF no servidor — cada request gera o PDF do zero. O frontend não deve cachear o blob entre sessões.
