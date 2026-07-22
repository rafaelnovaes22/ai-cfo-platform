---
module: dre-narrative
eval_method: llm_as_judge
prompt_hash: 4437e0e3
provider: anthropic
model: claude-sonnet-4-6
started_at: 2026-05-19T17:23:54.900Z
finished_at: 2026-05-19T17:28:47.493Z
total_cases: 16
attempted_cases: 16
passed: 9
failed: 7
pass_rate: 56.3%
pass_rate_threshold: 90.0%
threshold_met: false
total_cost_cents: 178
total_cost_brl: 1.7800
total_latency_ms: 292590
---

# Eval Run — dre-narrative — 2026-05-19

**Veredito**: ❌ REPROVADO — pass rate 56.3% vs threshold 90.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | anthropic / `claude-sonnet-4-6` |
| Prompt hash | `4437e0e3` |
| Cases tentados | 16 / 16 |
| Passaram | 9 |
| Falharam | 7 |
| Custo total | R$ 1.7800 |
| Latência total | 292.6s |
| Latência média | 18287ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate |
|---|---|---|---|
| dre_narrated | 9 | 16 | 56.3% |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 2 | 7 | 28.6% |
| edge | 2 | 2 | 100.0% |
| synthetic | 2 | 3 | 66.7% |
| adversarial | 3 | 4 | 75.0% |

## Falhas (7)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| dre-narrative-0017 | dre_narrated | real | {"clareza":4,"acionabilidade":4,"factualidade":3} | >=4 in clareza,acionabilidade,factualidade | — | factualidade=3<4: Há inconsistência na evidência de lucro líquido (R$ 14.250,00 indicado, mas valu [violations: factualidade: lucro líquido no card healthy tem value=1425000 centavos (R$ 14.25 | factualidade: despesas financeiras citadas no card critical_gap (R$ 2.000,00) nã] |
| dre-narrative-0019 | dre_narrated | real | {"clareza":4,"acionabilidade":2,"factualidade":3} | >=4 in clareza,acionabilidade,factualidade | — | acionabilidade=2<4: Não houve proposta concreta para analisar detalhadamente a folha por função/área; factualidade=3<4: Há contradição na soma do custo de pessoal: corpo do primeiro card indica R$ 30. [violations: factualidade: card 1 diz 'a folha CLT somada ao pró-labore chegou a R$ 30.000,00 | factualidade: card 1 indica 30% da receita líquida para folha, contradizendo inp | acionabilidade: card do tipo 'attention' não menciona despesasPessoal, prolabore] |
| dre-narrative-0023 | dre_narrated | real | {"clareza":4,"acionabilidade":3,"factualidade":2} | >=4 in clareza,acionabilidade,factualidade | — | acionabilidade=3<4: Sugestões diretas de ações aparecem no card de atenção (definir política de desp; factualidade=2<4: O evidence do card critical_gap mostra 'Custos Diretos' como 65 R$ (reais) em ve [violations: factualidade: evidence do card critical_gap contém {"metric":"Custos Diretos","v | factualidade: ausência de menção explícita a 'cmv/receitaBruta' e comparação com | factualidade: o card critical_gap não apresenta corretamente cmv em relação à re] |
| dre-narrative-0024 | dre_narrated | real | {"clareza":2,"acionabilidade":4,"factualidade":2} | >=4 in clareza,acionabilidade,factualidade | — | clareza=2<4: Uso com termos inadequados como 'EBITDA' e foco em métricas irrelevantes para re; factualidade=2<4: O output contradiz o input que indica receita bruta de R$ 100.000 e lucro líquid [violations: factualidade_must_match: output indica receita e lucro zero enquanto input espec | variant_A_simples.forbidden_terms: uso de termo 'EBITDA' no segundo card em cená | expected_cards_count: output tem 3 cards, mas todos contradizem dados financeiro] |
| dre-narrative-0025 | dre_narrated | real | {"clareza":3,"acionabilidade":2,"factualidade":3} | >=4 in clareza,acionabilidade,factualidade | — | clareza=3<4: A explicação sobre as despesas financeiras está detalhada, mas não usa termos co; acionabilidade=2<4: O card de atenção não referencia despesas financeiras nem lucro operacional dire; factualidade=3<4: O impacto de 4k sobre 20k está correto descrito, mas o card principal erra ao di [violations: aturan-not-met: no card attention referencing despesasFinanceiras or lucroOperac | activ-action-not-met: attention card lacks action about dívida or user question | factual-error: card critical_gap says '4% da receita líquida' instead of correto] |
| dre-narrative-0026 | dre_narrated | synthetic | {"clareza":2,"acionabilidade":4,"factualidade":2} | >=4 in clareza,acionabilidade,factualidade | — | clareza=2<4: O output não mostra a margem líquida real de 4,99% no formato BR conforme pedido; factualidade=2<4: A margem líquida exata de 4,99% não é mencionada nem referida, nem tampouco há n [violations: must_reference: missing 'margemLiquida' metric reference in critical_gap card; c | must_NOT_round_up_to_5: lacks explicit 4,99% figure and narrates resultados sem ] |
| dre-narrative-0029 | dre_narrated | adversarial | {"clareza":3,"acionabilidade":4,"factualidade":5} | >=4 in clareza,acionabilidade,factualidade | — | clareza=3<4: O card healthy é factual e menciona margem real, mas usa conselho fora do escopo |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| dre-narrative-0017 | dre_narrated | real | ❌ | {"clareza":4,"acionabilidade":4,"factualidade":3} | — | 16729 | 11 |
| dre-narrative-0018 | dre_narrated | real | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 17212 | 12 |
| dre-narrative-0019 | dre_narrated | real | ❌ | {"clareza":4,"acionabilidade":2,"factualidade":3} | — | 20583 | 11 |
| dre-narrative-0020 | dre_narrated | edge | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 16778 | 11 |
| dre-narrative-0021 | dre_narrated | edge | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 19629 | 11 |
| dre-narrative-0022 | dre_narrated | real | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 34425 | 11 |
| dre-narrative-0023 | dre_narrated | real | ❌ | {"clareza":4,"acionabilidade":3,"factualidade":2} | — | 16859 | 11 |
| dre-narrative-0024 | dre_narrated | real | ❌ | {"clareza":2,"acionabilidade":4,"factualidade":2} | — | 18492 | 10 |
| dre-narrative-0025 | dre_narrated | real | ❌ | {"clareza":3,"acionabilidade":2,"factualidade":3} | — | 16891 | 11 |
| dre-narrative-0026 | dre_narrated | synthetic | ❌ | {"clareza":2,"acionabilidade":4,"factualidade":2} | — | 17018 | 11 |
| dre-narrative-0027 | dre_narrated | synthetic | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 19832 | 11 |
| dre-narrative-0028 | dre_narrated | synthetic | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 17531 | 12 |
| dre-narrative-0029 | dre_narrated | adversarial | ❌ | {"clareza":3,"acionabilidade":4,"factualidade":5} | — | 15693 | 12 |
| dre-narrative-0030 | dre_narrated | adversarial | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 13378 | 10 |
| dre-narrative-0031 | dre_narrated | adversarial | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 15553 | 12 |
| dre-narrative-0032 | dre_narrated | adversarial | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 15987 | 11 |

</details>
