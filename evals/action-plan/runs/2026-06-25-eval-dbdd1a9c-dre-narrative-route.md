---
module: action-plan
eval_method: llm_as_judge
prompt_hash: dbdd1a9c
provider: router
model: dre-narrative-route
started_at: 2026-06-25T19:51:05.497Z
finished_at: 2026-06-25T20:03:53.966Z
total_cases: 22
attempted_cases: 22
passed: 11
failed: 11
pass_rate: 50.0%
pass_rate_threshold: 85.0%
threshold_met: false
total_cost_cents: 90
total_cost_brl: 0.9000
total_latency_ms: 768462
---

# Eval Run — action-plan — 2026-06-25

**Veredito**: ❌ REPROVADO — pass rate 50.0% vs threshold 85.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | router / `dre-narrative-route` |
| Prompt hash | `dbdd1a9c` |
| Cases tentados | 22 / 22 |
| Passaram | 11 |
| Falharam | 11 |
| Custo total | R$ 0.9000 |
| Latência total | 768.5s |
| Latência média | 34930ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate |
|---|---|---|---|
| plan_generated | 11 | 22 | 50.0% |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 6 | 10 | 60.0% |
| synthetic | 2 | 6 | 33.3% |
| edge | 1 | 3 | 33.3% |
| adversarial | 2 | 3 | 66.7% |

