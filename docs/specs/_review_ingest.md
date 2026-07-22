# Review — Módulo `ingest`

**Reviewer:** Review Agent (orchestrated)
**Data:** 2026-05-12
**Escopo:** `docs/specs/ingest.md` + `_backend_ingest.md` + `_frontend_ingest.md` + `_tests_ingest.md`
**Constitution version:** 0.2.0

---

## Contexto

A spec `docs/specs/ingest.md` está declarada com `status: "stub"` (linha 6). A própria spec admite que o detalhamento completo (cláusula de outcome C2, endpoints, eval suite, unit economics C3, configuração por tenant C8) será gerado via `/novais-digital:spec --module ingest` "quando este módulo entrar em desenvolvimento (Onda 1)". Entretanto, o backend já está marcado como `complete` (commit 46f94b0) e o contrato + suite de testes foram gerados — ou seja, o módulo entrou em desenvolvimento **sem que a spec saísse de stub**. A revisão prossegue ancorando-se nas 3 regras de outcome declaradas na spec (R1/R2/R3) + 4 fontes (R5), conforme `_tests_ingest.md` já fez.

---

## BLOCKERS (impede merge)

- [BLOCKER] **Spec em status `stub` — cláusula de outcome contratual (C2) ausente.** `docs/specs/ingest.md` linhas 6 e 31-40 explicitam que cláusula de outcome, endpoints, eval suite mínima (≥10 casos por outcome), unit economics e configuração por tenant **ainda não foram geradas**. O módulo viola C2 (Outcome-first) e C1 (Diagnose-before-design): o backend foi implementado e contratado para frontend sem o artefato canônico que sustenta o resto. Rodar `/novais-digital:spec --module ingest` antes de promover o merge.
- [BLOCKER] **Critério de pronto da spec não declarado.** A spec stub não define "critério de pronto" (DoD) verificável. Não há como afirmar que o backend satisfaz a spec porque a spec não declara o que é estar pronto. Decorrência direta do item acima.
- [BLOCKER] **Eval suite mínima (≥10 casos por outcome) ausente — viola convenção Foundry.** Conforme `ingest.md` linha 37 ("Eval suite mínima (≥10 casos por outcome)") e gap #6 do `_tests_ingest.md`, não existe `evals/ingest/cases/` versionado. Sem eval suite, `/novais-digital:promote` está bloqueado (gate obrigatório de C4).
- [BLOCKER] **C8 (multi-tenancy) — `tenantId` em queries não pôde ser verificado no service.** Os testes (`service.test.ts` linhas 850-884) afirmam que o LedgerEntry persistido carrega `tenantId` do caller e que o job enfileirado carrega o mesmo tenantId. Porém, o `_backend_ingest.md` não documenta nenhum índice/where-clause garantindo isolamento em **leituras** posteriores (ex.: re-import lendo `MonthlyAnalysis` no `findUnique` da transação). O contrato Prisma do `findUnique` (service.test.ts linha 817-833) busca por `id` da analysis sem cláusula `tenantId`, o que é potencialmente vazável. Exigir que toda query mostrada na implementação use `where: { tenantId, referenceMonth }` ou que o índice único composto inclua `tenantId`. Esclarecer no `_backend_ingest.md` e adicionar teste explícito que falhe se outro tenant conseguir ler uma analysis.
- [BLOCKER] **C4 (SHADOW antes de cobrar) — modo do tenant não respeitado nas mutações.** `_backend_ingest.md` lista `subscription` sendo carregada na transação (service.test.ts linha 703, 675) mas o `_backend_ingest.md` (seção Comportamento) **não descreve nenhuma bifurcação por `mode` (SHADOW | ASSISTED | AUTONOMOUS)**. Em SHADOW, o resultado é gerado mas **não entregue ao cliente**; em ASSISTED, gerado e entregue. A resposta HTTP atual (`IngestResponse`) é a mesma para todos os modos — o que viola C4 se o cliente em SHADOW estiver pagando pelo outcome. Gap #8 do `_tests_ingest.md` já reconhece isso ("o service não bifurca comportamento por modo"). Resolver antes do merge: ou documentar formalmente que ingest é pre-shadow (não cobrável por si só, só o outcome final do hub é) ou implementar a bifurcação.
- [BLOCKER] **C6 (Telemetry-by-default) — sem trace Langfuse no service.** O `_backend_ingest.md` não menciona instrumentação Langfuse em nenhum ponto do pipeline. Gap #7 do `_tests_ingest.md` alega que "o service atual não chama LLM, então C6 não se aplica diretamente ao ingest" — isso é **incorreto à luz da Constitution**. C6 exige trace para que **outcomes auditáveis** existam; o ingest cria o `MonthlyAnalysis` que é a raiz auditável da subscription. Sem `trace.start({ name: "ingest", input, metadata })` envolvendo o service, não há rastro auditável do outcome `ingest_completed/partial/failed` para o reviewer mensal DeepAgent. Adicionar instrumentação no service.

---

## WARNINGS (deve corrigir antes de produção)

