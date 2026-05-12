---
case_id: "dre-narrative-0019"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "real"
priority: "P0"
created_at: "2026-05-12"
---

# Case dre-narrative-0019 — Card attention em folha desproporcional (40% RL)

## Input
- DRE: despesasPessoal=R$ 30.000,00; prolabore=R$ 10.000,00; receitaLiquida=R$ 100.000,00; (pessoal+prolabore)/RL = 40,00%; margemLiquida=22,00% (vide dre-narrative-0003)
- Tenant: industrySegment=servicos, taxRegime=simples, toneOfVoice=informal
- referenceMonth: "2026-04"

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
attention_card:
  must_reference: ["despesasPessoal", "prolabore", "receitaLiquida"]
  must_mention_threshold: "~40%"
  must_propose_action: "ex: 'avalie quanto da folha é investimento vs. operação' — não 'monitore'"
judge_criteria:
  clareza: "PME de serviços entende; tom informal aceito (você, vamos)"
  acionabilidade: "Aponta análise concreta da folha por função/área"
  factualidade: "Soma exata 30k+10k; ratio derivado do DRE"
forbidden_terms: ["compliance", "EBITDA", "stakeholder"]   # toneOfVoice=informal
tone_check: "Permite 'tá pressionando', 'olha', 'vamos olhar'"
```

## Justificativa
Regra §7 borderline (40,00% exatos). Testa que narrator aciona o card attention. Testa adaptação de `toneOfVoice=informal` (jargão proibido, "você" permitido). Caso canônico para serviços com sócio que tira pró-labore.
