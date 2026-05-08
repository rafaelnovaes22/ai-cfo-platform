# Acme Forge — Constitution

> **Versão**: 0.2.0
> **Data**: 2026-04-30
> **Aprovação**: ✅ Mantenedor
> **Mudanças**: exigem nova ADR + bump de versão + comunicação ao reviewer (DeepAgent / GPT-5.5)

---

## Como esta Constitution é usada

Este arquivo é a **fonte canônica de princípios** que regem qualquer projeto operado pelo Acme Forge. Ele é:

- Carregado automaticamente pelo Claude Code via referência em `CLAUDE.md` raiz do projeto consumidor
- Lido pelo reviewer externo (DeepAgent / GPT-5.5) a cada auditoria
- Versionado em SemVer; toda mudança de princípio é breaking

A Constitution define **8 princípios genéricos (C1–C8)** aplicáveis a qualquer projeto que construa **agentes de IA com governança de outcome cobrável**, independentemente do domínio (financeiro, comercial, atendimento, educacional, etc.).

> Princípios específicos do contexto Acme (lifecycle, two-track economics, portfolio em 3 categorias) vivem em [`examples/acme/constitution-extension.md`](../examples/acme/constitution-extension.md). Outros projetos podem definir suas próprias extensões.

---

## Os 8 princípios

### C1 — Diagnose-before-design

**Regra**: Nenhuma capability, agente ou produto novo começa sem **diagnóstico estruturado** documentado e aprovado por quem paga.

**Por quê**: Construir antes de diagnosticar é como prescrever sem examinar. O processo automatizado em cima de caos vira caos automatizado, mais rápido. Diagnóstico estruturado:
- Qualifica o problema (vale a pena resolver?)
- Mede o baseline (custo humano atual)
- Define o outcome cobrável (o que conta como "feito")
- Filtra clientes não-sérios (quem não topa pagar diagnóstico raramente vira cliente)

**Como validar**:
- Para cada agente em produção, existe artefato `diagnostic.md` (ou equivalente) referenciado
- Artefato lista pelo menos: problema declarado, baseline humano, outcome proposto, métrica de sucesso
- Reviewer audita relação 1:1 entre agentes em produção e diagnósticos arquivados

**Exceções**: SKUs marcados `is_example: true` ou `is_internal: true` (showcase/dev) podem rodar sem diagnóstico — mas devem ter o flag explícito.

---

### C2 — Outcome-first, never tech-first

**Regra**: Toda spec começa pela **cláusula contratual de outcome**: o que vai ser entregue, em que condições, com que tolerância de erro. Stack, modelos, arquitetura vêm depois.

**Por quê**: Sem outcome definido como cláusula, há disputa eterna ("isso conta?", "aquilo deveria contar"). Definição vaga de outcome é a armadilha mais comum em SaaS² agêntico.

**Como validar**:
- Toda spec de agente/produto tem seção "Cláusula de outcome" com: definição em 1 frase, 3 exemplos positivos, 3 exemplos negativos, evento técnico que dispara `DELIVERED`
- Categorias de outcome têm threshold mínimo de acurácia declarado
- Reviewer audita correspondência entre cláusula da spec e schema de saída do código

**Exceções**: nenhuma. Outcome ausente = spec inválida.

---

### C3 — Cost ≤ 25% of price

**Regra**: O custo de inferência por outcome **não pode** exceder 25% do preço cobrado pelo outcome. Hard gate de unit economics.

**Por quê**: Margem comprimida por LLM mata SaaS² agêntico silenciosamente — o custo só aparece com volume, quando contrato já está assinado. Regra prática: quem cobra R$ 5 por outcome que custa R$ 4,80 em token quebra em meses ruins.

**Como validar**:
- Cada agente em produção tem `unit-economics.md` correspondente com tokens medidos, preço unitário, e razão custo/preço
- Razão ≤ 25% no documento E confirmada por traces dos últimos 30 dias
- Hook `unit-economics-recalc` recalcula quando prompts mudam

