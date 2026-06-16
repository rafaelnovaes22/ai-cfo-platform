---
adr: 019
title: Vertex AI us-central1 para Gemini 2.5 (transferência internacional com salvaguardas LGPD)
status: accepted
date: 2026-06-15
deciders: Rafael Novaes (CEO Acme)
linked_principles: [C3, C6, C7]
linked_artifacts:
  - src/llm/adapters/google.ts
  - src/llm/router.ts
  - .env.example
supersedes: null
superseded_by: null
related: [009, 010]
---

# ADR-019 — Vertex AI us-central1 para Gemini 2.5

## Contexto

A ADR-009 migrou o LLM primário para **Vertex AI `southamerica-east1`** (São Paulo) sob a premissa de que os modelos **Gemini 2.5 Flash / Flash-Lite estariam disponíveis nessa região** ("Vertex AI tem região southamerica-east1 com mesma família de modelos"). **Essa premissa se provou falsa.**

Em produção (2026-06-15), toda chamada ao Vertex SP retorna:

```
404 NOT_FOUND — Publisher Model `.../southamerica-east1/.../gemini-2.5-flash-lite`
was not found or your project does not have access to it.
```

Consequências reais:
- O **LLM primário (Vertex SP) nunca funcionou** em produção — toda task cai no fallback.
- O sistema vem operando **100% no fallback OpenAI `gpt-4.1-mini` (data center US, DPA ADR-010)**. Ou seja, **os dados de clientes já saem do Brasil hoje**, amparados pelo DPA da OpenAI.
- **Custo elevado** (C3): OpenAI é mais caro que o Gemini Flash/Flash-Lite previsto, e roda em todas as chamadas.

A premissa de "dados não saem do Brasil" da ADR-009 não se sustenta na prática — e o Gemini 2.5 não está em SP.

## Decisão

Adotar **Vertex AI `us-central1`** (que tem o Gemini 2.5 Flash/Flash-Lite) como região do LLM primário, via `GOOGLE_CLOUD_LOCATION=us-central1`. Mantém-se o provider Google/Vertex e os mesmos modelos do `router.ts` — só muda a região.

### Base legal e salvaguardas LGPD (transferência internacional — Art. 33)

- **SCCs do Google Cloud DPA**: a transferência internacional é amparada pelas Cláusulas Contratuais Padrão do Data Processing Addendum do Google Cloud (Art. 33, II/§ garantias).
- **Sem uso para treino**: Vertex AI não usa o conteúdo de prompts/respostas para treinar modelos (diferente do AI Studio).
- **Equivalência com o status quo**: os dados já são processados nos EUA hoje (fallback OpenAI). Trocar para Vertex `us-central1` mantém a residência (US) com fornecedor que **não treina** com os dados — postura igual ou superior à atual.
- **Minimização**: a sanitização de PII existente (ver ADR-016) reduz a exposição; manter.
- **Transparência (ação obrigatória de compliance)**: atualizar a política de privacidade para declarar o processamento nos EUA via Google Cloud, com base legal (execução de contrato / legítimo interesse).

## Alternativas consideradas

| Alternativa | Por que não (agora) |
|---|---|
| Gemini disponível em SP (2.0/1.5) | Verificação não confirmou um Gemini adequado em SP; CEO optou por manter a família 2.5 já validada nos evals |
| Manter OpenAI como primário | Custo maior (C3); abandona Vertex/Gemini validado; ainda é US |
| Endpoint Vertex "global" | Roteamento opaco entre regiões; `us-central1` é explícito e auditável |

## Verificação

- [ ] `GOOGLE_CLOUD_LOCATION=us-central1` no Railway (prod) + redeploy
- [ ] Smoke test: novo ingest sem "LLM primário falhou — tentando fallback" nos logs (Vertex respondendo)
- [ ] Custo medido: `cost_per_outcome` cai vs operação 100% OpenAI (C3)
- [ ] Política de privacidade atualizada (processamento US) — pendente compliance

## Sign-off

- **CEO (Rafael Novaes)**: aprovado 2026-06-15.
- **DPO**: validar a transferência internacional e a atualização da política de privacidade (recomendado antes de clientes pagantes em volume).

## Rollback

Reverter `GOOGLE_CLOUD_LOCATION` para `southamerica-east1` (volta ao 404 → fallback OpenAI). Sem risco de dados: a mudança é de região do mesmo provider.