- [WARNING] **Resposta HTTP 200 para `outcome: "failed"` é ambígua.** `_frontend_ingest.md` linha 629 declara explicitamente que "Retornam `200` independentemente do outcome (completed/partial/failed) — erros de negócio não são 4xx". Isso é defensável, mas o `analysisId: ""` (string vazia) como sinal de falha (linha 686-694) é frágil: linguagens com tipagem estrita no front podem aceitar `""` como ID válido. Trocar por `analysisId: null` (e atualizar `IngestResponseSchema` para `z.string().uuid().nullable()`).
- [WARNING] **R7 (idempotência) — apaga `NarrativeCard` e `ActionPlanItem` silenciosamente.** O teste de re-import (service.test.ts linha 814-833) valida que 3 `deleteMany` rodam: ledger, narrative, action plan. O handoff frontend (linha 919-922) confirma esse comportamento, mas o backend doc não declara o gate de confirmação humana. Isso pode destruir narrativas já revisadas pelo Rafael em modo SHADOW. Recomenda-se: gate explícito "force=true" no body do request OU resposta 409 quando já existe analysis (frontend decide reimportar com `?force=true`). Hoje a UI é responsável (handoff linha 920) — o backend deveria também proteger.
- [WARNING] **Validação de input — `referenceMonth` futuro não bloqueado.** `_frontend_ingest.md` edge case #8 (linha 950) lista isso mas joga a responsabilidade para a UI. O backend deveria validar — um cliente importando "2099-12" produz lixo no banco. Adicionar regra: `referenceMonth ≤ currentMonth + 1` no Zod `ReferenceMonthSchema` ou no service.
- [WARNING] **Threshold de 50 lançamentos hardcoded.** R1 da spec é "≥50 lançamentos". O número é **mágico** — não está declarado em `tenant-config` nem deriva de C3 (unit economics). Diferentes tiers de subscription podem ter thresholds diferentes (ex: tier light = ≥20). Exteriorizar via `tenant-config` (C8).
- [WARNING] **Encoding (gap #3 do `_tests_ingest.md`) — crítico para ICP.** Planilhas BR legadas vêm em Latin1/CP1252; nenhum teste cobre. Como o ICP (CEO de PME) **vai** enviar arquivos do contador, este risco precisa de teste antes de promover ASSISTED. Mover de "Gap" para WARNING ativo.
- [WARNING] **C3 (custo ≤ 25% do preço) — não auditável.** `docs/specs/ingest.md` linha 38 lista "Unit economics se houver custo de inferência relevante" como pendente. Embora o ingest em si não invoque LLM, ele dispara o pipeline de classification (LLM) via BullMQ. O custo agregado por ingest precisa ser computado. Documentar mesmo que seja "custo = 0 BRL no ingest, custo total é repassado para classification".
- [WARNING] **Concorrência (gap #9) — race condition em `deleteMany + createMany`.** Dois uploads simultâneos para o mesmo `(tenantId, referenceMonth)` podem deixar o estado inconsistente. Os testes assumem que `$transaction` serializa, mas o nível de isolamento Prisma default não garante isso. Adicionar lock pessimista ou índice único `(tenantId, referenceMonth)` + tratativa de conflito.
- [WARNING] **PDF OCR (gap #2) — TEST-DRIFT confirmado.** A spec declara "PDF do contador (OCR + tabela)" (linha 15) mas backend usa `pdf-parse` (texto). Para PDFs escaneados (cenário comum em PMEs), retornará `failed`/`partial`. Ou ajustar spec ("PDFs texto-selecionáveis") ou adicionar OCR (Tesseract / Textract). Decisão precisa virar ADR antes de produção.

---

## SUGGESTIONS (melhoria opcional)

- [SUGGESTION] **`requestId` no `IngestResponse`** — está no OpenAPI (linha 70-73) mas não no `IngestResponseSchema` do Zod (linha 483-507). Sincronizar Zod com OpenAPI; hoje frontend lê campo que o schema nega.
- [SUGGESTION] **`ProblemDetail.requestId` é `optional` no Zod** (linha 575) mas `required` no OpenAPI (linha 134). Padronizar como required, é correlação fundamental com logs.
- [SUGGESTION] **Detecção de encoding** poderia rodar antes do parser (chardet/jschardet) e logar via Pino — útil para diagnóstico mesmo antes de virar teste.
- [SUGGESTION] **`OUTCOME_LABEL` (linha 598)** está no contrato Zod (lado backend) mas é puramente UI. Mover para o handoff frontend; o backend não deveria carregar copy.
- [SUGGESTION] **Limite superior de entradas (gap #5)** — definir `MAX_ENTRIES_PER_INGEST` (ex: 50_000) para mitigar DoS. Documentar no spec e validar no Zod.
- [SUGGESTION] **Mistura de locales no mesmo arquivo (gap #4)** — caso real quando usuário cola de fontes diferentes. Tratar como `partial` com `orphanCount` específico.

---

## TEST-DRIFTs reportados pelo `_tests_ingest.md`

O `_tests_ingest.md` é honesto e marca explicitamente:
- **TEST-DRIFT linha 937** (routes.integration.test.ts): "Mock auth — assume routes use a hook that injects tenantId from JWT. Se o auth helper tiver nome diferente, ajustar." → WARNING acima já cobre.
- **TEST-DRIFT linha 1092** (gap #2): comportamento esperado para PDF escaneado não tem contrato explícito. → WARNING acima já cobre.

Demais gaps (#1, #3-#10) tratados como WARNING/SUGGESTION acima.

---

## APROVADO PARA MERGE: Não