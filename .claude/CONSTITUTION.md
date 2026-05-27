# Acme Forge — Constitution

> **Versão**: 0.3.0
> **Data**: 2026-05-08
> **Aprovação**: ✅ Mantenedor
> **Mudanças**: exigem nova ADR + bump de versão + comunicação ao reviewer (DeepAgent / GPT-5.5)

---

## Como esta Constitution é usada

Este arquivo é a **fonte canônica de princípios** que regem qualquer projeto operado pelo Acme Forge. Ele é:

- Carregado automaticamente pelo Claude Code via referência em `CLAUDE.md` raiz do projeto consumidor
- Lido pelo reviewer externo (DeepAgent / GPT-5.5) a cada auditoria
- Versionado em SemVer; toda mudança de princípio é breaking

A Constitution define **8 princípios genéricos (C1–C8)** aplicáveis a qualquer projeto que entregue **outcomes governados** — independentemente do tipo de entrega.

---

## Tipos de projeto suportados (v0.3.0)

A v0.3.0 desacopla a Constitution do pressuposto de "agente de IA". O Forge passa a reconhecer formalmente quatro tipos de projeto consumidor:

| `project_type` | O que é | Exemplos |
|---|---|---|
| `agentic_saas` | Centrado em agentes de IA com governança de outcome cobrável (default histórico do Forge). | Acme Fin, SKUs SaaS² |
| `platform` | Plataforma SaaS/operacional com módulos CRUD/CRM/financeiro/etc. Outcome = ação operacional verificável (tela/API/dado persistido). IA pode estar ausente ou pontual. | SchoolPlatform, sucessor de CAPSYSTEM |
| `automation` | Automações operacionais determinísticas (jobs, workers, integrações, RPA). Outcome = execução verificável; IA opcional. | Pipelines internos, ETL governado |
| `hybrid` | Plataforma com módulos agênticos. Convive `ai_enabled=true` em alguns módulos, `false` em outros. | SaaS com 1-2 módulos IA |

Combinado a `project_type`, cada projeto declara em `docs/forge/project.json` um booleano **`ai_enabled`**:

- `ai_enabled: true` → aplicam-se checks de prompts, LLM, instrumentação de inferência, eval LLM, custo por outcome.
- `ai_enabled: false` → substitui-se por checks de plataforma: audit logs, testes funcionais, aceite humano, custo de infra/manutenção, evidência de pilot.

> **Backwards compatibility**: projetos consumidores **sem** `docs/forge/project.json` são tratados como `project_type: agentic_saas` + `ai_enabled: true` (mantém comportamento ≤ v0.7.0 do Forge).

> Princípios específicos do contexto Acme (lifecycle, two-track economics, portfolio em 3 categorias) vivem em [`examples/acme/constitution-extension.md`](../examples/acme/constitution-extension.md). Outros projetos podem definir suas próprias extensões.

---

## Os 8 princípios

> Em cada princípio: (1) **Regra** invariável que vale para **todos** os tipos; (2) **Por quê** comum; (3) **Como validar — matriz por `project_type` / `ai_enabled`**. As IDs e a ordem dos princípios não mudaram desde v0.1.0 — só a interpretação.

---

### C1 — Diagnose-before-build

**Regra**: Nenhuma capability, módulo, agente, automação ou produto novo começa sem **diagnóstico estruturado** documentado e aprovado por quem paga.

> v0.3.0 renomeou de "Diagnose-before-design" para "Diagnose-before-build" — o gate vale igualmente para módulo de plataforma, job de automação ou agente IA.

**Por quê**: Construir antes de diagnosticar é como prescrever sem examinar. O processo automatizado em cima de caos vira caos automatizado, mais rápido. Diagnóstico estruturado:
- Qualifica o problema (vale a pena resolver?)
- Mede o baseline (custo humano atual)
- Define o outcome cobrável / contratual (o que conta como "feito")
- Filtra clientes não-sérios

**Como validar — por `project_type`**:

| project_type | Artefato exigido | Reviewer audita |
|---|---|---|
| `agentic_saas` | `diagnostic.md` referenciado por cada SKU/produto em produção | Relação 1:1 entre agentes em produção e diagnósticos arquivados |
| `platform` | `diagnostic.md` por módulo crítico (financeiro, contrato, dados sensíveis) ou produto. Módulos simples podem agregar em `diagnostic-{vertical}.md`. | Cada módulo CANONICAL tem diagnostic referenciado; módulos em PILOT permitidos com diagnóstico provisório |
| `automation` | `diagnostic.md` por automação (escopo + baseline humano substituído + tolerância a erro) | Cada job em produção referencia diagnóstico |
| `hybrid` | Cada módulo segue a regra do seu tipo declarado | — |

