---
# Novais Digital Foundry — Agent Memory Template
# Equivalente ao MEMORY.md do Hermes. Fatos aprendidos de um projeto consumer.
# Instalar em: docs/clients/{client_id}/agent-memory.md
# Carregado por foundry-context.sh a cada SessionStart (Foundry-20).
# Princípios: C6 (source_run_id obrigatório), C7 (agnóstico), C8 (sem tenant hardcode)
#
# Formato de fato:
#   § [confidence:{local|shadow|assisted|autonomous}] [YYYY-MM-DD] [run:{run_id}] Descrição
#
# Regras:
#   - NUNCA incluir credenciais, tokens, dados pessoais reais, CPF, email de usuário
#   - NUNCA referenciar outro tenant — fatos são exclusivos deste projeto
#   - Confiança sobe com lifecycle stage: local < shadow < assisted < autonomous
#   - Fatos obsoletos devem ser removidos ou marcados com [OBSOLETO]
#   - Máx ~50 fatos ativos; arquivar em agent-memory-archive.md quando exceder
---

# Agent Memory — {project_name}

> Fatos aprendidos do projeto **{project_name}** ao longo das sessões Foundry.
> Cada fato tem rastreabilidade obrigatória: confidence + data + run_id (C6).
> Gerenciado pelo Hermes Learning Loop via PRs automáticos após cada sessão SHADOW+.

## § integration_quirks

Particularidades técnicas das integrações deste projeto.

<!-- Exemplo:
§ [confidence:shadow] [2026-05-18] [run:local] Webhook Salesforce tem latência >3s — usar poll ao invés de push
§ [confidence:assisted] [2026-05-20] [run:gh-1234] API de pagamento retorna 202 antes de processar — aguardar webhook confirm
-->

## § process_patterns

Como o cliente prefere que o trabalho seja feito.

<!-- Exemplo:
§ [confidence:local] [2026-05-18] [run:local] Rafael prefere commits pequenos e atômicos, um por feature
§ [confidence:shadow] [2026-05-19] [run:gh-1100] PRs devem ter descrição em português e test plan explícito
-->

## § pitfalls

O que já falhou e por quê. Nunca repetir.

<!-- Exemplo:
§ [confidence:shadow] [2026-05-18] [run:gh-1050] Gate G3 falhou — eval suite tinha <30 casos por categoria
§ [confidence:assisted] [2026-05-21] [run:gh-1300] Deploy Railway falhou por PORT env var hardcoded em código
-->

## § confirmed_patterns

O que funcionou e foi confirmado em SHADOW ou AUTONOMOUS.

<!-- Exemplo:
§ [confidence:autonomous] [2026-05-25] [run:gh-1500] Pattern retry com backoff expo funciona bem neste worker
§ [confidence:assisted] [2026-05-22] [run:gh-1350] Drizzle push funciona em staging mas precisa migrate em prod
-->

## § tech_constraints

Restrições técnicas aprendidas na prática (complementa agent-soul.md).

<!-- Exemplo:
§ [confidence:shadow] [2026-05-18] [run:local] Node 20 com ESM — imports precisam de extensão .js explícita
§ [confidence:shadow] [2026-05-19] [run:gh-1100] Railway limita memory a 512MB no plano atual
-->

## § economics_real

Custos e volumes reais observados (alimenta unit-economist guardian).

<!-- Exemplo:
§ [confidence:shadow] [2026-05-18] [run:gh-1000] Sessão típica de /novais-digital:implement custa ~$0.45 em tokens
§ [confidence:shadow] [2026-05-20] [run:gh-1200] Volume de eval: ~150 casos/mês — bem dentro do limite C4
-->

## § telemetry_hints

Dicas para observability-guardian neste projeto.

<!-- Exemplo:
§ [confidence:local] [2026-05-18] [run:local] Langfuse project_id=prj_example — traces ativos
§ [confidence:shadow] [2026-05-19] [run:gh-1100] Campo extra útil nos traces: user_segment (free|premium)
-->

## § pii_categories

Categorias de PII presentes neste projeto (sem dados reais — apenas categorias).

<!-- Exemplo:
§ [confidence:local] [2026-05-18] [run:local] PII presente: email, nome completo, data nascimento
§ [confidence:local] [2026-05-18] [run:local] Dados de pagamento via Stripe — não chegam ao backend próprio
-->
