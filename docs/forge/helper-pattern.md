# Helper Pattern (BMAD) — Acme Forge

> **Versão**: 0.1.0
> **Data**: 2026-04-30
> **Origem**: `aj-geddes/claude-code-bmad-skills` (absorvido em Forge-0)
> **Princípio relacionado**: **C5 — Three-tier context**
> **Escopo**: skills Tier 1 (`L0/`) — Tier 2/3 **não** usam helper pattern

---

## Por que helper pattern?

Em projetos com agentes de IA, o conteúdo Tier 1 (DNA, ICP, ofertas, glossário, princípios) é:

- **Estável dentro do run** — não muda durante a execução de um agente
- **Repetidamente consultado** — várias skills/agents downstream precisam da mesma informação
- **Caro em tokens se relido bruto** — markdown completo de DNA pode ter 2-5k tokens

Se cada skill Tier 2/3 lê o markdown bruto do DNA, mesma informação entra no contexto N vezes — token cost linear no número de consumidores.

**Helper pattern** resolve isso: skill Tier 1 lê uma vez, parseia, expõe versão compacta cacheada. Consumidores downstream pedem o cache, não o arquivo.

**Meta documentada**: ≥ 70% de redução de tokens em prompts Tier 2/3 que dependem de Tier 1, medido via Langfuse após Forge-3.

---

## Como funciona — o ciclo de vida

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   1. Início do run                                              │
│      __forge_cache = {}                                         │
│                                                                 │
│   2. Primeiro consumidor pede DNA                               │
│      → @company-dna ativa                                       │
│      → lê docs/dna.md                                           │
│      → parseia em YAML compacto (≤ 600 tokens)                  │
│      → __forge_cache.dna = <yaml compacto>                      │
│      → retorna ao consumidor                                    │
│                                                                 │
│   3. Segundo, terceiro, ... N-ésimo consumidor pede DNA         │
│      → @company-dna ativa                                       │
│      → detecta __forge_cache.dna existe                         │
│      → retorna cache, NÃO re-lê arquivo                         │
│                                                                 │
│   4. Fim do run                                                 │
│      → __forge_cache descartado                                 │
│      → próximo run recarrega do disco                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cache strategies disponíveis

Três estratégias, declaradas no frontmatter da skill como `cache_strategy:`

| Strategy | Comportamento | Quando usar |
|---|---|---|
| **ephemeral-strong** | Cache no run; descartado ao fim. Re-lê em runs novos. | **Default Tier 1** (DNA, ICP, offerings) — conteúdo estável dentro do run mas pode mudar entre runs |
| **ephemeral-weak** | Cache no run, mas qualquer mudança detectada no arquivo invalida. | Tier 1 muito volátil (raro) |
| **none** | Sem cache; lê toda chamada. | Tier 2/3 — **default** porque conteúdo varia por chamada |

> Tier 2/3 **não** usam helper pattern. Sua natureza é variável por execução; cachear quebra correção.

---

## Convenção de namespace

Cache por skill, namespace plano sob `__forge_cache`:

```yaml
__forge_cache:
  dna: <output de @company-dna>
  icp: <output de @icp-loader>
  offerings: <output de @offerings-loader>
```

Skill consumidora referencia `__forge_cache.<key>` em vez de chamar a skill emissora se já estiver cacheado.

> Implementação concreta do cache vem em **Forge-4** (hooks runtime). Até lá, o "cache" é convenção: skills L1/L2 declaram `requires: [@company-dna]` no frontmatter e o orquestrador (manual ou via slash command) garante uma única chamada.

---

## Regras hard

### R1 — Apenas Tier 1 expõe helper pattern

Skills `L0/` declaram `helper_pattern: bmad`. Skills `L1/`, `L2/` **não** podem declarar isso.

**Por quê**: Tier 2/3 são por natureza variáveis (cliente, run, case). Cachear destrói correção.

### R2 — Output cacheável é YAML compacto, não markdown bruto

Skill Tier 1 que devolve markdown bruto **quebra** a meta de redução de tokens. Sempre estruturar em YAML/JSON compacto.

| Formato | Tokens típicos (DNA real) |
|---|---|
| Markdown bruto | 2.000–5.000 |
| YAML compacto (helper pattern) | 300–600 |
| **Redução** | **~85%** |

### R3 — Cache é ephemeral por default

Persistir entre runs (em arquivo, KV, etc.) cria **drift silencioso**: se o DNA mudou e o cache não invalidou, agente roda com contexto desatualizado por horas/dias.

Excecionalmente, em produção pós Forge-4, pode haver cache cross-run com TTL curto (≤ 5 min) e invalidação por hash do arquivo. Não é o caso na fase Forge-1.

### R4 — Skill Tier 1 não pode ler outra Tier 1 via helper pattern

Cada skill Tier 1 é **independente**. `company-dna` não chama `icp-loader`. Composição é responsabilidade da Tier 2/3 (ou do orquestrador).

**Por quê**: agrupamento em Tier 1 vira "super-contexto" que estoura cache e quebra modularidade.

---

## Como skill consumidora referencia o helper

Frontmatter da skill Tier 2/3 declara dependência:

```yaml
---
name: diagnostic-runner
tier: 2
requires_helper:
  - skill: company-dna
    field: dna
  - skill: icp-loader
    field: icp
---
```

No corpo da skill, leitura via `__forge_cache`:

```markdown
## Inputs Tier 1 (via helper pattern)

- DNA: `__forge_cache.dna` (provido por @company-dna)
- ICP: `__forge_cache.icp` (provido por @icp-loader)

Se cache vazio → invocar skill emissora antes de prosseguir.
```

---

## Auditoria do reviewer

O reviewer DeepAgent (Forge-3+) valida mensalmente:

1. Toda skill `L0/` declara `helper_pattern: bmad` e `cache_strategy: ephemeral-strong`
2. Nenhuma skill `L1/L2` declara `helper_pattern: bmad`
3. Output das skills L0 em traces Langfuse < 1.000 tokens (média)
4. Skills L2 que dependem de DNA/ICP/offerings têm `requires_helper:` declarado
5. Redução de tokens em prompts L2 vs baseline (sem helper) ≥ 70%

Regra correspondente em `reviewer/validation-rules.json` será adicionada em Forge-3 quando o reviewer for implementado.

---

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — documenta padrão usado pelas 3 skills L0 da onda Forge-1 (parcial) |
