# Review — export

**Reviewer:** Review Agent (Forge pipeline)
**Data:** 2026-05-12
**Módulo:** `export` (Onda 1, Tier B)
**Spec:** `docs/specs/export.md` (status: **stub**)
**Backend:** `docs/specs/_backend_export.md` (commit `8f51c09`, complete)
**Frontend contract:** `docs/specs/_frontend_export.md` (gerado 2026-05-12)
**Tests:** `docs/specs/_tests_export.md` (6 arquivos, ~30 casos, 1 TEST-DRIFT crítico flagado)

---

## BLOCKERS (impede merge)

- [BLOCKER] **C4 — Status gate frouxo no backend.** O `_tests_export.md` Arquivo 3 (`routes.status-gate.spec.ts`) e Arquivo 5 (caso "terminologia SHADOW") declaram explicitamente que análises com `status` ∈ {`pending`, `generating`, `ready`} devem retornar **422** mesmo quando `dreJson` está presente. O backend atual (`src/export/routes.ts` — vide `_backend_export.md` e nota do Zod schema linha 217 "DRE_NOT_READY — 422 — dreJson ainda null") gate **apenas** pelo `dreJson == null`. Consequência prática: tenant em **modo SHADOW** com análise em `status=ready` recebe o PDF antes da revisão humana, violando o princípio não-negociável **C4 (SHADOW antes de cobrar)**. Os testes `status=generating → 422` e `status=ready (SHADOW) → 422` falham hoje quando `withDre=true`. Correção exigida: trocar a guarda `if (!dreJson)` por `if (!canExport(analysis.status))` reaproveitando o helper já exportado no contract Zod (`EXPORTABLE_STATUSES = ["delivered","approved"]`).

- [BLOCKER] **C2 — Spec em status `stub` sem cláusula de outcome literal.** `docs/specs/export.md` linhas 31-40 declaram explicitamente que a "Cláusula de outcome (C2)", endpoints, eval suite e unit economics serão preenchidos "quando este módulo entrar em desenvolvimento". O módulo **já está em desenvolvimento e implementado** (`_backend_export.md` status: complete, commit `8f51c09`). Sem cláusula assinada, não há base para cobrança auditável dos 3 outcomes (`report_exported_monthly|investors|partners`), e o reviewer DeepAgent externo barra o merge por incoerência entre `status=stub` e backend complete. Correção exigida: rodar `/acme:spec --module export --type platform-sku` antes do merge para preencher cláusula, SLA threshold e edge cases.

---

## WARNINGS (deve corrigir antes de produção)

- [WARNING] **C6 — Telemetria ausente para downloads.** `_backend_export.md` descreve renderização determinística sem chamada LLM, mas Constitution C6 exige instrumentação Langfuse "para todo outcome auditável" — e os 3 outcomes (`report_exported_*`) são auditáveis por definição (são entregáveis cobráveis). Sem span/trace, não há como provar quantos relatórios foram entregues, em qual sabor, com qual latência. Gap reportado em `_tests_export.md` Gaps §4 e §9. Adicionar trace mínimo: `trace.start({ name: "export.report.generate", input: { type, analysisId }, metadata: { sku: "monthly-analysis", outcomeType: "report_exported_"+type } })` antes do generator e `span.end({ output: { bytes: payload.length, filename }, costBrl: 0 })` após drain.

- [WARNING] **Auditoria de download ausente.** Os outcomes `report_exported_*` são entregáveis comerciais — quem baixou, quando, qual sabor. Sem tabela `export_audit` (ou campo `lastExportedAt` em MonthlyAnalysis) é impossível auditar disputas de cobrança. Reportado em `_tests_export.md` Gaps §9.

- [WARNING] **Rate limit ausente.** Geração de PDF consome CPU (pdfkit + paginação + 3 sabores on-demand). Sem rate limit por tenant, um cliente pode amplificar custo do backend disparando downloads em loop. Recomenda-se `@fastify/rate-limit` com 30 req/min por tenant em `/analysis/:id/export/:type`. Reportado em `_tests_export.md` Gaps §10.

- [WARNING] **KPIs do sabor `investors` não enumerados.** Spec stub diz apenas "KPIs comerciais"; `_backend_export.md` cita "receita, EBITDA, margens"; handoff `_frontend_export.md` repete o mesmo trio. Sem lista exaustiva e fórmulas assinadas (LTV/CAC? Growth MoM? Burn rate? Runway?), é impossível auditar o conteúdo do PDF investidores contra a cláusula de outcome. Resolver junto com o BLOCKER C2 (rodar `/acme:spec`).

- [WARNING] **Excel declarado, não implementado.** Spec promete "PDF/Excel" (linha 15) — apenas PDF foi entregue. Ou remover Excel do escopo Onda 1 explicitamente na spec (preferido), ou adicionar Excel ao backend antes de promover. Reportado em `_tests_export.md` Gaps §6.

- [WARNING] **Fórmula `partners.distribuicaoPotencial` não ratificada.** Backend usa `max(0, lucroLiquido − amortizacaoDividas − capex)`. Spec não menciona impostos sobre distribuição nem reserva legal. Risco regulatório/contábil: o cliente pode usar o número como base de saque e ser autuado. Resolver junto com `/acme:spec` e incluir disclaimer literal no PDF (já mencionado em `_frontend_export.md` linha 390 mas não verificado no generator). Reportado em `_tests_export.md` Gaps §8.

- [WARNING] **Inconsistência semântica 403 vs 404.** `_frontend_export.md` lista ambos: 403 ("análise pertence a outro tenant") e 404 ("ou de outro tenant"). Os testes (`routes.multitenancy.spec.ts`) afirmam corretamente que cross-tenant deve retornar 404 (nunca 403) por C8. Spec OpenAPI deve **remover** a resposta 403 do contract — manter 403 documentado abre porta para frontend tratar diferente e vazar existência de recurso. Manter 403 apenas para futuro role-gating (`viewer`), com `detail` claramente distinto.

---

## SUGGESTIONS (melhoria opcional)

- [SUGGESTION] Mover `EXPORTABLE_STATUSES` e `canExport()` do `_frontend_export.md` Zod schema para `src/persistence/analysis-status.ts` e reusar **a mesma constante** no backend route, frontend e generator — evita drift futuro entre as 3 camadas.

- [SUGGESTION] Sanitizar `referenceMonth` com regex `^\d{4}-\d{2}$` antes de interpolar em `Content-Disposition` (o teste `routes.edge-cases.spec.ts` defende contra response-splitting, mas a defesa-em-profundidade no backend é mais segura que confiar na factory).

- [SUGGESTION] Stream verdadeiro (chunked) em vez de buffer drenado: `reply.send(generateReport(...))` direto, para PDFs grandes (>10MB) não inflarem heap.

- [SUGGESTION] Adicionar header `X-Request-Id` na response — já listado no OpenAPI (`_frontend_export.md` linha 73) mas não confirmado no backend. Útil para correlacionar com Langfuse trace (quando C6 for resolvido).

- [SUGGESTION] Eval suite ≥10 casos por outcome (`evals/export/cases/*.yml`) cobrindo: lucro negativo, distribuição zero, partners sem pró-labore, investors sem EBITDA, monthly com 1 action por horizonte vs 5 actions por horizonte. Conforme `_tests_export.md` Gaps §1.

- [SUGGESTION] Documentar no handoff que o PDF reflete **dados originais** mesmo quando há `clientEditedNarrative`/`clientEditedActionPlan` (edge case #6 do `_frontend_export.md` linha 462). Considerar uma flag `?useClientEdits=true` em iteração futura.

---

## APROVADO PARA MERGE: Não