**Conteúdo mínimo do diagnóstico (todos os tipos)**: problema declarado, baseline humano (quanto custa hoje), outcome proposto, métrica de sucesso.

**Exceções**: artefatos marcados `is_example: true` ou `is_internal: true` (showcase/dev) podem rodar sem diagnóstico — mas devem ter o flag explícito.

---

### C2 — Outcome-first, never tech-first

**Regra**: Toda spec começa pela **cláusula contratual de outcome**: o que vai ser entregue, em que condições, com que tolerância de erro. Stack, modelos, UI, arquitetura vêm depois.

**Por quê**: Sem outcome definido como cláusula, há disputa eterna ("isso conta?", "aquilo deveria contar"). Definição vaga de outcome é a armadilha mais comum em qualquer entrega contratada.

**Como validar — por `project_type`**:

| project_type | Forma do outcome | Verificação |
|---|---|---|
| `agentic_saas` | Outcome classificado por agente (categoria + threshold de acurácia + evento que dispara `DELIVERED`) | Spec tem §1 "Cláusula de outcome" com 3+3 exemplos e schema de saída batendo com categorias |
| `platform` | Ação operacional verificável: tela renderizada com dado persistido, endpoint que muda estado, relatório gerado, evento auditável | Spec tem §1 "Cláusula de outcome" com critério de aceite operacional + screenshot/exemplo de payload + audit log emitido |
| `automation` | Execução verificável: job concluído com efeito mensurável (registro inserido, integração respondendo 2xx, dado consolidado) | Spec tem §1 + log/trace de execução amostrável |
| `hybrid` | Cada módulo segue a forma do seu tipo declarado | — |

**Exigências comuns**: 3 exemplos POSITIVOS + 3 exemplos NEGATIVOS + janela temporal de estabilidade + evento técnico que dispara DELIVERED/COMPLETED. Categorias declaradas com threshold mínimo (acurácia para IA; pass/fail funcional para platform/automation).

**Exceções**: nenhuma. Outcome ausente = spec inválida.

---

### C3 — Economic viability

**Regra**: O custo de operar a entrega **não pode** exceder uma fração do preço cobrado / margem alvo. Hard gate de unit economics. Default `25%`; projetos podem ajustar via `economics.cost_to_price_ratio_max` em `docs/forge/project.json`.

> v0.3.0 generaliza C3 (antes "Cost ≤ 25% of price" — referindo-se ao custo de inferência LLM). A regra continua, mas o **modelo de custo** depende do `project_type`/`ai_enabled`.

**Por quê**: Margem comprimida mata SaaS² silenciosamente — o custo só aparece com volume, quando contrato já está assinado. Vale para tokens LLM, vale para infra/suporte/manutenção.

**Como validar — por `ai_enabled` / `project_type`**:

| Modelo de custo | Aplica quando | Numerador | Denominador | Limite default |
|---|---|---|---|---|
| `cost_per_outcome` | `ai_enabled: true` (qualquer project_type) | custo de inferência LLM por outcome (medido em traces) | preço por outcome (ou ARPU prorateado) | ≤ 25% |
| `platform_margin` | `ai_enabled: false` E (`project_type: platform` OU `automation`) | custo mensal de infra + suporte + manutenção | receita mensal contratada | ≤ 25% (ou alvo de margem do contrato) |
| `hybrid` | `project_type: hybrid` | soma ponderada por módulo | soma ponderada por módulo | ≤ 25% agregado |

**Como o reviewer audita**:
- `ai_enabled=true` → cada artefato em produção tem `unit-economics.md` correspondente; razão real medida via tracing 30d (LangSmith/equivalente).
- `ai_enabled=false` → cada módulo CANONICAL tem `delivery-economics.md` correspondente; valores de infra/suporte/manutenção atualizados nos últimos 90 dias; razão ≤ limite.

**Exceções**:
- Durante modo SHADOW ou STAGING/PILOT (sem cobrança variável de produção), regra **não bloqueia** mas continua sendo medida.
- Para produtos com pricing fixo, traduz-se para "custo mensal por usuário ≤ N% do ARPU".

**Ajuste para outros contextos**: o limite default é 25%; projetos podem ajustar justificando trade-offs (ex: em mercado high-margin, 35%; em commodity, 15%).

