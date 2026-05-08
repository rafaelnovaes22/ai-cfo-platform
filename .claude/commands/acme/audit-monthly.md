---
description: Auditoria mensal — sample de 5-10% de runs por subscription em ASSISTED/AUTONOMOUS, detecta drift de prompt/dados/agreement/custo, audita correspondência prompts/{id}/v* ↔ baseline-cost. Output: docs/forge/audits/{YYYY-MM}.md no formato consumido pelo reviewer DeepAgent. Pode disparar rebaixamento automático em SLA breach severo.
allowed-tools: [Read, Write, Glob, Grep]
arguments:
  required:
    - month
  optional:
    - subscription_filter
    - sample_pct
    - auto_rollback_on_breach
forge_command_version: 0.1.0
linked_principles: [C1, C3, C4, C6, C7, C8]
invokes_skills:
  - "@offerings-loader"
output_artifact: docs/forge/audits/{YYYY-MM}.md
trace_required: true
deep_agent_consumable: true
---

# /acme:audit-monthly — Auditoria 5-10%

## Propósito

Roda **continuous validation** sobre tudo o que está em produção (modos ASSISTED/AUTONOMOUS):

1. **Sample 5-10%** de runs por subscription do mês — analisa concordância humano/agente em amostra (auditável manualmente)
2. **Drift detection** — `prompt_hash` em produção mudou desde último `/acme:eval`? Distribuição de inputs deslocou?
3. **C3 audit** — `recalc_unit_economics_required` em aberto? Custo médio por outcome vs threshold?
4. **C6 audit** — % de runs com trace válido (alvo 100%)
5. **C7/C8 audit estrutural** — hash de imports SDK fora de `src/llm/adapters/`? hardcode de tenant?
6. **C4 SLA breach** — agreement_rate caiu abaixo de threshold em N dias seguidos?

Output é **machine-readable**: o reviewer DeepAgent (Forge-3) lê e compara com `reviewer/output-schema.json`. Auditoria mensal é o ciclo de feedback que mantém o framework íntegro.

## Pre-conditions

1. Tracing histórico disponível (Langfuse/equivalente) cobrindo o `--month`
2. Subscriptions ativas em ASSISTED/AUTONOMOUS detectáveis
3. Diretório `docs/forge/audits/` gravável
4. Templates de auditoria disponíveis (`templates/monthly-audit.template.md`)

## Inputs

```yaml
month: 2026-04   # YYYY-MM
# opcionais
subscription_filter: <slug | regex>   # default: todas ativas
sample_pct: 7                          # default 7% (faixa 5-10)
auto_rollback_on_breach: false         # default false; se true, dispara rollback em SLA breach severo
```

## Execução

```
1. Trace start

2. Helpers:
   - @offerings-loader (mapear todos artifact_id e lifecycle_stage)

3. Listar subscriptions em ASSISTED/AUTONOMOUS no mês

4. Para cada subscription:
   4.1 Coletar runs do mês via tracing provider
   4.2 Sample uniforme de sample_pct dos runs (mínimo 30 runs; senão all)
   4.3 Para cada run no sample, buscar par humano (se disponível) para concordância
   4.4 Calcular métricas: agreement_rate, latency p50/p95, cost p50/p95, error_rate
   4.5 Comparar contra spec.c4_thresholds → flag breach se aplicável
   4.6 Registrar drift signals: prompt_changed_during_month, distribution_shift_score

5. Auditoria estrutural (independente de sample):
   - Listar prompts/{id}/v*/system.md → conferir cada com baseline-cost-*.md (recalc_required)
   - Lint regex: imports de SDK fora de src/llm/adapters/
   - Lint regex: tenant hardcode em src/skus/, src/products/
   - Listar runs sem trace (alvo: 0)

6. Calcular flags consolidadas:
   - critical_findings: lista de violações que exigem ação
   - sla_breaches: subscriptions com agreement abaixo de threshold por ≥ 3 dias do mês
   - drift_alerts: prompt_hash desalinhado entre prod e último eval

7. Se auto_rollback_on_breach E sla_breach severo (>5 dias breach):
   - Para cada subscription afetada → invocar /acme:promote --to_mode=rollback
   - rollback_reason: sla_breach
   - Registrar em audit + notificar

8. Persistir docs/forge/audits/{YYYY-MM}.md (template: monthly-audit.template.md)

9. Trace end + output structured
```

## Estrutura canônica do audit (consumido pelo DeepAgent)

