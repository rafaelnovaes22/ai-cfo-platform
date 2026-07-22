---
module: dre-narrative
eval_method: llm_as_judge
prompt_hash: 4437e0e3
provider: google
model: gemini-2.5-flash-lite
started_at: 2026-05-25T16:02:01.728Z
finished_at: 2026-05-25T16:08:49.166Z
total_cases: 16
attempted_cases: 16
passed: 7
failed: 9
pass_rate: 43.8%
pass_rate_threshold: 90.0%
threshold_met: false
total_cost_cents: 32
total_cost_brl: 0.3200
total_latency_ms: 407431
---

# Eval Run — dre-narrative — 2026-05-25

**Veredito**: ❌ REPROVADO — pass rate 43.8% vs threshold 90.0%

## Resumo

| Métrica | Valor |
|---|---|
| Provider / modelo | google / `gemini-2.5-flash-lite` |
| Prompt hash | `4437e0e3` |
| Cases tentados | 16 / 16 |
| Passaram | 7 |
| Falharam | 9 |
| Custo total | R$ 0.3200 |
| Latência total | 407.4s |
| Latência média | 25464ms |

## Pass rate por outcome

| Outcome | Passados | Total | Pass rate |
|---|---|---|---|
| dre_narrated | 7 | 16 | 43.8% |

## Pass rate por source_mode

| Source | Passados | Total | Pass rate |
|---|---|---|---|
| real | 2 | 7 | 28.6% |
| edge | 1 | 2 | 50.0% |
| synthetic | 1 | 3 | 33.3% |
| adversarial | 3 | 4 | 75.0% |

## Falhas (9)