---

### C4 — Pilot-before-canonical / Shadow-before-billing

**Regra**: Nenhum artefato vai a estado canônico (cobrança variável, autonomia operacional, módulo CANONICAL em produção sem revisão) sem passar por **estado intermediário com janela mínima e critério de promoção declarado**.

> v0.3.0 generaliza C4. O conceito é o mesmo (ganhar confiança gradualmente); o vocabulário muda por `project_type`.

**Por quê**: Cobrar/automatizar/canonicalizar antes da hora é receita garantida de atrito comercial e operacional. CEO/decisor não confia em IA nem em plataforma nova no início — está certo. Build trust gradually.

**Como validar — vocabulário por `project_type`**:

#### Para `agentic_saas` (e módulos `ai_enabled=true` em hybrid)

| Modo | Comportamento |
|---|---|
| `SHADOW` | Agente roda mas output não é entregue/cobrado; humano executa em paralelo; mede-se concordância |
| `ASSISTED` | Agente roda e propõe; humano aprova antes de executar/entregar; mede-se taxa de aprovação sem edição |
| `AUTONOMOUS` | Agente executa diretamente; humano audita amostra; mede-se taxa de erro pós-execução |

Promoção entre modos exige: N execuções mínimas, threshold de qualidade pré-contratado, eval suite passing, aprovação humana explícita. SHADOW mínimo de 14 dias.

#### Para `platform` / `automation` (e módulos `ai_enabled=false` em hybrid)

| Estado | Comportamento |
|---|---|
| `DRAFT` | Spec/código em desenvolvimento; sem usuários reais |
| `STAGING` | Deploy em ambiente isolado; testes funcionais E2E; nenhum dado real |
| `PILOT` | Usuários reais em escopo restrito; mede-se aceite humano + audit log de ações; bug rate / SLA monitorados |
| `CANONICAL` | Produção plena; documentado; SLA contratado; sob auditoria mensal |
| `DEPRECATED` | Substituído; congelado em manutenção; plano de sunset declarado |

Janela mínima em `PILOT` antes de `CANONICAL`:
- **Módulos críticos** (financeiro, contrato, LGPD, integração externa transacional): **≥ 14 dias** + relatório formal de aceite assinado pelo decisor.
- **Módulos simples** (CRUD interno, telas operacionais sem efeito financeiro): **≥ 3 dias** + aceite humano registrado em PR/issue.

Promoção exige: testes funcionais passando, aceite humano registrado, audit log dos eventos críticos amostrável, SLA pré-contratado para o módulo.

#### Para `hybrid`

Cada módulo segue a tabela do seu tipo. Conjunto deve ser auditável.

**Como validar (geral)**:
- Toda subscription/instância/módulo tem campo `lifecycle_state` (ou `mode`) explícito.
- Promoção registrada em log auditável (`promotions.md` ou `pilot-state.md`).
- Reviewer audita transições.

**Exceções**: nenhuma. Mesmo cliente disposto a "pular SHADOW/PILOT" precisa cumprir a janela mínima.

---

### C5 — Three-tier context

**Regra**: Toda skill, módulo, agent ou prompt declara em qual **tier** opera e respeita herança hierárquica:

| Tier | Conteúdo | Lê de |
|---|---|---|
| **L0 / Tier 1 — Estratégico** | DNA da organização, ICP, ofertas, glossário, princípios | apenas Tier 1 |
| **L1 / Tier 2 — Tático** | Cliente, projeto, configuração de instância, baseline, módulo | Tier 1 + Tier 2 |
| **L2 / Tier 3 — Operacional** | Execução, outcome, run individual, eval case, audit log entry | Tier 1 + Tier 2 + Tier 3 |

> v0.3.0 mantém C5 mas remove dependência de "agentes". Aplica-se a qualquer artefato que consuma contexto (skill, agent, módulo de plataforma, job de automação).

**Por quê**: Herança hierárquica evita duplicação, dá contexto consistente, permite cache. Quebrar a hierarquia (Tier 1 lendo Tier 3) destrói o helper pattern e estoura tokens / produz acoplamento ruim.

**Como validar — por `project_type`**:

| project_type | Onde validar |
|---|---|
| `agentic_saas` | Frontmatter de toda skill (`.claude/skills/**`) declara `tier`; lint bloqueia skill Tier 1 que importe contexto Tier 2/3 |
| `platform` | Cada módulo declara `tier_scope` no frontmatter de spec; código respeita boundaries (módulo L1 não importa contexto L2 de outro módulo) |
| `automation` | Mesma regra de platform; jobs L2 podem ler L0+L1 do projeto |
| `hybrid` | União das duas |

