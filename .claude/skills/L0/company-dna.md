---
name: company-dna
description: Carrega e expõe o DNA da organização (purpose, mission, values, north-star) em formato compacto e cacheável. Use no início de qualquer fluxo de diagnóstico, spec ou auditoria que precise de framing estratégico Tier 1. Não lê Tier 2/3.
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
    - docs/dna.md
    - docs/strategy/dna.md
    - examples/*/dna.md
    - examples/*/portfolio.md
  keywords: [DNA, propósito, mission, north-star, valores, purpose, organização]
  explicit_invocation: "@company-dna"
---

# company-dna — Skill Tier 1 (Estratégico)

## Propósito

Carrega o **DNA da organização** consumidora do Foundry em formato determinístico e cacheável: propósito, missão, valores, north-star metric, princípios fundadores. Esse contexto é imutável-por-execução: skills Tier 2/3 e agentes downstream consomem via helper pattern em vez de re-lerem o arquivo bruto.

> Em projetos multi-tenant, o "organização" é a entidade-mãe (provedora do serviço), não o tenant final. DNA por tenant é Tier 2 — use `tenant-context-loader` (Foundry-1, escopo Novais Digital-específico).

## Quando ativa

1. **Path-scoped** — turno toca arquivo listado em `activation.paths`
2. **Keyword-scoped** — conversa menciona termo de `activation.keywords`
3. **Explícita** — `@company-dna` no prompt
4. **Indireta** — skill Tier 2/3 declara dependência de DNA via helper pattern

## O que lê

Resolve em ordem de precedência (primeiro encontrado vence):

| # | Path | Cenário |
|---|---|---|
| 1 | `docs/dna.md` | raiz canônica do projeto consumidor |
| 2 | `docs/strategy/dna.md` | projetos com `docs/` por domínio |
| 3 | `examples/{org}/dna.md` | repo de framework com múltiplos exemplos |
| 4 | `examples/{org}/portfolio.md` § `DNA` | DNA embutido em portfolio (caso Novais Digital) |

Se nenhum existir, retorna `dna_missing: true` e orienta criar via `/novais-digital:diagnose` (C1: nada começa sem diagnóstico).

## O que entrega

Output determinístico, **≤ 600 tokens**, em YAML compacto:

```yaml
dna_loaded: true
source_path: docs/dna.md
organization: <nome>
purpose: <1 frase — por que existe>
mission: <1 frase — o que entrega no mundo>
north_star_metric:
  name: <ex: outcomes em AUTONOMOUS>
  target: <ex: ≥ 100 / mês até 2027-Q1>
values: [v1, v2, v3]
founding_principles: [p1, p2]   # opcional, se declarado no DNA
last_reviewed: YYYY-MM-DD
```

Quando `dna_missing: true`:

```yaml
dna_loaded: false
dna_missing: true
checked_paths: [...]
recommended_action: "Rodar /novais-digital:diagnose ou criar docs/dna.md a partir de templates/diagnostic-spec.template.md"
```

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Vou inferir o DNA do README" | DNA precisa ser declarado e datado, não deduzido | Retornar `dna_missing: true` e orientar criar |
| "Vou ler também o ICP/portfolio pra ter contexto completo" | Quebra C5 (Tier 1 não acumula tudo) e estoura cache | Cada loader L0 é independente; orquestração é Tier 2/3 |
| "DNA muda raramente, vou reusar de outra sessão" | Cache é **ephemeral** (escopo da execução); persistir entre sessões cria drift silencioso | Recarregar a cada execução; cachear só dentro do run |
| "Cliente N tem DNA diferente, vou ler do tenant" | Confunde Tier 1 (organização) com Tier 2 (cliente). Quebra C5 e C8 | Skill `tenant-context-loader` (Tier 2) trata DNA por cliente |
| "Vou retornar o markdown bruto pra dar mais contexto" | Quebra a meta do helper pattern (≥70% redução de tokens) | Sempre estruturar em YAML compacto |

## Verification gate

Skill considera-se aplicada **com sucesso** quando:

- [x] `dna_loaded: true` retornado em ≤ 600 tokens
- [x] Todos os campos obrigatórios presentes (`purpose`, `mission`, `north_star_metric`, `values`)
- [x] `source_path` aponta para arquivo existente lido na sessão
- [x] Nenhuma leitura registrada em paths Tier 2/3 (validável por trace)
- [x] Cache disponível para reuso por skills downstream no mesmo run

Se algum item falhar → skill retorna erro estruturado e **não** entrega DNA parcial.

## Helper pattern (BMAD) — cache strategy

Esta skill é **ephemeral-strong**:

1. **Primeira chamada no run** → lê arquivo, parseia, popula cache `__foundry_cache.dna`
2. **Chamadas subsequentes no mesmo run** → retorna cache; **não** re-lê o arquivo
3. **Fim do run** → cache descartado (próxima sessão recarrega do disco)

Skills Tier 2/3 que precisem de DNA chamam `@company-dna` e recebem o YAML compacto, não o markdown bruto. Meta documentada em `docs/foundry/helper-pattern.md`: redução de ≥ 70% de tokens em prompts L2 vs leitura direta repetida.

## C5 hard rule

Esta skill **não pode**:

- Ler arquivos de Tier 2 (`docs/clients/`, `tenants/`, `instances/`, `baseline-cost*.md`)
- Ler arquivos de Tier 3 (`runs/`, `outcomes/`, `eval-cases/`, `traces/`)
- Importar contexto de skills `L1/`, `L2/`
- Receber `tenant_id`, `run_id`, `case_id` como parâmetro

Violação detectada pelo reviewer DeepAgent → FAIL na auditoria mensal (regra C5 em `reviewer/validation-rules.json`).

## Saída de erro estruturada

```yaml
dna_loaded: false
error: <enum>
checked_paths: [...]
hint: <ação recomendada>
```

`error` ∈ `dna_missing` | `dna_malformed` | `dna_outdated` (last_reviewed > 365d) | `multiple_dna_found` (ambíguo).

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Foundry-1 onda 1 |
