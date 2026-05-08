---
name: diagnostic-runner
description: Executa roteiro estruturado de diagnóstico Fase 0 com o interlocutor (CEO, decisor) — qualifica problema, mede baseline humano, propõe outcome contratual, valida ICP fit e gera relatório persistido. Implementa C1 (diagnose-before-design) e abre C2 (cláusula de outcome). Critério: relatório Fase 0 estruturado em ≤ 10 minutos de sessão guiada.
tier: 2
vocabulary_aliases: [L1, Tactical, Meso]
linked_principles: [C1, C2]
helper_pattern: none
cache_strategy: none
reads_from_tier: [1, 2]
must_not_read: [3]
requires_helper:
  - skill: company-dna
    field: dna
    optional: false
  - skill: icp-loader
    field: icp
    optional: false
  - skill: offerings-loader
    field: offerings
    optional: false
version: 0.1.0
activation:
  paths:
    - docs/clients/*/diagnostic.md
    - docs/clients/*/diagnostic-*.md
    - templates/diagnostic-spec.template.md
  keywords: [diagnose, diagnóstico, Fase 0, qualificação, cláusula de outcome, problema declarado]
  explicit_invocation: "@diagnostic-runner"
parameters_required:
  - client_id
  - interlocutor_role
  - declared_problem
parameters_optional:
  - session_minutes
  - industry
  - referrer
---

# diagnostic-runner — Skill Tier 2 (Tático)

## Propósito

Conduz uma **sessão guiada de diagnóstico Fase 0** com o decisor do cliente, produzindo relatório estruturado que satisfaz **C1** (todo agente em produção tem `diagnostic.md` referenciado) e **abre C2** (cláusula de outcome em forma preliminar). É a porta de entrada do pipeline `/acme:diagnose → /spec → ... → /promote`.

Esta skill **não vende, não arquiteta, não promete tecnologia**. Ela qualifica: vale a pena resolver? cliente cabe no ICP? baseline humano declarado? outcome possível?

## Quando ativa

1. **Path-scoped** — turno toca `docs/clients/{client}/diagnostic*.md` ou template
2. **Keyword-scoped** — termo de `activation.keywords`
3. **Explícita** — `@diagnostic-runner client_id=acme interlocutor_role=ceo declared_problem="follow-up de propostas se perde"`
4. **Slash command** — invocada por `/acme:diagnose` (Forge-2)

## Inputs Tier 1 (via helper pattern)

| Helper | Por que precisa |
|---|---|
| `@company-dna` | Garante que diagnóstico está alinhado ao north-star da organização provedora |
| `@icp-loader` | Valida ICP fit — diagnostic em cliente fora do ICP gera o aviso `out_of_icp` |
| `@offerings-loader` | Verifica se já há SKU/produto no catálogo cobrindo o problema declarado (evita reinventar) |

> Se algum cache vazio → invocar a skill emissora antes de iniciar a sessão. Diagnóstico sem framing Tier 1 vira coleta de requisitos genérica, não diagnóstico.

## Inputs Tier 2 (parâmetros)

Obrigatórios:

```yaml
client_id: <slug do cliente>
interlocutor_role: <ceo | cfo | head-x | analista>  # quem está na sessão
declared_problem: <1 frase do problema declarado pelo cliente, ipsis literis>
```

Opcionais:

```yaml
session_minutes: <duração planejada, default 90>
industry: <vertical do cliente>
referrer: <como cliente chegou>
prior_attempts: [<outras tentativas de resolver, se houver>]
```

## Roteiro estruturado (10 blocos)

A skill conduz via prompts ao interlocutor; cada bloco produz uma seção do relatório:

| # | Bloco | Pergunta-âncora | Output |
|---|---|---|---|
| 1 | **Problema declarado** | "Em uma frase, o que você precisa resolver?" | Texto + reformulação validada |
| 2 | **Custo do não-resolvido** | "O que acontece em 6 meses se nada mudar?" | Estimativa de impacto financeiro/operacional |
| 3 | **Baseline humano** | "Quem hoje executa? Quanto tempo leva? Qual a taxa de erro?" | Inputs para `@baseline-cost-builder` |
| 4 | **Tentativas anteriores** | "Já tentaram resolver antes? O que falhou?" | Histórico (informa risco) |
| 5 | **Outcome candidato** | "O que conta como 'feito'? Dê 3 exemplos do que conta e 3 do que não conta" | Cláusula preliminar de outcome (C2) |
| 6 | **Métrica de sucesso** | "Como vamos saber em 90 dias se isto deu certo?" | Métrica + meta + janela |
| 7 | **Tolerância a erro** | "Quantos % de erro do agente seriam aceitáveis vs humano hoje?" | Threshold de qualidade |
| 8 | **ICP fit** | (interno — comparar com `__forge_cache.icp`) | Score `fit | edge | out_of_icp` |
| 9 | **Catálogo fit** | (interno — comparar com `__forge_cache.offerings`) | Existing SKU? variante? novo? |
| 10 | **Próximos passos** | "Topa pagar o diagnóstico cobrável? prazo?" | GO/NO-GO + valor diagnóstico |

> Bloco 8 e 9 são **internos** — não viram pergunta ao interlocutor; a skill consulta cache Tier 1 e registra resultado.

## Inputs declarados → output em arquivo

Persiste em `docs/clients/{client_id}/diagnostic.md` usando `templates/diagnostic-spec.template.md`, com seções alinhadas aos 10 blocos acima + frontmatter:

```yaml
---
client_id: <>
session_date: YYYY-MM-DD
interlocutor: { role, name (opcional) }
icp_fit: fit | edge | out_of_icp
catalog_fit: existing-sku | variant | new
go_no_go: go | no-go | needs-paid-diagnostic
linked_principles: [C1, C2]
forge_skill_version: diagnostic-runner@0.1.0
---
```

