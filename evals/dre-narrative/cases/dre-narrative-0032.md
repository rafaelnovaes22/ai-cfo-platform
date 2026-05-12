---
case_id: "dre-narrative-0032"
module: "dre-narrative"
outcome: "dre_narrated"
source_mode: "adversarial"
priority: "P1"
created_at: "2026-05-12"
---

# Case dre-narrative-0032 — LLM retorna JSON com fence Markdown (retry + fallback)

## Input
- DRE: PME serviços padrão (margemLiquida=10%)
- Cenário: 1ª chamada Gemini Flash retorna `\`\`\`json\n{ "cards": [...] }\n\`\`\`` com fence indevida → parser falha → retry 1× com prompt reforçado "retorne JSON puro, sem fence" → se falhar novamente, fallback Sonnet 4.6
- Tenant: industrySegment=servicos, taxRegime=simples, toneOfVoice=formal

## Ground truth (rubrica)
```yaml
expected_cards_count: 3                # após retry/fallback, saída válida
robustness_requirements:
  retry_count_max: 1                   # 1 retry no Gemini antes do fallback
  fallback_model: "claude-sonnet-4-6"
  final_response_must_parse_as_pure_json: true
  langfuseTraceId_must_record_retry_and_fallback: true
  costCents_must_accumulate_all_attempts: true
judge_criteria:
  clareza: "Saída final tem qualidade equivalente, independente de qual modelo respondeu"
  acionabilidade: "Mesma; ação não muda por fallback"
  factualidade: "Mesma; números do DRE"
monitoring:
  fallback_rate_alert: ">5% em janela 24h dispara alerta"
```

## Justificativa
Spec §5 ("LLM retorna JSON inválido") e §11 risco "JSON inválido / fence Markdown". Eval mede que pipeline absorve falhas de formato sem perder qualidade. Testa instrumentação Langfuse (C6) através de retry+fallback. Mede taxa real de fallback que aciona ADR-002.
