# ADR-004 — Runtime do Reviewer DeepAgent — Aicfo

> **Status**: aceito
> **Data**: 2026-05-13
> **Autor**: Rafael Novaes
> **Aprovado por**: Mantenedor do Aicfo
> **Template**: `templates/adr-reviewer-runtime.template.md` (Foundry v0.15.0)
> **Substitui**: nenhum
> **Substituído por**: nenhum

---

## Contexto

O Novais Digital Foundry define o **reviewer DeepAgent** como camada de auditoria mensal externa (decisões F17/F18).
O Foundry decide **o quê** auditar (10 SKILL.md em `reviewer/deepagents/skills/`).
Esta ADR decide **como** o reviewer é invocado no Aicfo.

O Aicfo opera como `project_type: agentic_saas` com `ai_enabled: true`. Isso activa todos os checks:
- C3: custo de tokens / preço por análise
- C4: SHADOW antes de cobrar (eval suite LLM)
- C6: Langfuse traces obrigatórios (trace_coverage ≥ 99%)
- C7: prompt versionado com `prompt_hash`

---

## D1 — Local de execução

**Decisão: (a) GitHub Actions — job agendado mensal**

O reviewer roda como job `audit-monthly` em workflow dedicado `.github/workflows/foundry-audit.yml`,
agendado para o primeiro dia útil de cada mês (`cron: '0 9 1 * *'`), com `workflow_dispatch` para auditorias sob demanda.

**Justificativa**: Sem infra extra. Log centralizado. Reproducível. O projeto já tem `foundry-validate.yml` rodando — extensão natural. Para um projeto em SHADOW ainda sem clientes reais, infra extra (cron em servidor dedicado) não se justifica.

---

## D2 — Modelo do DeepAgent

**Decisão: OpenAI `gpt-4.1-mini`** via `DEEPAGENTS_MODEL=gpt-4.1-mini`

**Justificativa**: Custo estimado ~$0.50/auditoria. Suficiente para revisar compliance de Constitution, drift de versão, e spot-check de código. Critério para upgrade: se o reviewer começar a perder violações de C6 (traces sem campos obrigatórios) ou C8 (multi-tenancy) em amostras de código maiores → migrar para `gpt-4.1`.

**Secret necessário**: `OPENAI_API_KEY` em GitHub Actions Secrets.

---

## D3 — Provedor de telemetria

**Decisão: Langfuse cloud** via `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY`

O reviewer lê traces do Langfuse para auditar:
- Cobertura de traces (C6): `trace_coverage_target_pct: 100`
- `prompt_hash` em produção vs eval suite (drift de prompt)
- Distribuição de `outcome_category` (sinal de qualidade)
- Anomalias de custo por outcome (C3)

**Acesso do reviewer**: SDK Langfuse Python dentro do job CI (secrets de leitura apenas).

---

## D4 — Cadência e responsável

| Item | Decisão |
|---|---|
| Cadência | Mensal (1º dia útil) |
| Responsável por agir | Rafael Novaes |
| SLA para violações críticas | 7 dias |
| SLA para avisos | 30 dias |
| Destino do relatório | `docs/foundry/audits/YYYY-MM.md` |

---

## D5 — Scope da auditoria (agentic_saas)

Todos os checks C1–C8 ativos. Checks específicos de agentic:

| Check | O que valida |
|---|---|
| C3.2/C3.3 | Custo de inferência por outcome ≤ 25% do preço |
| C4.2/C4.3 | Eval suite presente e atualizada; `prompt_hash` coerente |
| C6.1/C6.2 | Langfuse traces com campos obrigatórios; coverage ≥ 99% |
| C7.1 | Prompts versionados; LLM isolado em camada própria |
| C8.1/C8.2 | Sem `if (tenantId === ...)` no código de SKUs |
| Drift C9 | `framework_version_required` vs canônico |

---

## Consequências

- Workflow `foundry-audit.yml` será criado em `.github/workflows/`
- Secrets `OPENAI_API_KEY` + `LANGFUSE_PUBLIC_KEY` + `LANGFUSE_SECRET_KEY` precisam estar no GitHub Actions
- Primeiro audit manual pode ser disparado via `workflow_dispatch` antes do automático
- Relatórios ficam em `docs/foundry/audits/` (criar diretório antes da primeira auditoria)

---

*Assinado por: Rafael Novaes — 2026-05-13*