## Falhas (11)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| action-plan-0001 | plan_generated | real | {"acionabilidade":2,"impacto_plausivel":5,"doneWhen_executavel":2} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=2<4: Duas ações ('Otimize Despesas Comerciais e de Marketing' e 'Otimize Processos In; doneWhen_executavel=2<4: Três ações ('Avalie e Reajuste a Estrutura de Preços', 'Otimize Processos Intern [violations: Regra 'min_actions_per_horizon' violada: O horizonte 'short' possui 2 ações, mas | Regra 'acionabilidade' violada: Ação 'Otimize Despesas Comerciais e de Marketing | Regra 'doneWhen_executavel' violada: Ação 'Avalie e Reajuste a Estrutura de Preç] |
| action-plan-0003 | plan_generated | real | {"acionabilidade":1,"impacto_plausivel":5,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=1<4: A ação de revisão de quadro/produtividade ('Reestruture a folha de pagamento') f [violations: Regra 'min_actions_per_horizon' violada: O horizonte 'short' exige 3 ações, mas  | Regra 'acionabilidade' violada: Ação de revisão de quadro/produtividade ('Reestr] |
| action-plan-0005 | plan_generated | real | {"acionabilidade":3,"impacto_plausivel":5,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=3<4: Algumas ações não se alinham diretamente com os exemplos de acionabilidade forne [violations: Regra 'min_actions_per_horizon' violada para o horizonte 'short': Esperado 3 açõ] |
| action-plan-0009 | plan_generated | real | {"acionabilidade":5,"impacto_plausivel":3,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | impacto_plausivel=3<4: O impacto da ação de recuperação de inadimplência (R$ 10.000,00) está abaixo da  [violations: O número de ações no horizonte 'short' (2) é menor que o mínimo exigido (3) pela | O termo 'EBITDA' é proibido e aparece na ação 'Otimize Processos para Reduzir De] |
| action-plan-0012 | plan_generated | synthetic | {"acionabilidade":2,"impacto_plausivel":1,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=2<4: A maioria das ações propostas foca em otimização operacional e redução de custos; impacto_plausivel=1<4: Múltiplas ações não respeitam os intervalos de impacto financeiro definidos pela [violations: A regra 'min_actions_per_horizon' foi violada para o horizonte 'short', que poss | A ação de curto prazo 'Renegocie Custos Diretos com Fornecedores' tem um 'impact | A ação de médio prazo 'Reduza a Dependência de Clientes Chave' tem um 'impactCen | A ação de longo prazo 'Construa uma Reserva de Caixa Estratégica' tem um 'impact | A ação de longo prazo 'Otimize Processos de Produção para Eficiência' tem um 'im] |
| action-plan-0013 | plan_generated | synthetic | {"acionabilidade":5,"impacto_plausivel":3,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | impacto_plausivel=3<4: O impacto da ação 3 (R$ 2.000,00) é inconsistente com a descrição e o `doneWhen` [violations: Ações no horizonte 'short' (2) são insuficientes, o mínimo exigido é 3. | O termo 'EBITDA' é proibido e aparece em `actions[0].assumptions`.] |
| action-plan-0015 | plan_generated | synthetic | {"acionabilidade":5,"impacto_plausivel":1,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | impacto_plausivel=1<4: A ação de categorização tem um impactCents de R$ 12.500,00, que é muito superior [violations: Ação de categorização tem impactCents de R$ 12.500,00, violando a regra de impac | Número de ações no horizonte 'short' (2) é menor que o mínimo exigido (3). Trech] |
| action-plan-0016 | plan_generated | synthetic | {"acionabilidade":2,"impacto_plausivel":1,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=2<4: Ações como 'Mapeie e Reduza Despesas Administrativas Urgentes' (R$ 8.000/mês), '; impacto_plausivel=1<4: A maioria das ações propostas tem impacto financeiro fora da faixa esperada de R [violations: Ações no horizonte 'short' (2) são insuficientes, o mínimo exigido é 3. | Ação 'Mapeie e Reduza Despesas Administrativas Urgentes' propõe corte agressivo  | Ação 'Reavalie a Precificação de Produtos Chave' propõe expansão de receita (aum | Ação 'Explore Novas Linhas de Produto ou Canais de Venda' propõe expansão de rec | Ação 'Mapeie e Reduza Despesas Administrativas Urgentes' tem impacto de R$ 8.000 | Ação 'Reavalie a Precificação de Produtos Chave' tem impacto de R$ 5.400,00, for | Ação 'Otimize Processos Operacionais Chave' tem impacto de R$ 6.000,00, fora da  | Ação 'Estabeleça uma Meta de Reserva de Caixa' tem impacto de R$ 0,00, fora da f | Ação 'Explore Novas Linhas de Produto ou Canais de Venda' tem impacto de R$ 18.0] |
| action-plan-0017 | plan_generated | edge | {"acionabilidade":5,"impacto_plausivel":2,"doneWhen_executavel":5} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | impacto_plausivel=2<4: O impacto da ação 'Renegocie taxas e juros bancários' (R$ 3.000,00) é implausíve [violations: A ação 'Renegocie taxas e juros bancários' propõe um impacto de R$ 3.000,00 ('im] |
| action-plan-0018 | plan_generated | edge | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":3} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | doneWhen_executavel=3<4: A condição 'doneWhen' da ação 'Construa uma reserva de caixa estratégica' (ating [violations: forbidden_terms: ["EBITDA"] violado na descrição da ação 2: 'Assumimos que a dis] |
| action-plan-0020 | plan_generated | adversarial | {"acionabilidade":1,"impacto_plausivel":1,"doneWhen_executavel":1} | >=4 in acionabilidade,impacto_plausivel,doneWhen_executavel | — | acionabilidade=1<4: Apesar da clareza e especificidade das ações, a violação de um termo proibido co; impacto_plausivel=1<4: Apesar da plausibilidade dos impactos financeiros, a violação de um termo proibi; doneWhen_executavel=1<4: Apesar da clareza e mensurabilidade dos critérios 'doneWhen', a violação de um t [violations: Regra 'forbidden_terms: ["EBITDA"]' violada na descrição da ação 5: "...consider | Regra 'forbidden_terms: ["EBITDA"]' violada nas suposições da ação 5: "...aproxi] |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| action-plan-0001 | plan_generated | real | ❌ | {"acionabilidade":2,"impacto_plausivel":5,"doneWhen_executavel":2} | — | 40014 | 4 |
| action-plan-0002 | plan_generated | real | ✅ | {"acionabilidade":4,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 28298 | 4 |
| action-plan-0003 | plan_generated | real | ❌ | {"acionabilidade":1,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 28835 | 4 |
| action-plan-0004 | plan_generated | real | ✅ | {"acionabilidade":4,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 25618 | 3 |
| action-plan-0005 | plan_generated | real | ❌ | {"acionabilidade":3,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 30545 | 4 |
| action-plan-0006 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":4,"doneWhen_executavel":5} | — | 32332 | 4 |
| action-plan-0007 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 35674 | 4 |
| action-plan-0008 | plan_generated | real | ✅ | {"acionabilidade":4,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 31470 | 4 |
| action-plan-0009 | plan_generated | real | ❌ | {"acionabilidade":5,"impacto_plausivel":3,"doneWhen_executavel":5} | — | 32224 | 4 |
| action-plan-0010 | plan_generated | real | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 34244 | 4 |
| action-plan-0011 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 26250 | 3 |
| action-plan-0012 | plan_generated | synthetic | ❌ | {"acionabilidade":2,"impacto_plausivel":1,"doneWhen_executavel":5} | — | 42754 | 5 |
| action-plan-0013 | plan_generated | synthetic | ❌ | {"acionabilidade":5,"impacto_plausivel":3,"doneWhen_executavel":5} | — | 29737 | 4 |
| action-plan-0014 | plan_generated | synthetic | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 35881 | 4 |
| action-plan-0015 | plan_generated | synthetic | ❌ | {"acionabilidade":5,"impacto_plausivel":1,"doneWhen_executavel":5} | — | 29586 | 4 |
| action-plan-0016 | plan_generated | synthetic | ❌ | {"acionabilidade":2,"impacto_plausivel":1,"doneWhen_executavel":5} | — | 49974 | 5 |
| action-plan-0017 | plan_generated | edge | ❌ | {"acionabilidade":5,"impacto_plausivel":2,"doneWhen_executavel":5} | — | 36284 | 4 |
| action-plan-0018 | plan_generated | edge | ❌ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":3} | — | 43175 | 5 |
| action-plan-0019 | plan_generated | edge | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 46388 | 5 |
| action-plan-0020 | plan_generated | adversarial | ❌ | {"acionabilidade":1,"impacto_plausivel":1,"doneWhen_executavel":1} | — | 37283 | 4 |
| action-plan-0021 | plan_generated | adversarial | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 37990 | 4 |
| action-plan-0022 | plan_generated | adversarial | ✅ | {"acionabilidade":5,"impacto_plausivel":5,"doneWhen_executavel":5} | — | 33906 | 4 |

</details>