**Exceções**:
- Durante modo SHADOW (sem cobrança variável), regra não bloqueia
- Para produtos com pricing fixo (não outcome-based), traduz-se para "custo de inferência mensal por usuário ≤ 25% do ARPU"

**Ajuste para outros contextos**: o limite default é 25%; projetos podem ajustar via extensão da Constitution justificando trade-offs (ex: em mercado high-margin, 35%; em commodity, 15%).

---

### C4 — SHADOW antes de cobrar

**Regra**: Nenhum agente vai a billing variável (ou autonomia operacional sem revisão humana) sem passar por **modo SHADOW**:

| Modo | Comportamento |
|---|---|
| **SHADOW** | Agente roda mas output não é entregue/cobrado; humano executa em paralelo; mede-se concordância |
| **ASSISTED** | Agente roda e propõe; humano aprova antes de executar/entregar; mede-se taxa de aprovação sem edição |
| **AUTONOMOUS** | Agente executa diretamente; humano audita amostra; mede-se taxa de erro pós-execução |

Promoção entre modos exige:
- N execuções mínimas no modo atual
- Threshold de qualidade definido em pré-contrato
- Eval suite passing
- Aprovação humana explícita

**Por quê**: Cobrar/automatizar em SHADOW é receita garantida de atrito comercial e operacional. CEO/decisor não confia em IA no início — está certo. Build trust gradually.

**Como validar**:
- Toda subscription/instância de agente tem campo `mode` enum
- Promoção de modo registrada em log auditável
- Reviewer audita transições

**Exceções**: nenhuma. Mesmo cliente disposto a "pular SHADOW" precisa ≥ 14 dias em SHADOW.

---

### C5 — Three-tier context

**Regra**: Toda skill, agent ou prompt declara em qual **tier** opera e respeita herança hierárquica:

| Tier | Conteúdo | Lê de |
|---|---|---|
| **Tier 1 — Estratégico** | DNA da organização, ICP, ofertas, glossário, princípios | apenas Tier 1 |
| **Tier 2 — Tático** | Cliente, projeto, configuração de instância, baseline | Tier 1 + Tier 2 |
| **Tier 3 — Operacional** | Execução, outcome, run individual, eval case | Tier 1 + Tier 2 + Tier 3 |

**Por quê**: Herança hierárquica evita duplicação, dá contexto consistente, permite cache. Quebrar a hierarquia (Tier 1 lendo Tier 3) destrói o helper pattern e estoura tokens.

**Como validar**:
- Frontmatter de toda skill declara `tier: 1|2|3` (ou nomes equivalentes)
- Lint bloqueia skill Tier 1 que importe contexto de Tier 2/3
- Reviewer audita amostra mensal

**Vocabulário alternativo**: alguns contextos usam "L0/L1/L2" (vocabulário Sincra), "Strategic/Tactical/Operational", ou "Macro/Meso/Micro". O importante é a **hierarquia de leitura**, não os nomes.

**Exceções**: nenhuma — quebra de hierarquia indica problema de modelagem, não exceção legítima.

---

### C6 — Telemetry-by-default

**Regra**: Toda chamada a LLM em produção **deve** ter trace observável correspondente (input, output, custo, latência). Sem trace, não conta como outcome auditável.

**Por quê**: Sem trace:
- Reviewer não consegue auditar
- Cliente não pode contestar outcome
- Drift detection vira impossível
- Auditoria mensal LLM-as-judge não roda

**Como validar**:
- Lint regex em código de produção exige instrumentação (ex: `langfuse.observe()` ou wrapper equivalente) em chamadas a LLM
- Hook `telemetry-trace-check` audita correspondência outcomes ↔ traces (desvio > 1% = FAIL)
- Reviewer compara contagem mensal

**Provedores compatíveis**: Langfuse, Helicone, Phoenix, custom em DB próprio. O Forge não opina sobre o provedor — opina sobre a obrigação de tracing.

**Exceções**: scripts pontuais e seeds que rodam offline podem rodar sem trace, desde que **não** estejam em fluxo de produção.

---

### C7 — Portability over lock-in