```markdown
---
$schema: reviewer/output-schema.json
audit_period: 2026-04
generated_at: 2026-05-01T08:00
generated_by: /acme:audit-monthly@0.1.0
sample_pct: 7
total_subscriptions_audited: 12
total_runs_in_month: 18420
sample_size: 1290
constitution_version: 0.2.0
manifest_version: 0.2.0
forge_command_version: audit-monthly@0.1.0
---

## Sumário executivo
{2-3 linhas}

## Findings críticos
{lista numerada com {principle_violated, severity, subscription_id, evidence_path}}

## Auditoria por princípio
### C1 — Diagnose-before-design
- Total agentes em produção: 12
- Com diagnostic.md referenciado: 12 (100%)
- Findings: nenhum

### C2 — Outcome-first
- spec.outcome_clause_hash == prompt.outcome_clause_hash em N artefatos: 11/12
- Finding: artifact_X tem hash divergente — investigar

### C3 — Cost ≤ 25%
- Subscriptions com c3_check.status==viable: 10/12
- Subscriptions com tight: 2/12
- Findings: subscription_Y custo p95 = 28% (acima do teto)

### C4 — SHADOW antes de cobrar
- Promoções sem 5 gates passando: 0
- SLA breaches ≥3 dias: 1 (subscription_Z agreement caiu pra 0.79; threshold 0.85)

### C5 — Three-tier
- Skills L0 com helper_pattern: bmad: 3/3 (100%)
- Skills L1/L2 com helper_pattern: none: 6/6
- Cross-tier reads detectados: 0

### C6 — Telemetry
- Runs com trace: 18345/18420 = 99.6%
- Finding: 75 runs sem trace concentrados em subscription_W (investigar adapter)

### C7 — Portability
- Imports SDK fora de src/llm/adapters/: 0 (lint regex)
- Adapters por provider: anthropic, openai

### C8 — Anti-customização heroica
- Hardcode `if (tenantId === ...)` detectado: 0
- Pastas clients/{nome}/ ou tenants/{nome}/ em src/skills,src/skus: 0

## Sample analysis (5-10%)
- Total amostrado: 1290 runs
- Pares humano/agente disponíveis: 1108
- Agreement rate amostral: 0.89
- Disagreements top-50 documentados em: docs/forge/audits/2026-04-disagreements.md

## Drift signals
| subscription | prompt_hash drift | distribution_shift_score | flag |
|---|---|---|---|
| acme-001 | none | 0.04 | green |
| beta-002 | hash mudou em 2026-04-15 sem novo eval | 0.12 | yellow |

## Recomendações
1. ...
2. ...

## Auto-rollbacks executados
{lista; vazia se auto_rollback_on_breach=false}
```

## Output structured (return value)

```yaml
command: /acme:audit-monthly
status: ok | warn | error
audit_period: 2026-04
audit_path: docs/forge/audits/2026-04.md
total_subscriptions_audited: 12
total_runs_in_month: 18420
sample_size: 1290
findings:
  critical: 1
  warnings: 4
  info: 8
violations_by_principle:
  c1: 0
  c2: 1
  c3: 1
  c4: 1
  c5: 0
  c6: 1
  c7: 0
  c8: 0
sla_breaches: 1
auto_rollbacks_executed: 0
drift_alerts: 1
trace_id: <>
generated_at: 2026-05-01T...
deep_agent_ready: true
```

## Verification gate

- [x] `month` no formato YYYY-MM e dentro de janela auditável (mês fechado)
- [x] Cada subscription ativa no mês foi processada (`subscription_filter` respeitado)
- [x] Sample size >= max(30, sample_pct × total_runs); se total_runs < 30, all
- [x] Auditoria por princípio C1-C8 presente, mesmo que `findings: 0`
- [x] `deep_agent_ready: true` (formato compatível com `reviewer/output-schema.json`)
- [x] Disagreements documentados em arquivo separado se > 50
- [x] Auto-rollbacks (se executados) referenciados na seção dedicada
- [x] Arquivo persistido em `docs/forge/audits/{YYYY-MM}.md`
- [x] Trace_id não-nulo

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Sample 1% pra ir mais rápido" | Cobertura insuficiente; reviewer DeepAgent rejeita | Faixa 5-10%; abaixo disso = `error: sample_below_minimum` |
| "Auditoria do mês corrente (não fechado)" | Mês aberto = números mudam após gerar relatório; quebra reproducibilidade | Bloquear se `month >= mês corrente`; só meses fechados |
| "C8 audit é caro, pulo um mês" | Drift de C8 é silencioso; salta = chance de descobrir tarde | C8 audit estrutural sempre; baseado em lint regex (rápido) |
| "Auto-rollback default true pra ser proativo" | Rollback sem aviso humano gera incidente comercial | Default false; ativar exige aprovação ad-hoc do mantenedor |
| "Disagreements? Mostro só top-10, resto sumariza" | Reviewer perde sinal pra detectar padrão | Top-10 inline; resto em arquivo separado linkado |
| "C6 99% de trace tá ótimo, ignoro o 1%" | Os 1% sem trace tendem a concentrar em subscription com bug | Investigar agrupamento; flag se >X runs em mesma subscription |
| "Format livre, DeepAgent adapta" | Reviewer espera schema estrito | Mandatório seguir `reviewer/output-schema.json` |
| "Drift de prompt sem novo eval = só warning" | Drift sem eval = produção rodando com qualidade não-validada | Se hash drift > 7 dias sem eval → finding **crítico**, não warning |

## Saída de erro estruturada

```yaml
command: /acme:audit-monthly
status: error
error: <enum>
hint: <ação>
trace_id: <>
```

`error` ∈ `pre_conditions_failed` | `month_not_closed` | `sample_below_minimum` | `tracing_provider_unreachable` | `template_missing` | `subscriptions_dir_unreadable` | `audits_dir_unwritable` | `auto_rollback_blocked_no_approval`.

## Cadência

| Cadência | Trigger |
|---|---|
| **Mensal** (default) | Hook `monthly-audit-trigger` em Forge-4, ou cron, ou manual |
| **Pós-incidente** | `--month=YYYY-MM --subscription_filter=X` ad-hoc |
| **Pré-release** | Antes de cortar release MAJOR/MINOR do framework |

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-2 onda 3 (validation) |