**Vocabulário alternativo**: alguns contextos usam "L0/L1/L2" (vocabulário Sincra), "Strategic/Tactical/Operational", ou "Macro/Meso/Micro". O importante é a **hierarquia de leitura**, não os nomes.

**Exceções**: nenhuma — quebra de hierarquia indica problema de modelagem, não exceção legítima.

---

### C6 — Telemetry / auditability by default

**Regra**: Todo evento crítico em produção **deve** ter rastreamento observável correspondente (input, output, custo, latência, ator, timestamp). Sem trace/audit, não conta como outcome auditável.

> v0.3.0 generaliza C6. A obrigação continua; o **provedor exigido** depende de `ai_enabled`.

**Por quê**: Sem trace/audit:
- Reviewer não consegue auditar
- Cliente não pode contestar outcome
- Drift detection vira impossível
- Auditoria mensal não roda

**Como validar — por `ai_enabled`**:

| `ai_enabled` | Provedor obrigatório | Que eventos rastrear |
|---|---|---|
| `true` | Provedor de tracing LLM (`langsmith` / `langfuse` / `helicone` / `phoenix` / custom) | Toda chamada LLM em produção (input/output/cost/latency) |
| `false` | `audit_log_provider` + `structured_logging_provider` | Toda mutação crítica de estado (criar/atualizar/deletar dado de negócio), todo login, toda integração externa, todo erro 5xx |
| `hybrid` (módulo a módulo) | União dos dois conforme `ai_enabled` do módulo | — |

**Comum a todos**: 
- Métricas (`metrics_provider`) — latência, throughput, taxa de erro.
- Erros estruturados (`error_tracking_provider`) — Sentry/equivalente.
- Rastreabilidade de quem/quando/o-que: `user_id` ou `actor_id`, timestamp ISO, payload sanitizado.

**Como o reviewer audita**:
- `ai_enabled=true` → lint regex em código de produção exige instrumentação (ex: `traceable()` do LangSmith ou wrapper equivalente) próxima a cada chamada LLM; hook compara contagens outcomes ↔ traces (desvio > 1% = FAIL).
- `ai_enabled=false` → lint regex exige chamada a `auditLog.write(...)` próxima a mutações críticas; reviewer compara mutações no DB com entradas no audit log (desvio > 1% = FAIL).

**Provedores compatíveis**: o Forge **não opina** sobre o provedor — opina sobre a obrigação de rastreamento.

**Exceções**: scripts pontuais e seeds que rodam offline podem rodar sem trace/audit, desde que **não** estejam em fluxo de produção.

---

### C7 — Portability over lock-in

**Regra**: Modelos, provedores, ferramentas mudam. **Processo**, **input/output**, **handoff**, **artefato** **não**. Toda dependência específica de modelo/fornecedor é isolada em **camada de abstração** dedicada (`src/llm/`, `src/infra/`, `src/integrations/`, ou equivalente).

> v0.3.0 amplia C7 para cobrir explicitamente: LLMs, infra (DB, fila, storage), integrações (CRM, ERP, WhatsApp), pagamentos, mensageria.

**Por quê**: Mercado de LLM e fornecedores SaaS em transição rápida. Cliente em produção não pode parar porque OpenAI mudou preço, Anthropic mudou rate limit, ou um gateway de pagamento subiu fee. Arquitetura precisa abstrair desde o dia 1.

**Como validar — fornecedores cobertos por `project_type`**:

| project_type | Camadas obrigatórias |
|---|---|
| `agentic_saas` | `src/llm/` (LLM SDKs), `src/infra/` (DB/queue/storage) |
| `platform` | `src/integrations/` (CRM, ERP, WhatsApp, e-mail, pagamento), `src/infra/` (DB/queue/storage), `src/auth/` (provedor de identidade) |
| `automation` | `src/integrations/` (todo serviço externo), `src/infra/` |
| `hybrid` | União das anteriores |

**Verificações**:
- Imports do SDK direto do provedor (`@anthropic-ai/sdk`, `openai`, `stripe`, `twilio`, `whatsapp-web.js`, etc.) só dentro da camada de abstração apropriada.
- Specs/skills/módulos (markdown/templates) **não** mencionam modelo/provedor literal — referenciam-se a interfaces (`MessagingProvider`, `LLMProvider`, `PaymentGateway`).
- Trocar provedor (mesma família ou cross-provider) não exige mudança em specs/skills/specs de módulo, só em config.

