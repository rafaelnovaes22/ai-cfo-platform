# Review — hub

**Módulo:** hub
**Onda:** 1
**Tier:** B
**Status spec:** stub (outcomes formais declarados, sem detalhamento)
**Status backend:** complete (commit 8f51c09)
**Revisado em:** 2026-05-12
**Constitution version:** 0.2.0

---

## Contexto

A spec `docs/specs/hub.md` está marcada como **stub**, declarando apenas os 3 outcomes formais (`hub_loaded`, `history_listed`, `new_analysis_triggered`) e remetendo a detalhamento futuro via `/novais-digital:spec --module hub` (cláusula C2, eval suite, riscos, config por tenant). O backend (`_backend_hub.md` + `src/hub/routes.ts`) foi implementado **antecipando** as regras dos dois primeiros outcomes; o terceiro (`new_analysis_triggered`) **não tem endpoint correspondente**. O test plan (`_tests_hub.md`) declara explicitamente 7 gaps e adota MODE: REINFORCE.

---

## BLOCKERS (impede merge)

- [BLOCKER] **Outcome `new_analysis_triggered` da spec não tem endpoint correspondente no backend.** A spec lista 3 outcomes formais; o backend implementa apenas 2 (`GET /hub` → `hub_loaded`, `GET /analyses` → `history_listed`). Não há `POST /hub/new-analysis`, `POST /analyses` nem nenhum trigger documentado em `_backend_hub.md`. O gap #1 de `_tests_hub.md` reconhece isso explicitamente ("Sem rota, não há o que testar"). Isso viola o **critério de pronto** (outcome formal da spec ausente) e fere **C2 (outcome-first)** — não se pode declarar `new_analysis_triggered` como outcome e entregar produto sem ele. Decisão necessária: (a) implementar endpoint neste módulo, ou (b) re-spec formal movendo `new_analysis_triggered` para o módulo `ingest` (que já tem `POST /ingest/*`) com ADR justificando, ou (c) downgrade da spec removendo o outcome se ele for redundante com ingest. Sem uma dessas três ações, merge não pode prosseguir.

---

## WARNINGS (deve corrigir antes de produção)

- [WARNING] **Spec em status `stub` é inadequada para promoção além de SHADOW.** A spec não define `c4_thresholds` (agreement_rate, latency_p95, cost_per_outcome, min_run_count, min_window_days). Sem SLA pré-contratada, `/novais-digital:promote shadow_to_assisted` bloqueia (gate G3 de C4). Aceitável para merge inicial em modo SHADOW; **obrigatório** rodar `/novais-digital:spec --module hub` + `/novais-digital:sla-threshold` antes de ASSISTED.

- [WARNING] **Cláusula de outcome cobrável (C2) ausente.** Gap #4 de `_tests_hub.md` confirma. A spec stub não define `outcome_clause` literal — sem isso, contrato com cliente não pode mencionar Hub como entregável cobrável. Hub é apenas "leitura/agregação" de outcomes de outros módulos, mas mesmo assim deve declarar SLA de disponibilidade (ex.: latency p95 < 500 ms) para ser auditável.

- [WARNING] **CTAs em modo `shadow` dependem exclusivamente do frontend.** O handoff (`_frontend_hub.md` §"Edge cases", item 4) instrui o frontend a "esconder ou bloquear CTAs" quando `subscription.mode === "shadow"`, mas o backend **expõe os dados completos** (DRE, cards, actionPlan) independentemente do modo. Isso viola o espírito do **C4** ("SHADOW antes de cobrar / não entregar ao cliente"): se o frontend tiver bug ou for contornado, o cliente vê análise não-validada. Mitigação recomendada: backend retornar `latestAnalysis` com `dre/cards/actionPlan` **redacted/null** quando `subscription.mode === "shadow"` E o usuário autenticado **não for** o operador humano (Rafael). Defesa em profundidade — não confiar no frontend para enforcement de C4.

- [WARNING] **Paginação fixa de 12 sem cursor é aceitável para v1, mas precisa ADR ou nota de roadmap.** Gap #6 de `_tests_hub.md` reconhece. O handoff diz "produto v1" no OpenAPI description, ok. Falta apenas registrar como decisão arquitetural — abrir nota em `docs/adr/` ou ticket explicitando que v2 reabre o tópico (clientes com >12 meses de histórico não conseguirão consultar).

- [WARNING] **R5 / EC4 / EC5 testam comportamento do payload mas não há teste de defesa do C4 backend-side.** Como o backend hoje **não esconde** dados em modo shadow (ver warning anterior), os testes não validam isolamento de modo — apenas que o campo `subscription.mode` é serializado. Se a recomendação acima for adotada, novos casos de teste são necessários.