**Regra**: Modelos, provedores, ferramentas mudam. **Processo**, **input/output**, **handoff**, **artefato** **não**. Toda dependência específica de modelo/fornecedor é isolada em camada de abstração (`src/llm/`, `src/infra/`, ou equivalente).

**Por quê**: Mercado de LLM em transição rápida. Cliente em produção não pode parar porque OpenAI mudou preço ou Anthropic mudou rate limit. Arquitetura precisa abstrair o modelo desde o dia 1.

**Como validar**:
- Imports do SDK de LLM (`@anthropic-ai/sdk`, `openai`, `@google-ai/generativelanguage`) são proibidos fora da camada de abstração
- Skills/specs são markdown/templates sem lógica de modelo
- Trocar modelo (mesma família ou cross-provider) não exige mudança em specs/skills, só em config

**Exceções**: SDKs de provedores específicos podem aparecer em scripts internos (eval, debug, reviewer) que vivem em pasta separada.

---

### C8 — Anti-customização heroica

**Regra**: Cliente N do mesmo agente/SKU/produto = **configuração**, não branch. Customização entra como:
1. **Configuração de tenant** (campos no contexto do tenant)
2. **Variante de agente** (novo SKU empacotado, com código distinto)
3. **NUNCA** como if/switch por nome de tenant em código

**Por quê**: Customização heroica destrói margem e impede catálogo. Cada pedido de "só essa pequena adaptação" vira código que não escala.

**Como validar**:
- Lint detecta `if (tenantId === '...')`, `switch (tenantName)` ou similares em código de produção
- Não existem pastas `clients/{nome}/`, `tenants/{nome}/` em código de skills/agents
- Reviewer audita drift de customização disfarçada

**Exceções**: durante onboarding do **primeiro cliente** de um novo agente, pode haver hardcode temporário em arquivo dedicado por **até 14 dias**. Após isso, vira config no contexto do tenant ou novo agente no catálogo.

---

## Hierarquia de autoridade

Quando dois princípios entram em conflito, a ordem é:

1. **C1** (Diagnose) — fundamento de tudo
2. **C2** (Outcome) — define cláusula contratual
3. **C3, C4** (Economics, SHADOW) — proteção comercial
4. **C5, C6** (Three-tier, Telemetry) — disciplina técnica
5. **C7, C8** (Portability, Anti-custom) — sanity de longo prazo

Exemplo: cliente urgente exige autonomia imediata sem SHADOW (viola C4) e justificativa é técnica (viola C2). O conflito **não deve ser resolvido** — o pedido viola a base. Renegociar escopo ou recusar.

---

## Mudanças nesta Constitution

Para alterar, adicionar ou remover qualquer princípio:

1. Abrir nova ADR justificando (em `docs/adr/00X-constitution-change.md` no projeto consumidor)
2. Bump de versão semver: alteração de regra = MINOR; remoção/quebra = MAJOR
3. Atualizar `manifest.json` com novo `constitution_version`
4. Notificar o reviewer DeepAgent (atualizar prompt em [`reviewer/prompt.template.md`](../reviewer/prompt.template.md))
5. Comunicar ao time em onboarding e changelog do projeto
6. Atualizar [`CHANGELOG.md`](../CHANGELOG.md) raiz do Forge

---

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — 8 princípios fundadores (acoplados ao contexto Acme) |
| 0.2.0 | 2026-04-30 | Generalização — princípios desacoplados de Acme específico; vocabulário multi-domínio; refs a examples/acme/ para extensões |

---

## Extensões e exemplos

- [`examples/acme/constitution-extension.md`](../examples/acme/constitution-extension.md) — Extensões C9, C10, C11 específicas do contexto Acme (lifecycle, two-track economics, portfolio em 3 categorias)
- [`examples/acme/methodology/`](../examples/acme/methodology/) — Metodologias Acme (clássica, SaaS², Sincra) que originaram esta Constitution
- [`reviewer/prompt.template.md`](../reviewer/prompt.template.md) — Como o reviewer DeepAgent valida cada princípio