**Exceções**: SDKs de provedores específicos podem aparecer em scripts internos (eval, debug, reviewer, scripts/) que vivem em pasta separada.

---

### C8 — Configuration over heroic customization

**Regra**: Cliente N do mesmo agente/SKU/produto/módulo = **configuração**, não branch nem `if/switch` por nome. Customização entra como:
1. **Configuração de tenant** (campos no contexto do tenant)
2. **Variante de artefato** (novo SKU/módulo empacotado, com código distinto)
3. **NUNCA** como `if/switch` por nome de tenant em código

> v0.3.0 mantém C8 sem mudanças de regra — apenas amplia o escopo para módulos de plataforma/automação. Esse princípio fica **mais** importante em `platform`, onde o pedido "só essa pequena adaptação para o cliente X" é cotidiano.

**Por quê**: Customização heroica destrói margem e impede catálogo. Cada pedido de "só essa pequena adaptação" vira código que não escala — e em plataforma o efeito é exponencial: cliente Y pede o mesmo, cliente Z pede outra coisa, e o SaaS² vira projeto de consultoria disfarçado.

**Como validar (todos os `project_type`)**:
- Lint detecta `if (tenantId === '...')`, `switch (tenantName)`, `if (tenant.name === ...)` em código de produção.
- Não existem pastas `clients/{nome}/`, `tenants/{nome}/` em código de skills/agents/módulos/jobs.
- Reviewer audita drift de customização disfarçada.

**Exceções**: durante onboarding do **primeiro cliente** de um novo artefato, pode haver hardcode temporário em arquivo dedicado por **até 14 dias**. Após isso, vira config no contexto do tenant ou novo artefato no catálogo.

---

## Hierarquia de autoridade

Quando dois princípios entram em conflito, a ordem é:

1. **C1** (Diagnose) — fundamento de tudo
2. **C2** (Outcome) — define cláusula contratual
3. **C3, C4** (Economics, Pilot/Shadow) — proteção comercial
4. **C5, C6** (Three-tier, Telemetry/audit) — disciplina técnica
5. **C7, C8** (Portability, Anti-custom) — sanity de longo prazo

Exemplo: cliente urgente exige autonomia/canonicalização imediata sem janela PILOT (viola C4) e justificativa é técnica (viola C2). O conflito **não deve ser resolvido** — o pedido viola a base. Renegociar escopo ou recusar.

---

## Como o reviewer aplica os princípios

1. Carrega `docs/forge/project.json` do consumidor (ou aplica defaults `agentic_saas` + `ai_enabled=true`).
2. Resolve, para cada princípio, qual ramo da matriz aplicar com base em `project.type` + `module.ai_enabled` (ou herdado do projeto).
3. Aplica os checks correspondentes em [`reviewer/validation-rules.json`](../reviewer/validation-rules.json), seções `common` + `<project_type>`.
4. Reporta PASS/WARN/FAIL com evidência citada.

> Detalhes operacionais em [`reviewer/prompt.template.md`](../reviewer/prompt.template.md).

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
| 0.3.0 | 2026-05-08 | **Delivery-type agnostic** — introdução de `project_type` (`agentic_saas`/`platform`/`automation`/`hybrid`) e `ai_enabled`. C1 renomeado para "Diagnose-before-build". C3 generalizado para custo-por-outcome OU margem-de-plataforma. C4 ganha vocabulário paralelo (DRAFT/STAGING/PILOT/CANONICAL/DEPRECATED). C6 ganha audit-log como provedor obrigatório quando `ai_enabled=false`. C7 ampliado para integrações/pagamentos/infra. Backwards compatible — defaults legados quando `project.json` ausente. ADR F26. |

---

## Extensões e exemplos

- [`examples/acme/constitution-extension.md`](../examples/acme/constitution-extension.md) — Extensões C9, C10, C11 específicas do contexto Acme (lifecycle, two-track economics, portfolio em 3 categorias)
- [`examples/acme/methodology/`](../examples/acme/methodology/) — Metodologias Acme (clássica, SaaS², Sincra) que originaram esta Constitution
- [`reviewer/prompt.template.md`](../reviewer/prompt.template.md) — Como o reviewer DeepAgent valida cada princípio
- [`templates/project.template.json`](../templates/project.template.json) — Declaração canônica de `project_type` e `ai_enabled` consumida por reviewer e commands