- [WARNING] **TEST-DRIFT potencial entre spec stub e backend (gap #7).** A spec menciona "Plano 3-horizontes" na home sem precisar se são items individuais ou summary. Backend devolve summary agregado. Aceitável enquanto stub; quando spec for promovida, validar conformidade.

- [WARNING] **R1 do test plan assume `narrativeCards` como nested model do Prisma (`include`), mas isso não é validado no review da camada de persistência.** Se `monthlyAnalysis.findFirst` não fizer `include: { narrativeCards: true, actionItems: true }`, o handler quebra silenciosamente (cards vazio, actionPlan null). Mock dos testes cobre o caso happy path mas não detecta esquecimento do `include`. Sugerir teste adicional que verifique o argumento `include` passado ao Prisma.

---

## SUGGESTIONS (melhoria opcional)

- [SUGGESTION] **Adicionar header `X-Request-Id` explicitamente nos testes.** O OpenAPI declara o header em ambos endpoints, mas nenhum teste em `_tests_hub.md` valida sua presença. Mesmo com `requestId` no body, vale validar o header HTTP.

- [SUGGESTION] **Adicionar teste de erro 500.** Os testes cobrem 200 e 401, mas não simulam falha do Prisma (ex.: `findFirst.mockRejectedValue(new Error("db down"))`) para validar o `ProblemDetail` com `status: 500` declarado no OpenAPI.

- [SUGGESTION] **Considerar mover helpers `centsToBrl`, `decimalToPercent`, `formatReferenceMonth` do Zod schema para um arquivo `helpers.ts` separado.** Helpers de UI no schema Zod confundem responsabilidades — schema é contrato; formatação é apresentação. Frontend pode consumir como utility puro.

- [SUGGESTION] **EC2 (DRE null) é semanticamente ambíguo.** Backend retorna `dre: null` para análise em draft, mas a OpenAPI marca `dre` como `required` em `LatestAnalysis`. Manter o `nullable: true` está ok, mas vale documentar no handoff quando exatamente cada estado ocorre (`pending` vs `generating` vs `ready`) e qual delas implica `dre = null`.

- [SUGGESTION] **Helper `formatReferenceMonth` constrói `Date` com `Number(month) - 1, 1`** — pode dar problemas com timezone do browser para usuários em fusos a oeste de UTC se renderizados em horário próximo à virada de dia. Usar `Date.UTC(...)` ou `Intl.DateTimeFormat` direto sobre string YYYY-MM. Baixa prioridade pois o impacto visual é mínimo.

- [SUGGESTION] **Adicionar teste de "tenant alheio com ID válido na URL".** R11 cobre `?tenantId=X` ignorado, mas vale teste com JWT do tenant B tentando acessar `/analyses/{id}` de tenant A (defesa de C8 via path param). Se o endpoint não aceitar id no path hoje, marcar como roadmap.

---

## Constitution check (resumo)

| Princípio | Status | Observação |
|---|---|---|
| C1 (diagnose-before-design) | N/A | Módulo é agregador downstream — diagnóstico ocorre em ingest/classification |
| C2 (outcome-first) | WARNING | Outcome `new_analysis_triggered` declarado sem endpoint → ver BLOCKER; cláusula formal ausente (stub) |
| C3 (custo ≤ 25%) | OK | Hub é leitura determinística — sem custo de inferência; não impacta unit economics |
| C4 (SHADOW antes de cobrar) | WARNING | Enforcement de modo shadow delegado ao frontend → defesa em profundidade backend recomendada |
| C5 (three-tier context) | OK | `_backend_hub.md` lê apenas L2 (Analysis/Subscription do tenant); sem violação de hierarquia |
| C6 (telemetry-by-default) | N/A (confirmado) | Sem chamada LLM no Hub; trace Langfuse não obrigatório. Sugerir trace de latência via Pino + métricas Fastify para audit |
| C7 (portability) | N/A | Sem SYSTEM_PROMPT — Hub não consome LLM. Nenhum import direto de `@anthropic-ai/sdk` esperado em `src/hub/**` |
| C8 (anti-customização heroica) | OK | Multi-tenancy via `req.auth.tenantId` (JWT claim); nenhum hardcode de tenant nos testes (`TENANT_A`/`TENANT_B` constantes); R6/R11 cobrem isolamento |

---

## Engenharia (resumo)

- Validação de input em rotas: endpoints são GET sem body/query params relevantes — validação minimal ok. Query params espúrios (`?tenantId=`, `?limit=`) são corretamente ignorados (R9, R11 cobrem).
- Paginação fixa 12 sem cursor: aceito para v1 com WARNING para v2.
- Multi-tenancy: bem coberto (R6, R11).
- Edge cases: bem cobertos (EC1-EC9: tenant novo, DRE null, actionPlan null, valores negativos, datas null, costCents null, totalImpactCents negativo).
- Cobertura de erros HTTP: 401 coberto; 500 não coberto (sugestão).
- Defesa contra TEST-DRIFT: test plan declara MODE: REINFORCE e gaps explícitos, alinhado com a natureza stub da spec.

---

## APROVADO PARA MERGE: Não

Razão: BLOCKER de outcome `new_analysis_triggered` sem endpoint correspondente impede declarar critério de pronto satisfeito. Necessário decidir (a) implementar, (b) re-spec ADR movendo para `ingest`, ou (c) remover outcome da spec via re-emissão. Os demais WARNINGS são corrigíveis em PR de follow-up antes de promoção SHADOW→ASSISTED, mas o BLOCKER acima impede merge do estado atual sem decisão arquitetural.

APROVADO PARA MERGE: Não
