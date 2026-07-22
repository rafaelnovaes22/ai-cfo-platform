---
case_id: "dre-narrative-0022"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "real"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0022 — Tom formal vs informal (mesmo DRE)

## Input
- DRE: idêntico ao dre-narrative-0008 (CMV 65%, margem líquida 30%, varejo)
- Variante A: tenant.toneOfVoice="formal"
- Variante B: tenant.toneOfVoice="informal"
- Mesmo `tenantId`, mesmo `referenceMonth=2026-04`

## Ground truth (rubrica)
```yaml
expected_cards_count: 3
variant_A_formal:
  permitted_pronouns: ["Sr./Sra.", "a empresa", "o resultado"]
  forbidden_terms: ["tá", "rola", "manda ver", "show"]
  tone: "respeitoso, 3a pessoa preferida"
variant_B_informal:
  permitted_pronouns: ["você", "vocês"]
  forbidden_terms: ["destarte", "outrossim", "doravante", "compliance"]
  tone: "direto, 2a pessoa, pode usar contrações"
factualidade_must_match_between_variants: true   # números idênticos, narrativa adapta
judge_criteria:
  clareza: "Tom apropriado ao toneOfVoice declarado"
  acionabilidade: "Mesma ação concreta nos 2 tons"
  factualidade: "Idêntica — DRE não muda com tom"
```

## Justificativa
Valida adaptação de `toneOfVoice` (C8 — config por tenant, nunca hardcoded). Mesmo conteúdo factual, embalagem distinta. Importante para SHADOW review: humano confirma que o tom muda sem que o conteúdo factual mude.
