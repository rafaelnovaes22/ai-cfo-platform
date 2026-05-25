---
module: action-plan
eval_method: llm_as_judge
prompt_hash: dbdd1a9c
provider: router
model: dre-narrative-route
started_at: 2026-05-25T18:14:29.897Z
finished_at: 2026-05-25T18:25:40.297Z
total_cases: 22
attempted_cases: 22
passed: 15
failed: 7
pass_rate: 68.2%
pass_rate_threshold: 85.0%
threshold_met: false
total_cost_cents: 45
total_cost_brl: 0.4500
total_latency_ms: 670389
---

# Eval Run — action-plan — 2026-05-25

**Veredito**: ❌ REPROVADO — pass rate 68.2% vs threshold 85.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | router / `dre-narrative-route` |
| Prompt hash | `dbdd1a9c` |
| Cases tentados | 22 / 22 |
| Passaram | 15 |
| Falharam | 7 |
| Custo total | R$ 0.4500 |
| Latência total | 670.4s |
| Latência média | 30472ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate |
|---|---|---|---|
| plan_generated | 15 | 22 | 68.2% |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 8 | 10 | 80.0% |
| synthetic | 3 | 6 | 50.0% |
| edge | 3 | 3 | 100.0% |
| adversarial | 1 | 3 | 33.3% |

## Falhas (7)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| action-plan-0001 | plan_generated | real | {"acionabilidade":5,"impacto_plausivel":1,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | impacto_plausivel=1<4: Todos os valores de 'impactCents' são significativamente maiores que o limite de [violations: Violação da regra 'impacto_plausivel': o campo 'impactCents' na ação 'Expandir m | Violação da regra 'impacto_plausivel': o campo 'impactCents' na ação 'Testar cam | Violação da regra 'impacto_plausivel': o campo 'impactCents' na ação 'Aumentar t | Violação da regra 'impacto_plausivel': o campo 'impactCents' na ação 'Otimizar p | Violação da regra 'impacto_plausivel': o campo 'impactCents' na ação 'Lancar lin] |
| action-plan-0006 | plan_generated | real | {"acionabilidade":3,"impacto_plausivel":5,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=3<4: O plano de ações não incluiu tipos de ações específicas citadas na rubrica, como |
| action-plan-0011 | plan_generated | synthetic | {"acionabilidade":1,"impacto_plausivel":5,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=1<4: A descrição da primeira ação ('A margem liquida esta saudavel em 0.00%') apresen [violations: A descrição da primeira ação ('Expandir mix vencedor') contém uma alucinação ao ] |
| action-plan-0012 | plan_generated | synthetic | {"acionabilidade":1,"impacto_plausivel":2,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=1<4: As ações propostas são de caráter operacional de eficiência e não estratégicas d; impacto_plausivel=2<4: O impacto financeiro das ações de médio e longo prazo (R$50.000) está abaixo do  [violations: Impacto financeiro de ações de horizonte "medium" (impactCents=50000) não atende | Impacto financeiro de ações de horizonte "long" (impactCents=50000) não atende a] |
| action-plan-0016 | plan_generated | synthetic | {"acionabilidade":5,"impacto_plausivel":3,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | impacto_plausivel=3<4: Quatro das cinco ações têm impacto dentro do intervalo de R$1-5k, mas a ação de  [violations: A ação 'Implementar Sistema de Gestão Financeira Integrado' possui um `impactCen] |
| action-plan-0021 | plan_generated | adversarial | {"acionabilidade":1,"impacto_plausivel":1,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=1<4: As ações são baseadas em uma premissa alucinada de 'margem líquida saudável' e '; impacto_plausivel=1<4: Todos os impactos financeiros sugeridos excedem significativamente 20% da receit [violations: A descrição da ação 'Expandir mix vencedor' afirma 'A margem liquida esta saudav | O 'impactCents' de todas as ações ('400000', '300000', '250000', '500000', '8000] |
| action-plan-0022 | plan_generated | adversarial | {"acionabilidade":2,"impacto_plausivel":3,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=2<4: A ação 'Mediar maiores devedores' apresenta inconsistência entre `impactCents` (; impacto_plausivel=3<4: O `impactCents` de R$ 12.000 na ação 'Mediar maiores devedores' não é coerente c [violations: Ação 'Mediar maiores devedores' possui `impactCents` (1200000) inconsistente com] |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| action-plan-0001 | plan_generated | real | ❌ | {"acionabilidade":5,"impacto_plausivel":1,"doneWhen_executavel":5} | — | 27139 | 2 |
| action-plan-0002 | plan_generated | real | ✅ | {"acionabilidade":4,"impacto_plausivel":5,"doneWhen_executavel":4} | — | 31445 | 2 |
| action-plan-0003 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 24430 | 2 |
| action-plan-0004 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 33377 | 2 |
| action-plan-0005 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 29846 | 2 |
| action-plan-0006 | plan_generated | real | ❌ | {"acionabilidade":3,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 32833 | 2 |
| action-plan-0007 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 22452 | 2 |
| action-plan-0008 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 25925 | 2 |
| action-plan-0009 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 27960 | 2 |
| action-plan-0010 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 23226 | 2 |
| action-plan-0011 | plan_generated | synthetic | ❌ | {"acionabilidade":1,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 30210 | 2 |
| action-plan-0012 | plan_generated | synthetic | ❌ | {"acionabilidade":1,"impacto_plausivel":2,"doneWhen_executavel":5} | — | 27575 | 2 |
| action-plan-0013 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 51421 | 3 |
| action-plan-0014 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 36541 | 2 |
| action-plan-0015 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 35386 | 2 |
| action-plan-0016 | plan_generated | synthetic | ❌ | {"acionabilidade":5,"impacto_plausivel":3,"doneWhen_executavel":5} | — | 29119 | 2 |
| action-plan-0017 | plan_generated | edge | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 36414 | 2 |
| action-plan-0018 | plan_generated | edge | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 27361 | 2 |
| action-plan-0019 | plan_generated | edge | ✅ | {"acionabilidade":5,"impacto_plausivel":4,"doneWhen_executavel":5} | — | 27087 | 2 |
| action-plan-0020 | plan_generated | adversarial | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 25874 | 2 |
| action-plan-0021 | plan_generated | adversarial | ❌ | {"acionabilidade":1,"impacto_plausivel":1,"doneWhen_executavel":5} | — | 27054 | 2 |
| action-plan-0022 | plan_generated | adversarial | ❌ | {"acionabilidade":2,"impacto_plausivel":3,"doneWhen_executavel":5} | — | 37714 | 2 |

</details>
