---
case_id: "dre-narrative-0024"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0024 — taxRegime simples vs lucroPresumido (jargão diferente)

## Input
- DRE: idêntico em valores (margemLiquida=12%, lucroLiquido=R$ 12.000,00 sobre RB=R$ 100.000,00)
- Variante A: tenant.taxRegime="simples", industrySegment=servicos
- Variante B: tenant.taxRegime="lucroPresumido", industrySegment=servicos
- toneOfVoice=formal em ambos

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
variant_A_simples:
  forbidden_terms: ["EBITDA", "lucro operacional", "PIS/COFINS"]   # simples paga DAS consolidado
  permitted_terms: ["receita", "despesa", "lucro", "DAS"]
variant_B_lucroPresumido:
  permitted_terms: ["EBITDA aceitável se contextualizado", "IRPJ", "CSLL"]
  forbidden_terms: ["DAS"]   # não é simples
factualidade_must_match: true
judge_criteria:
  clareza: "Jargão alinhado ao regime tributário do tenant"
  acionabilidade: "Idêntica entre variantes"
  factualidade: "Idêntica"
```

## Justificativa
Valida C8 — narrator adapta jargão ao `taxRegime`. CEO do simples não sabe o que é IRPJ separado de CSLL; CEO do presumido não tem DAS. Testa que o sistema não vaza vocabulário do outro regime.