## O que entrega (return value)

```yaml
diagnostic_run: true
artifact_path: docs/clients/acme/diagnostic.md
client_id: acme
session_minutes_actual: <N>
icp_fit: fit
catalog_fit: variant
proposed_outcome:
  clause: "<1 frase>"
  positive_examples: [...]
  negative_examples: [...]
  trigger_event: <evento técnico>
baseline_inputs_handoff:
  ready_for: "@baseline-cost-builder"
  fields_collected: [volume_monthly, actors, hours_per_unit, error_rate, rework_rate]
  fields_missing: []
go_no_go: go
next_step: "Invocar @baseline-cost-builder; depois /acme:spec-sku"
generated_at: 2026-04-30T...
```

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Cliente já tem clareza, pulo o roteiro" | Diagnose-before-design (C1) é estrutural; pular roteiro = sem `diagnostic.md` = SKU não pode ir a produção | Conduzir os 10 blocos mesmo se interlocutor "já sabe" |
| "Outcome ambíguo, deixo pra spec resolver" | C2 começa aqui em forma preliminar; ambiguidade aqui contamina spec, contrato, eval | Forçar 3+3 exemplos no Bloco 5; sem isso, marcar `proposed_outcome: insufficient` |
| "Cliente não cabe no ICP, mas vale tentar" | ICP existe pra calibrar onde caçar; out-of-ICP gasta esforço de pré-venda e vira churn | Marcar `icp_fit: out_of_icp` e seguir para `next_step: "renegociar escopo ou recusar"` |
| "Já existe SKU parecido no catálogo, vou customizar" | Quebra C8 (anti-customização heroica) | `catalog_fit: existing-sku → reuso config`; ou `variant → novo SKU empacotado`; nunca custom-por-cliente |
| "Sem baseline numérico, vou estimar" | Quebra C1 (baseline humano mandatório) e C3 (sem baseline, custo/preço sem âncora) | Bloco 3 é mandatório; sem dados, `next_step: "agendar 2ª sessão com CFO"` |
| "Vou ler runs anteriores de outros clientes pra puxar referência" | Runs são Tier 3 — quebra C5 | Apenas Tier 1 (helpers) + Tier 2 do mesmo cliente |
| "Tolerância a erro = 0, cliente quer perfeição" | Inviável tecnicamente e quebra negociação posterior; toda tolerância > 0 deve ser declarada | Forçar declaração explícita de threshold (ex: ≤ 5% erro) |

## Verification gate

Skill considera-se aplicada **com sucesso** quando:

- [x] Todos os 10 blocos do roteiro produziram output (ou `not_applicable` justificado)
- [x] `proposed_outcome.clause`, `positive_examples` (≥3), `negative_examples` (≥3), `trigger_event` presentes
- [x] `icp_fit` ∈ {fit, edge, out_of_icp} declarado
- [x] `catalog_fit` ∈ {existing-sku, variant, new} declarado
- [x] `go_no_go` ∈ {go, no-go, needs-paid-diagnostic} com justificativa
- [x] Arquivo `docs/clients/{client_id}/diagnostic.md` persistido e parseia
- [x] Frontmatter inclui `forge_skill_version` para rastreabilidade do reviewer
- [x] `__forge_cache.{dna,icp,offerings}` consumido (não re-leu Tier 1 do disco)
- [x] Nenhuma leitura Tier 3
- [x] Tempo total da sessão registrado em `session_minutes_actual`

Se algum item falhar → erro estruturado; **não** persiste relatório parcial sem flag explícita `partial: true`.

## C5 hard rule

Esta skill **não pode**:

- Ler `runs/`, `outcomes/`, `eval-cases/`, `traces/`
- Receber `run_id`, `case_id` como parâmetro
- Importar de skills L2

**Pode**:

- Consumir helpers `__forge_cache.{dna,icp,offerings}`
- Ler outros artefatos Tier 2 do mesmo cliente (diagnósticos prévios, outros baselines)
- Ler templates (`templates/diagnostic-spec.template.md`)

Violação → FAIL na auditoria mensal.

## Saída de erro estruturada

```yaml
diagnostic_run: false
error: <enum>
blocks_completed: [1, 2, 3]
blocks_pending: [...]
hint: <ação>
```

`error` ∈ `inputs_missing` | `helpers_not_loaded` | `interlocutor_disengaged` (≥3 blocos sem resposta substancial) | `out_of_icp_blocked` (se settings exigem) | `client_dir_unwritable` | `partial_session_aborted`.

## Interação com outras skills

| Skill | Direção | Como |
|---|---|---|
| `@company-dna`, `@icp-loader`, `@offerings-loader` | upstream (helpers) | Consumidas via `__forge_cache` |
| `@baseline-cost-builder` | downstream | Recebe handoff dos campos coletados no Bloco 3 |
| `@process-mapper` | downstream | Recebe handoff do problema declarado para mapear processo as-is |
| `/acme:spec-sku` (Forge-2) | downstream | Lê `diagnostic.md` para gerar spec |
| `@po-guardian` (Forge-3) | reviewer | Valida cláusula de outcome antes de virar contrato |

## Critério de pronto explícito (do roadmap Forge-1)

> "Skill `diagnostic-runner` em sessão simulada produz relatório Fase 0 estruturado em ≤ 10 min."

A skill é compatível com sessões longas (90 min com CEO) **e** sessões rápidas (10 min para qualificação preliminar). O `session_minutes` parametriza a profundidade de cada bloco, mas **todos os 10 blocos** são executados.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-1 onda 2 (Tier 2) |
