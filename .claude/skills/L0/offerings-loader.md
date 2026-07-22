---
name: offerings-loader
description: Carrega e expõe o catálogo de ofertas da organização (produtos, SKUs de plataforma, diagnósticos cobráveis) com stage de lifecycle e modelo de cobrança. Use no início de fluxos de spec, pré-venda ou auditoria de portfolio. Não lê Tier 2/3.
tier: 1
vocabulary_aliases: [L0, Strategic, Macro]
linked_principles: [C2, C5, C7]
helper_pattern: bmad
cache_strategy: ephemeral-strong
reads_from_tier: [1]
must_not_read: [2, 3]
version: 0.1.0
activation:
  paths:
    - docs/offerings.md
    - docs/portfolio.md
    - docs/strategy/portfolio.md
    - examples/*/portfolio.md
    - examples/*/products/*.md
  keywords: [portfolio, ofertas, catálogo, SKU, produto, diagnóstico, offering]
  explicit_invocation: "@offerings-loader"
---

# offerings-loader — Skill Tier 1 (Estratégico)

## Propósito

Carrega o **catálogo de ofertas** da organização em formato compacto e cacheável: produtos self-serve, SKUs de plataforma high-touch, diagnósticos cobráveis. Para cada oferta entrega `name`, `category`, `pricing_model`, `lifecycle_stage`, `linked_outcome_clause`. Skill Tier 1 — não conhece instância de oferta vendida (isso é Tier 2).

> Categorização default segue o modelo Novais Digital (Diagnóstico / Plataforma / Produto). Outras organizações podem usar suas próprias categorias declaradas no portfolio — a skill carrega o que está declarado, não impõe taxonomia.

## Quando ativa

1. **Path-scoped** — turno toca arquivo listado em `activation.paths`
2. **Keyword-scoped** — conversa menciona termo de `activation.keywords`
3. **Explícita** — `@offerings-loader` no prompt
4. **Indireta** — skill Tier 2/3 declara dependência (ex: spec de novo SKU verificando duplicidade no catálogo)

## O que lê

Resolve em ordem de precedência:

| # | Path | Cenário |
|---|---|---|
| 1 | `docs/offerings.md` | catálogo único raiz |
| 2 | `docs/portfolio.md` | nomenclatura alternativa |
| 3 | `docs/strategy/portfolio.md` | projetos com `docs/` por domínio |
| 4 | `examples/{org}/portfolio.md` + `examples/{org}/products/*.md` | repo de framework com caso real |

Se nenhum existir → `offerings_missing: true` e orienta criar a partir do template `examples/novais-digital/portfolio.md` (referência canônica).

## O que entrega

Output determinístico, **≤ 800 tokens** (mais alto que DNA/ICP por ser lista), em YAML compacto:

```yaml
offerings_loaded: true
source_paths: [docs/portfolio.md, examples/novais-digital/products/novais-digital-fin.md]
total_offerings: <N>
offerings:
  - id: <slug>
    name: <nome humano>
    category: <diagnostic|platform-sku|product|outro-declarado>
    pricing_model: <fixed-monthly|outcome-based|one-shot|hybrid>
    lifecycle_stage: <discovery|mvp|beta|ga|maturity|sunset>
    linked_outcome_clause: <ref a spec ou null se diagnostic>
    spec_path: <docs/specs/.../spec.md ou null>
    last_reviewed: YYYY-MM-DD
last_reviewed: YYYY-MM-DD   # do catálogo como um todo
```

Quando `offerings_missing: true`:

```yaml
offerings_loaded: false
offerings_missing: true
checked_paths: [...]
recommended_action: "Criar docs/portfolio.md a partir de examples/novais-digital/portfolio.md"
```

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Listo só os ativos (em GA), pula os em Discovery" | Catálogo completo é input de governança (C9 lifecycle); filtro é decisão Tier 2/3 | Sempre listar todos com `lifecycle_stage` declarado |
| "Sem `pricing_model` declarado, vou inferir do contexto" | Pricing ambíguo é a causa mais comum de violação C2 (outcome) e C3 (economics) | Falhar verification gate; exigir declaração explícita |
| "Posso ler também os specs detalhados pra contextualizar" | Specs de cliente concreto são Tier 2; especs gerais de oferta podem ser referenciadas mas não lidas integralmente em L0 | Retornar só `spec_path` (ponteiro), deixar leitura para Tier 2 |
| "Oferta sem outcome cobrável é diagnóstico" | Errado — pode ser produto self-serve (mensalidade fixa). Categoria deve ser declarada | Validar que `category` está no enum; falhar se ausente |
| "Vou usar o catálogo cached de 30 dias atrás" | Catálogo muda mais que DNA/ICP; cache só vale dentro do run | Recarregar a cada run; cache **ephemeral** |

## Verification gate

Skill considera-se aplicada **com sucesso** quando:

- [x] `offerings_loaded: true` retornado em ≤ 800 tokens
- [x] `total_offerings` ≥ 1
- [x] Cada oferta tem `id`, `name`, `category`, `pricing_model`, `lifecycle_stage`, `last_reviewed`
- [x] Toda oferta com `category != "diagnostic"` tem `linked_outcome_clause` ou `spec_path` apontando para arquivo existente
- [x] Toda oferta com `lifecycle_stage ∈ {ga, maturity}` tem `linked_outcome_clause` (não pode estar em GA sem outcome contratual — C2)
- [x] Nenhuma leitura registrada em paths Tier 2/3

Se algum item falhar → erro estruturado, não retorna catálogo parcial.

## Helper pattern (BMAD) — cache strategy

Mesmo modelo das outras skills L0: **ephemeral-strong**.

Uma chamada por run → cache → reuso por skills L1/L2 que precisem de contexto de catálogo (ex: `sku-prompt-builder` checando colisão de naming).

Detalhes em `docs/foundry/helper-pattern.md`.

## C5 hard rule

Esta skill **não pode**:

- Ler arquivos de Tier 2 (`docs/clients/`, `tenants/`, `subscriptions/`, `baseline-cost*.md`)
- Ler arquivos de Tier 3 (`runs/`, `outcomes/`, `eval-cases/`)
- Ler **conteúdo integral** de specs em `docs/specs/` — só registra `spec_path` como ponteiro
- Importar contexto de skills `L1/`, `L2/`
- Receber `tenant_id`, `subscription_id`, `run_id` como parâmetro

Violação → FAIL na auditoria mensal.

## Saída de erro estruturada

```yaml
offerings_loaded: false
error: <enum>
checked_paths: [...]
hint: <ação recomendada>
```

`error` ∈ `offerings_missing` | `offerings_malformed` | `offering_in_ga_without_outcome_clause` (viola C2) | `unknown_category` | `unknown_pricing_model` | `lifecycle_stage_missing` (viola extensão C9 quando aplicável).

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Foundry-1 onda 1 |