| Case | Outcome | Source | Predicted | Expected | Confidence | Motivo |
|---|---|---|---|---|---|---|
| dre-narrative-0018 | dre_narrated | real | {"clareza":5,"acionabilidade":5,"factualidade":3} | >=4 in clareza,acionabilidade,factualidade | — | factualidade=3<4: Embora os valores citados sejam factualmente corretos, a saída não incluiu a mét [violations: A métrica 'despesasPessoal/receitaLiquida' não está presente em nenhuma lista 'e] |
| dre-narrative-0019 | dre_narrated | real | {"clareza":5,"acionabilidade":1,"factualidade":5} | >=4 in clareza,acionabilidade,factualidade | — | acionabilidade=1<4: Apesar de duas ações serem bem formuladas, o card do tipo 'attention' falha grav [violations: Regra 'attention_card.must_reference' violada: O card do tipo 'attention' não in | Regra 'attention_card.must_mention_threshold' violada: O 'body' do card do tipo ] |
| dre-narrative-0020 | dre_narrated | edge | {"clareza":5,"acionabilidade":5,"factualidade":1} | >=4 in clareza,acionabilidade,factualidade | — | factualidade=1<4: Há uma alucinação numérica no card 'attention', afirmando que as despesas admini [violations: Uma afirmação no corpo do card de atenção é factualmente incorreta: 'As despesas] |
| dre-narrative-0022 | dre_narrated | real | {"clareza":3,"acionabilidade":5,"factualidade":2} | >=4 in clareza,acionabilidade,factualidade | — | clareza=3<4: O texto não utilizou a "3a pessoa preferida" para as ações propostas, usando imp; factualidade=2<4: Houve um erro na unidade da métrica "Comerciais/Marketing" no evidence do segund [violations: Regra 'variant_A_formal.tone' e 'variant_A_formal.permitted_pronouns' violada: O | Regra 'factualidade' e 'CONTRATO DE UNIDADES DO OUTPUT' violada: No card do tipo] |
| dre-narrative-0023 | dre_narrated | real | {"clareza":1,"acionabilidade":1,"factualidade":1} | >=4 in clareza,acionabilidade,factualidade | — | clareza=1<4: Falha grave na clareza devido ao uso de termos proibidos ('EBITDA') e à ausência; acionabilidade=1<4: Nenhuma ação sugerida utilizou os verbos permitidos (Renegocie/Teste/Reduza) nem; factualidade=1<4: O output não cita o CMV de R$ 65.000 conforme explicitamente exigido pela rubric [violations: A palavra proibida 'EBITDA' foi utilizada nos cards (ex: card 'attention', títul | A regra de clareza 'explica CMV como 'o que foi pago aos fornecedores'' não foi  | A regra de clareza 'explica Margem Bruta como 'o que sobrou após pagar os fornec | As ações propostas nos cards não utilizam os verbos permitidos ('Renegocie/Teste | As alavancas de ação propostas não são 'fornecedor, mix ou preço'; por exemplo,  | O output não cita CMV=R$ 65.000 conforme exigido pela rubrica de factualidade, a | O card de tipo 'attention' não referencia 'cmv' nem 'margemBruta', conforme exig] |
| dre-narrative-0025 | dre_narrated | real | {"clareza":2,"acionabilidade":3,"factualidade":5} | >=4 in clareza,acionabilidade,factualidade | — | clareza=2<4: O card de atenção não referencia explicitamente 'lucro operacional' no corpo ao ; acionabilidade=3<4: O card de atenção propõe uma ação concreta, mas o prazo ('no próximo trimestre') [violations: A regra de clareza que exige que o card de atenção explique que as despesas fina | A regra de acionabilidade que exige 'prazo explícito em dias' foi violada, pois ] |
| dre-narrative-0026 | dre_narrated | synthetic | {"clareza":2,"acionabilidade":5,"factualidade":5} | >=4 in clareza,acionabilidade,factualidade | — | clareza=2<4: O card 'critical_gap' não tratou a margem líquida de 4,99% como crítica, conform [violations: critical_gap_card.must_reference: O card 'critical_gap' não referenciou a métric] |
| dre-narrative-0027 | dre_narrated | synthetic | {"clareza":2,"acionabilidade":5,"factualidade":2} | >=4 in clareza,acionabilidade,factualidade | — | clareza=2<4: O card 'healthy' falha em sinalizar a natureza não-recorrente da margem líquida ; factualidade=2<4: O card 'healthy' não referencia 'outrasReceitasOperacionais' e a métrica 'lucroB [violations: Métrica 'lucroBruto' exigida em 'required_metrics_in_evidence' não foi incluída  | O card 'healthy' falhou em sinalizar a natureza não-recorrente da alta margem lí | O card 'healthy' falhou em avisar contra projeções, sugerindo expansão sem ressa | O card 'healthy' não referencia 'outrasReceitasOperacionais' no body ou evidence] |
| dre-narrative-0030 | dre_narrated | adversarial | {"clareza":2,"acionabilidade":5,"factualidade":5} | >=4 in clareza,acionabilidade,factualidade | — | clareza=2<4: A métrica 'EBITDA', explicitamente proibida pela rubrica, foi incluída no card ' [violations: O termo 'EBITDA' é proibido e aparece na evidência do card 'healthy': {"metric":] |

## Detalhamento por case (todos)

<details><summary>Expandir tabela completa</summary>

| Case | Outcome | Source | Status | Predicted | Conf | ms | Custo (cents) |
|---|---|---|---|---|---|---|---|
| dre-narrative-0017 | dre_narrated | real | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 16886 | 2 |
| dre-narrative-0018 | dre_narrated | real | ❌ | {"clareza":5,"acionabilidade":5,"factualidade":3} | — | 48679 | 2 |
| dre-narrative-0019 | dre_narrated | real | ❌ | {"clareza":5,"acionabilidade":1,"factualidade":5} | — | 25749 | 2 |
| dre-narrative-0020 | dre_narrated | edge | ❌ | {"clareza":5,"acionabilidade":5,"factualidade":1} | — | 30841 | 2 |
| dre-narrative-0021 | dre_narrated | edge | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 24251 | 2 |
| dre-narrative-0022 | dre_narrated | real | ❌ | {"clareza":3,"acionabilidade":5,"factualidade":2} | — | 32332 | 2 |
| dre-narrative-0023 | dre_narrated | real | ❌ | {"clareza":1,"acionabilidade":1,"factualidade":1} | — | 37551 | 2 |
| dre-narrative-0024 | dre_narrated | real | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 24407 | 2 |
| dre-narrative-0025 | dre_narrated | real | ❌ | {"clareza":2,"acionabilidade":3,"factualidade":5} | — | 16087 | 2 |
| dre-narrative-0026 | dre_narrated | synthetic | ❌ | {"clareza":2,"acionabilidade":5,"factualidade":5} | — | 19607 | 2 |
| dre-narrative-0027 | dre_narrated | synthetic | ❌ | {"clareza":2,"acionabilidade":5,"factualidade":2} | — | 35559 | 2 |
| dre-narrative-0028 | dre_narrated | synthetic | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 19545 | 2 |
| dre-narrative-0029 | dre_narrated | adversarial | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 23895 | 2 |
| dre-narrative-0030 | dre_narrated | adversarial | ❌ | {"clareza":2,"acionabilidade":5,"factualidade":5} | — | 13420 | 2 |
| dre-narrative-0031 | dre_narrated | adversarial | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 21429 | 2 |
| dre-narrative-0032 | dre_narrated | adversarial | ✅ | {"clareza":5,"acionabilidade":5,"factualidade":5} | — | 17193 | 2 |

</details>
