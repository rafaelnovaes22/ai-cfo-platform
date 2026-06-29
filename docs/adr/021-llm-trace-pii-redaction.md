---
adr: 021
title: Redação de PII em traces LLM (LGPD/C6)
status: accepted
date: 2026-06-29
deciders: Rafael Novaes (Engenheiro de IA, Acme)
linked_principles: [C6, C7]
linked_artifacts:
  - src/observability/redact.ts
  - src/llm/index.ts
supersedes: null
superseded_by: null
related: [016, 018]
---

# ADR-021 — Redação de PII em traces LLM

## Contexto

Toda chamada LLM passa por `callLlm` ([src/llm/index.ts](../../src/llm/index.ts)), que envia ao tracer canônico (LangSmith) o `input` (`req.userPrompt`) e o `output` (`response.content`) **crus**. No SKU `monthly-analysis` esses payloads carregam dados do cliente: descrições de lançamentos, e podem conter CPF, CNPJ, e-mail e telefone do titular/contrapartes.

Sob LGPD, exportar esses identificadores para um processador externo (LangSmith) sem redação nem base legal explícita é um risco. Até aqui só o log de mensagens do WhatsApp tinha redação (ADR-018), e mesmo assim no banco local — não no trace. Com o piloto escalando para milhares de clientes, o volume de PII potencialmente exportado cresce proporcionalmente.

## Decisão

Introduzir `redactPii()` ([src/observability/redact.ts](../../src/observability/redact.ts)) e aplicá-la **apenas no caminho do trace** — sobre o `input`, o `output` e a string de erro anexados ao LangSmith. O prompt real entregue ao modelo (via `dispatch`) permanece íntegro: o LLM precisa dos dados completos para classificar/normalizar. A redação não muta o `LlmRequest`.

**Escopo coberto** (identificadores diretos do domínio financeiro brasileiro): CPF, CNPJ, e-mail e telefone com DDD, substituídos por placeholders (`[cpf]`, `[cnpj]`, `[email]`, `[telefone]`).

**Não coberto (limitação consciente):**
- **Nomes próprios em texto livre** (ex: "Pagamento João Silva"): regex de nome é não-confiável (falsos positivos/negativos altos). Mitigação futura: NER ou desligar o input verbatim no trace.
- **Valores monetários**: NÃO são redigidos. São o dado de negócio da análise e não identificam pessoa isoladamente; caixa agregado em texto tem tratamento próprio (ADR-018).

## Consequências

- **LGPD/C6**: traces deixam de exportar os identificadores diretos mais críticos; auditoria e debugging seguem possíveis sobre o texto mascarado.
- **C7 (portabilidade)**: a redação vive na borda da camada de observability, agnóstica ao provider — trocar de tracer não reabre o vazamento.
- **Custo/latência**: desprezível (regex sobre strings em memória).
- **Resíduo**: nomes em texto livre ainda podem aparecer no trace até a mitigação por NER. Documentado como dívida.
- **Verificação**: teste unitário com fixtures de PII ([tests/observability/redact.test.ts](../../tests/observability/redact.test.ts)) garante mascaramento e que valores monetários não são tocados.
