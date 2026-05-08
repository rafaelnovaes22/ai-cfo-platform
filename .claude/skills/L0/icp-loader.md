---
name: icp-loader
description: Carrega e expõe o ICP (Ideal Customer Profile) da organização — quem é cliente-alvo, quem está fora, sinais de qualificação e desqualificação. Use no início de fluxos de spec, diagnóstico ou pré-venda. Não lê Tier 2/3.
tier: 1
vocabulary_aliases: [L0, Strategic, Macro]
linked_principles: [C5, C7]
helper_pattern: bmad
cache_strategy: ephemeral-strong
reads_from_tier: [1]
must_not_read: [2, 3]
version: 0.1.0
activation:
  paths:
    - docs/icp.md
    - docs/strategy/icp.md
    - examples/*/icp.md
    - examples/*/portfolio.md
  keywords: [ICP, ideal customer, cliente-alvo, qualificação, anti-ICP, segmento]
  explicit_invocation: "@icp-loader"
---

# icp-loader — Skill Tier 1 (Estratégico)

## Propósito

Carrega o **Ideal Customer Profile** da organização em formato compacto e cacheável: segmento, porte, tickets típicos, sinais de qualificação (positivos) e de **anti-ICP** (negativos). Skill Tier 1 — não conhece cliente individual, só o perfil agregado.

> Cliente concreto (com baseline, contrato, instância de agente rodando) é **Tier 2** — use `tenant-context-loader` quando existir. Esta skill trata só do template/perfil em nível organizacional.

## Quando ativa

1. **Path-scoped** — turno toca arquivo listado em `activation.paths`
2. **Keyword-scoped** — conversa menciona termo de `activation.keywords`
3. **Explícita** — `@icp-loader` no prompt
4. **Indireta** — skill Tier 2/3 declara dependência de ICP (ex: spec de SKU verificando se cliente cabe no perfil)

## O que lê

Resolve em ordem de precedência:

| # | Path | Cenário |
|---|---|---|
| 1 | `docs/icp.md` | raiz canônica |
| 2 | `docs/strategy/icp.md` | projetos com `docs/` por domínio |
| 3 | `examples/{org}/icp.md` | repo de framework com múltiplos exemplos |
| 4 | `examples/{org}/portfolio.md` § `ICP` | ICP embutido em portfolio |

Se nenhum existir → `icp_missing: true` e orienta criar via `/acme:diagnose` (Fase 0 inclui ICP — C1).

## O que entrega

Output determinístico, **≤ 600 tokens**, em YAML compacto:

```yaml
icp_loaded: true
source_path: docs/icp.md
segments:
  - name: <ex: PMEs B2B SaaS>
    size_band: <faixa de receita ou headcount>
    pain: <dor central em 1 frase>
qualification_signals:    # 3-7 itens
  - <sinal positivo objetivo>
disqualification_signals: # 3-7 itens (anti-ICP)
  - <sinal de "não é cliente">
typical_ticket_band:
  monthly: <faixa em moeda local>
  annual: <faixa>
sales_cycle_days: <faixa>
last_reviewed: YYYY-MM-DD
```

Quando `icp_missing: true`:

```yaml
icp_loaded: false
icp_missing: true
checked_paths: [...]
recommended_action: "Rodar /acme:diagnose; ICP é output da Fase 0"
```

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Vou inferir ICP dos clientes atuais" | Clientes atuais = Tier 2; ICP é Tier 1 declarado | Retornar `icp_missing` se não declarado |
| "Sem anti-ICP explícito posso pular" | Anti-ICP é tão importante quanto ICP — define onde **não** caçar | Falhar verification gate sem `disqualification_signals` |
| "Vou usar o ICP do cliente X que cabe melhor" | Confunde Tier 1 (perfil) com Tier 2 (instância) | Usar `tenant-context-loader` para cliente concreto |
| "Misturo segmentos pra dar mais opção" | ICP ambíguo é o mesmo que ICP ausente — destrói qualificação | Cada `segment` é declarado separadamente |
| "ICP de 3 anos atrás ainda serve" | Mercado muda; ICP > 365 dias precisa revisão | Retornar `icp_outdated` se `last_reviewed` envelhecido |

## Verification gate

Skill considera-se aplicada **com sucesso** quando:

- [x] `icp_loaded: true` retornado em ≤ 600 tokens
- [x] Pelo menos 1 `segment` declarado com `name`, `size_band`, `pain`
- [x] `qualification_signals` ≥ 3 itens
- [x] `disqualification_signals` ≥ 3 itens (anti-ICP é mandatório)
- [x] `last_reviewed` presente e ≤ 365 dias
- [x] Nenhuma leitura registrada em paths Tier 2/3

Se algum item falhar → erro estruturado, não retorna ICP parcial.

## Helper pattern (BMAD) — cache strategy

Mesmo modelo de `company-dna`: **ephemeral-strong**.

1. Primeira chamada no run → lê, parseia, popula `__forge_cache.icp`
2. Chamadas subsequentes → cache; não re-lê
3. Fim do run → cache descartado

Detalhes em `docs/forge/helper-pattern.md`.

## C5 hard rule

Esta skill **não pode**:

- Ler arquivos de Tier 2 (`docs/clients/`, `tenants/`, `baseline-cost*.md`)
- Ler arquivos de Tier 3 (`runs/`, `outcomes/`, `eval-cases/`)
- Importar contexto de skills `L1/`, `L2/`
- Receber `tenant_id`, `client_name` como parâmetro

Violação → FAIL na auditoria mensal.

## Saída de erro estruturada

```yaml
icp_loaded: false
error: <enum>
checked_paths: [...]
hint: <ação recomendada>
```

`error` ∈ `icp_missing` | `icp_malformed` | `icp_outdated` | `icp_no_anti_icp` | `multiple_icp_found`.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-1 onda 1 |
