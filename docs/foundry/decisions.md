# Novais Digital Foundry — Decisões F1–F27

> **Status**: ✅ Defaults aprovados em 2026-04-30 (v0.1.0) e refinados em ondas subsequentes até v0.22.1 (Foundry-22)
> **Versão atual**: 0.22.1

Decisões fundacionais do framework Novais Digital Foundry. Mudança em qualquer uma destas exige nova ADR.

---

## F1 — Nome do framework

**Decisão**: ✅ **Novais Digital Foundry**

**Justificativa**: "Foundry" carrega a ideia de *forjar/moldar* — o framework forja agentes de IA com governança a partir de princípios. Curto, pronunciável em PT/EN, sem conflito com produtos existentes.

---

## F2 — Onde instalar

**Decisão original** (v0.1.0): Projeto-only em `novais-digital-governanca-ia/.claude/`

**Decisão atualizada** (v0.2.0): ✅ **Repositório standalone consumível por N projetos**

**Justificativa do upgrade**: a v0.2.0 reposicionou Foundry como **produto distribuível**, não framework embarcado. Origem canônica em `github.com/rafaelnovaes22/agent-governance-framework` (privado). Projetos consumidores fazem `cp -r` dos artefatos canônicos e adaptam só o que é local (CLAUDE.md, ADRs específicas).

**Implicação prática**:
- Foundry é versionado independentemente
- Mudanças entram via PR no repo do Foundry + bump SemVer
- Consumidores atualizam por sync periódico
- Múltiplos projetos podem usar Foundry simultaneamente

---

## F3 — Repositório `lc-spec-driven`

**Decisão**: ✅ **Pular até confirmar nome correto**

Pesquisa via Agent não encontrou repo público com esse nome. Quando o nome correto for confirmado, abrir ADR específica para reavaliar absorção.

---

## F4 — Cross-LLM Reviewer

**Decisão**: ✅ **DeepAgent (GPT-5.5)** via OpenAI SDK

**Implicações arquiteturais**:

1. **Stack do reviewer**: Python `deepagents` (LangChain) OU Node/TS `@langchain/langgraph` — decisão técnica em ADR-002 do projeto consumidor (Foundry-3)
2. **Manifest auditável obrigatório**: reviewer ingere `docs/foundry/manifest.json` primeiro, todos os artefatos listados com path/hash/versão
3. **Contrato formal**: [`docs/foundry/reviewer-contract.md`](./reviewer-contract.md) + assets em [`reviewer/`](../../reviewer/)
4. **Custo controlado**: roda mensalmente em amostra 5–10% dos outcomes (~US$ 1-3/mês na fase inicial)
5. **Independência**: GPT-5.5 é independente de Claude (modelo de produção)

---

## F5 — Plugin marketplace

**Decisão**: ✅ **Não na Foundry-0** — reavaliar após Foundry-3

Foundry é **fechado e versionado** no repo standalone. Publicar como plugin Claude Code (estilo `anthropics/skills`) só faz sentido após Foundry-3 quando reviewer estiver maduro.

---

## F6 — BMAD helper pattern

**Decisão**: ✅ **Sim, mas só em Tier 1** (vocabulário Sincra: L0)

Helper pattern do BMAD reduz tokens em 70-85% via referências a seções reutilizáveis. Ganho mais alto em **Tier 1** (DNA, ICP, ofertas) — informação repetida em todo prompt. Aplicar em Tier 2/3 adiciona complexidade sem ganho proporcional.

**Implementação**:
- Tier 1 vive em seção marcada com `<!-- l0:cacheable -->`
- Skills Tier 2/3 referenciam `{{l0.dna}}`, `{{l0.icp}}` em vez de duplicar
- Cache via Anthropic prompt cache (`cache_control: ephemeral`)

---

## F7 — Smart model routing

**Decisão**: ✅ **Default**:

| Tarefa | Modelo |
|---|---|
| Unit Economist, PO Guardian (raciocínio crítico) | **Opus** |
| QA, Security, Code Review | **Sonnet** |
| Lint, format, classificação simples | **Haiku** |

Reavaliar com base em telemetria Langfuse após Foundry-3.

---

## F8 — Sunset da pasta `legacy-pmo/` (Novais Digital específico)

**Decisão**: ✅ **Usar como L0 temporário** até Onda 5 da Novais Digital (no projeto consumidor)

Aplicação local da Novais Digital. Outros projetos consumidores podem ignorar.

---

## F9 — Stack técnica do reviewer DeepAgent

**Status**: ✅ **Decidida em 2026-05-01** (substitui F17/F18 — ver abaixo)

**Decisão**: **Python `deepagents` (LangChain)** + **Deep Agents CLI v0.0.34+** + **Anderson Amaral converter** para tradução Claude Code → Deep Agents.

Histórico: opção (b) Node/TS `@langchain/langgraph` foi descartada porque o Deep Agents CLI é Python-first; alinhamento com o stack TS do `novais-digital-governanca-ia` é feito via boundary HTTP/CLI (reviewer roda como processo separado, não como dependência do consumidor).

---

## F10 — Provedor do reviewer

**Status**: Pendente — Foundry-3

**Opções**:
- (a) OpenAI direto (cliente `openai` SDK)
- (b) OpenRouter (acesso multi-modelo)
- (c) Vertex AI (gerenciado Google)

**Default sugerido**: (a) OpenAI direto — mais simples; troca depois se precisar.

---

## F11 — Frequência de auditoria

**Status**: Pendente — Foundry-3

**Default**: **Mensal** (último dia útil do mês)

**Eventos críticos** que podem disparar auditoria adicional:
- Mudança de prompt em SKU em produção
- Drift detectado em métrica de custo > 15%
- Promoção de modo (SHADOW→ASSISTED→AUTONOMOUS)

A definir se eventos críticos disparam **automaticamente** ou apenas marcam item para revisão na próxima auditoria mensal.

---

## F12 — Adoção do Foundry em outros projetos do workspace

**Status**: Pendente — pós Foundry-5

**Projetos candidatos** (workspace Rafael):
- CarInsight (precisa avaliação)
- FacilIAuto (precisa avaliação)
- novais-digital (provavelmente não — landing page, não SaaS² agêntico)

Reavaliar quando Foundry-5 estiver concluída.

---

## F13 (NOVO v0.2.0) — Constitution genérica vs Novais Digital-específica

**Decisão**: ✅ **Constitution principal genérica** (C1-C8); extensões específicas em `examples/{dominio}/constitution-extension.md`

**Justificativa**: Foundry é replicável. Constitution não pode ter `metodologia_acme.md` hardcoded. C9, C10, C11 (lifecycle, two-track economics, portfolio em 3 categorias) são **específicos da Novais Digital** e vivem em `examples/novais-digital/constitution-extension.md`.

**Implicação**: outros projetos consumidores podem definir suas próprias extensões (`examples/{nome}/constitution-extension.md`) sem quebrar a Constitution base.

---

## F14 (NOVO v0.2.0) — Estrutura `examples/`

**Decisão**: ✅ **`examples/novais-digital/` é caso real, não conteúdo prescritivo**

**Conteúdo**:
- `methodology/` — 3 docs de metodologia Novais Digital
- `portfolio.md` — 3 categorias Novais Digital
- `constitution-extension.md` — C9-C11
- `clickup-blueprint.md` — ClickUp interno Novais Digital
- `products/novais-digital-fin.md` — produto em Beta
- `products/novais-digital-educacional.md` — produto em Discovery

**Como outros projetos usam**:
- Como gabarito (estrutura de referência)
- Não como template literal (cada domínio tem sua realidade)
- Cada novo projeto pode contribuir seu próprio `examples/{nome}/`

---

## F15 (NOVO v0.2.0) — Versionamento do Foundry

**Decisão**: ✅ **SemVer estrito**

| Mudança | Bump |
|---|---|
| Adicionar template/skill/command novo | **PATCH** |
| Modificar template público (mantém compatibilidade) | **PATCH** |
| Adicionar princípio à Constitution | **MINOR** |
| Concluir Onda Foundry (Foundry-1, Foundry-2, ...) | **MINOR** |
| Modificar regra de princípio existente | **MAJOR** |
| Remover princípio | **MAJOR** |

**Tags git**: `vX.Y.Z` no commit que bumpa a versão. Detalhe em [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

---

## F16 (NOVO v0.2.0) — Distribuição e adoção

**Decisão**: ✅ **Repo privado por enquanto**

Mantenedor (Novais Digital / Novais Digital) controla quem pode adotar. Adoção por terceiros mediante autorização explícita.

**Quando avaliar abrir**:
- Após Foundry-5 concluída
- Após pelo menos 3 projetos de domínios diferentes adotarem com sucesso
- Após reviewer DeepAgent estar implementado e testado

---

## F17 (NOVO 2026-05-01) — Stack do reviewer: Deep Agents CLI

**Decisão**: ✅ **`deepagents` CLI (Python, LangChain) v0.0.34+**

**Justificativa**:
- Filesystem virtual e tools tipados (`write_file`, `execute`, `read_file`, `task`) batem com a auditoria que precisamos: ler artefatos do consumidor, rodar lints, paralelizar checks por princípio
- Suporte nativo a sub-agents via `task` permite paralelizar audit C1, C2, C3, ..., C8
- Modelo agnóstico — pode usar Claude (Sonnet/Opus), GPT (4.x/5.5), Gemini conforme custo/qualidade
- Maturidade do framework + comunidade ativa (LangChain)

**Local de execução**:
- Reviewer roda como **processo Python separado** no projeto consumidor (ou CI), não como dependência embarcada do framework Foundry
- Acesso aos artefatos via filesystem (consumidor monta o repo no working directory do agent)
- Output gravado em `docs/foundry/audits/{YYYY-MM}.md` (consumido posteriormente pelo `/novais-digital:audit-monthly` do Foundry ou disparado por ele)

**Provedor de modelo**: ainda **F10** (default OpenAI direto). Reviewer respeita variável de ambiente `DEEPAGENTS_MODEL` para flexibilidade.

**Implicação para Foundry**:
- Skills do Foundry (`.claude/skills/`) ficam em formato Claude Code (uso pelo dev em sessão)
- Para o reviewer ler/executar essas skills, precisamos **versão paralela** em `reviewer/deepagents/skills/` no formato Deep Agents
- Conversão é feita via F18 abaixo

---

## F18 (NOVO 2026-05-01) — Tradução Claude Code → Deep Agents

**Decisão**: ✅ **Adotar `andersonamaral2/Claude-Code-to-Deep-Agents-Skills-Converter` como ferramenta de tradução**

**Repositório**: https://github.com/andersonamaral2/Claude-Code-to-Deep-Agents-Skills-Converter (MIT, ativo)

**Por que**:
- Skill que vive no Deep Agents CLI; instalação via one-liner ou `curl | bash`
- Aplica **8 transformações estruturadas (T1-T8)** + tabela de semantic replacements (CLAUDE.md → AGENTS.md, `.claude/` → `.deepagents/`, implicit bash → `execute`, etc)
- Suporta batch conversion e dry-run; pode ser auditado em CI

**Como aplicamos**:
- Manter skills do Foundry no formato Claude Code (`.claude/skills/`) como **fonte canônica**
- Versão Deep Agents fica em `reviewer/deepagents/skills/{tier}/{name}/SKILL.md` — gerada por conversão
- Toda mudança numa skill canônica dispara re-conversão (Foundry-4 hook futuro)
- **Zero divergência manual**: a versão Deep Agents nunca é editada à mão; sempre vem do converter

**Não abraçamos como dependência hard**: se o converter sair de manutenção, podemos manter a versão Deep Agents à mão temporariamente — formato é estável (frontmatter + 8 seções).

**Output esperado** (estrutura por skill):

```
reviewer/deepagents/skills/L0/company-dna/
  └── SKILL.md         ← gerado, com frontmatter Deep Agents + T1-T8

reviewer/deepagents/skills/reviewer/foundry-auditor/
  └── SKILL.md         ← skill orquestradora, escrita direto em formato Deep Agents
```

**Conversion log**: cada execução do converter registra em `reviewer/deepagents/conversion-log.md` (origem, hash da skill original, data, versão do converter, transformações aplicadas).

---

## F19 (NOVO 2026-05-01) — Estratégia de playbooks verticais

**Decisão**: ✅ **Playbooks como artefatos de primeira classe no Foundry**

**Formato**: `docs/playbooks/{vertical}/playbook.md` no projeto consumidor, gerado via `/novais-digital:playbook-extract` após o primeiro SKU do vertical atingir `AUTONOMOUS`.

**Critério de sucesso do playbook**: cliente 2 do mesmo vertical consome **≤ 30% do esforço do cliente 1**. Se não atingir, o playbook deve registrar os blocos que falharam em reutilização e atualizar estimativas.

**O que entra no playbook**:
1. Blocos com **alta confiança de reutilização** (sem hardcode, sem persona cliente-específica)
2. Padrão de TenantContext do vertical
3. Seed de eval categorizado (≥ 30 casos)
4. Métricas reais de esforço do cliente 1

**O que NÃO entra**:
- Dados do cliente (PII, nomes, volumes comerciais) — anonimizar antes de incluir
- Seções da Constitution — são compartilhadas via Foundry, não por playbook
- Prompts com tenant hardcoded — se existe, é bug C8, não bloco

---

## F20 (NOVO 2026-05-01) — Reavaliação F5.5: Deploy global em `~/.claude/`

**Status**: ✅ **Avaliado em 2026-05-01 (Foundry-5) — manter projeto-scoped por ora**

**Contexto**: F2 decidiu repo standalone com `cp -r` para projetos consumidores. F5.5 questiona se faz sentido promover para `~/.claude/` global do desenvolvedor.

**Avaliação**:

| Critério | Global `~/.claude/` | Projeto-scoped (atual) |
|---|---|---|
| Versão por projeto | ❌ todos na mesma versão | ✅ cada projeto na versão que adotou |
| Atualizações | ❌ riscos de breaking change silencioso | ✅ sync explícito e controlado |
| Múltiplos projetos paralelos | ⚠️ mesmas skills para projetos diferentes | ✅ isolamento natural |
| Onboarding novo dev | ⚠️ precisa instalar globalmente | ✅ vem com o repo |

**Decisão**: **Manter projeto-scoped**. Criar `foundry-global-install.sh` como opt-in experimental para devs que preferem global — mas o padrão e o caso de uso primário é projeto-scoped.

**Reavaliar**: quando ≥ 5 projetos diferentes adotarem o mesmo Foundry e a manutenção de `cp -r` por projeto for demonstravelmente onerosa.

---

## F21 (NOVO 2026-05-01) — Reavaliação F5.6: Publicação como plugin

**Status**: ✅ **Avaliado em 2026-05-01 (Foundry-5) — não publicar ainda**

**Contexto**: F5 decidiu "não na Foundry-0, reavaliar após Foundry-3". Foundry-5 é o momento de avaliar.

**Critérios para publicar**:
1. ≥ 3 projetos de **domínios diferentes** adotando com sucesso
2. Reviewer DeepAgent executando ≥ 3 auditorias mensais com resultados validados
3. Constitution estável (nenhum MAJOR bump) por ≥ 6 meses
4. Nenhum dado proprietário da Novais Digital nos artefatos canônicos

**Status atual**:
- Projetos: 1 (Novais Digital apenas) — abaixo do mínimo ❌
- Auditorias reais: 0 — abaixo do mínimo ❌
- Constitution: estável desde 0.2.0 (< 6 meses) ⚠️

**Decisão**: **Não publicar**. Reavaliar após cliente 2 de vertical diferente em AUTONOMOUS.

---

## F22 (NOVO 2026-05-04) — Sincronização de metadados (v0.4.1)

**Status**: ✅ **Aplicado em 2026-05-04**

**Contexto**: auditoria interna (pré-CI) identificou 6 divergências de versão/status acumuladas desde Foundry-4:
1. `README.md` badges e tabela de status travadas em Foundry-0/v0.2.0
2. `settings.json._foundry_version` = `0.3.0` (framework em 0.4.0)
3. `settings.json._constitution_version` = `0.1.0` enquanto `CONSTITUTION.md` declara `0.2.0`
4. `decisions.md` título e header em "F1-F16 / v0.2.0"
5. `manifest.json` sem política explícita de sha256 (`sha256: null` ambíguo)
6. `reviewer/README.md` inexistente (README root linka `reviewer/` como entrypoint)

**Decisões tomadas**:
- **sha256_policy = "post-install"**: hashes ficam `null` no repo; consumidor/reviewer recomputa na auditoria. Fonte canônica: `_meta.sha256_policy` no manifest.
- `settings.json._constitution_version` era a fonte errada — `CONSTITUTION.md` é canônico. settings.json reflete o valor, não o define.
- `reviewer/README.md` criado como índice do diretório (entrypoint para humanos e deep-agents).

**Implicação**: qualquer divergência futura entre `settings.json._foundry_version`, `manifest.framework.version`, badge do README e topo do CHANGELOG é tratada como bug — detectada por `scripts/foundry-doctor.sh` (Fase 5 planejada).

---

---

## F23 (NOVO 2026-05-06) — AIOS Server como camada de implementação multiagente (Foundry-6)

**Status**: ✅ **Formalizado em 2026-05-06 — Foundry-6 infraestrutura entregue**

**Contexto**: projeto consumidor SchoolPlatform adotou **AIOS Server** (arXiv 2403.16971, `agiresearch/AIOS` v0.2.2) como kernel LLM OS para orquestrar 6 agentes especializados com contexto isolado em paralelo. Esta decisão foi formalizada como **Foundry-6** e precisou de suporte nativo nos artefatos do framework.

**O que é AIOS**: kernel LLM OS com scheduler, gerenciador de contexto e memória isolada por agente. Em vez de implementação módulo a módulo, 6 agentes (spec, schema, backend, frontend, test, review) executam o pipeline com contexto estritamente isolado.

**Mapeamento com a Constitution (não muda princípios, apenas aplica)**:

| Princípio | Como AIOS aplica |
|---|---|
| C5 (Three-tier) | Tier A = L2 (autônomo), Tier B = L1 (iteração humana), Tier C = L0 (dev dirige) |
| C6 (Telemetry) | `send_request()` de cada agente deve ter trace Langfuse — ver `docs/foundry/aios-telemetry-pattern.md` |
| C7 (Portability) | SYSTEM_PROMPTs funcionam standalone sem o kernel; kernel offline ≠ agente inutilizável |
| C8 (Anti-heroic) | `tenantId` vai em `task_input`, nunca hardcoded em SYSTEM_PROMPT |

**Decisão de versionamento**: AIOS é camada de implementação do consumidor, não princípio novo da Constitution. Não exige MAJOR bump. Foundry-6 é MINOR (0.4.x → 0.5.0).

**Artefatos Foundry-6 entregues**:
- F6.1/F6.2: no projeto consumidor (orchestrator.py, setup guide, ADR-003) — F6.1/F6.2 entregues lá
- F6.3: `/novais-digital:plan` (seção 9 condicional), `/novais-digital:tasks` (Wave 2-AIOS), `/novais-digital:implement` (`--via aios`)
- F6.4: `/novais-digital:aios-init`, `/novais-digital:aios-run`, `/novais-digital:aios-status`
- F6.5: `docs/foundry/aios-telemetry-pattern.md` — padrão Langfuse + mock + campos obrigatórios
- F6.6: `templates/platform-sku-spec.template.md` com `aios_tier` + `aios_context_boundaries` no frontmatter

---

## F24 (NOVO 2026-05-07) — AIOS agentes portáveis em templates/aios/ (Foundry-7)

**Status**: ✅ **Formalizado em 2026-05-07 — Foundry-7 entregue**

**Contexto**: Foundry-6 (v0.5.0) entregou os slash commands AIOS (`/novais-digital:aios-init`, `/novais-digital:aios-run`, `/novais-digital:aios-status`) e o padrão de telemetria, mas o **boilerplate dos agentes ficou inline no `aios-init.md`** e cobria apenas 3 dos 6 agentes (spec/backend/frontend). Cada projeto consumidor que adotasse AIOS tinha que gerar seus agentes do zero ou copiar do SchoolPlatform — onde o código está cravado em "AcmeEdu" (viola C7/C8).

**Problema concreto**: o usuário pediu "que cada novo projeto cliente criado possa utilizá-los" e a forma só-comando-inline não escala — qualquer evolução nos agentes teria que ser duplicada manualmente em cada consumidor.

**Decisão**: extrair os 6 agentes (`spec`, `backend`, `frontend`, `schema`, `test`, `review`) como **templates físicos canônicos** em `templates/aios/`, com placeholders bem definidos e SYSTEM_PROMPTs neutros (sem hardcode de cliente/stack/framework).

**Diferença-chave vs. SchoolPlatform**:
- `schema_agent` é **stack-agnostic**: lê `aios/config.yaml → stack.database` e gera schema na stack declarada; se vazia, propõe 1-3 stacks com tradeoffs e pede decisão humana antes do schema definitivo
- `backend_agent`, `frontend_agent`, `test_agent` leem `stack.{backend,frontend,tests}` da config — não cravam Next.js/Prisma/Vitest
- `orchestrator.py` lê `modules:` da config (em vez de lista hardcoded de 15 módulos do SchoolPlatform)
- Todos têm bloco Langfuse + `_MockTrace` obrigatório (C6)
- `tenantId` sempre via `task_input["tenant_id"]` (C8)

**Mapeamento com a Constitution**:

| Princípio | Como Foundry-7 aplica |
|---|---|
| C5 (Three-tier) | `tier: A | B | C` no `config.json` de cada agente especializado; agentes compartilhados marcados `tier: shared` |
| C6 (Telemetry) | Bloco Langfuse + `_MockTrace` no boilerplate de cada `entry.py.template` (não opcional) |
| C7 (Portability) | SYSTEM_PROMPT funciona standalone em Claude Code (declarado no comentário-cabeçalho); kernel offline ≠ agente inutilizável |
| C8 (Anti-heroic) | Stack lida de `aios/config.yaml`, nunca cravada; `tenantId` em `task_input`; nenhum nome de cliente em código |

**Decisão de versionamento**: Foundry-7 é nova onda → MINOR bump (v0.5.0 → v0.6.0). Não viola Constitution.

**Artefatos Foundry-7 entregues**:
- F7.1 — `templates/aios/README.md` (documentação dos placeholders, tabela de diferenças vs. SchoolPlatform)
- F7.2 — `templates/aios/orchestrator.py.template` + `templates/aios/config.yaml.template`
- F7.3 — 6 agentes em `templates/aios/agents/{spec,backend,frontend,schema,test,review}_agent/{entry.py.template, config.json.template}`
- F7.4 — `/novais-digital:aios-init` v0.2.0 (copia de templates físicos; cobre 6 agentes; cria orchestrator/config quando ausentes)
- F7.5 — `manifest.json` v0.6.0 com novo bloco `templates_aios.files[]` (9 entradas)
- F7.6 — `roadmap.md` Foundry-7 section
- F7.7 — F24 em decisions.md

**Trade-off aceito**: centralizar os agentes impõe evolução coordenada — qualquer mudança no padrão atualiza 6 arquivos. Em troca, todos os projetos consumidores recebem a mesma evolução via `cp -r` ou via re-run do `/novais-digital:aios-init` na próxima vez (idempotente para agentes compartilhados, regenera os especializados).

---

## F25 (NOVO 2026-05-07) — CI/CD como pré-requisito de produção (Foundry-8)

**Status**: ✅ **Formalizado em 2026-05-07 — Foundry-8 entregue**

**Contexto**: Foundry-0 a Foundry-7 construíram toda a governança de IA — Constitution, skills, commands, hooks, agentes AIOS — mas **não impunham CI/CD como pré-requisito mecânico para produção**. O resultado prático era que projetos podiam promover SKUs para AUTONOMOUS sem nenhuma automação de validação: regressões de prompt passavam despercebidas, auditorias mensais eram manuais e inconsistentes, e branch protection não era verificada.

**Problema concreto**: o Gate 5 (aprovação cruzada humana) pode ser executado mesmo sem CI/CD, criando um falso senso de segurança. Um SKU em AUTONOMOUS sem pipeline de eval automático pode ter `prompt_hash` em produção diferente do `prompt_hash` validado — exatamente o drift que `/novais-digital:eval` e o hook `langfuse-trace-check` tentam prevenir no desenvolvimento local.

**Decisão**: tornar CI/CD um **Gate obrigatório (Gate 6)** no `/novais-digital:promote`, especificamente para a transição `assisted_to_autonomous`. Para transições anteriores (start_shadow, shadow_to_assisted), CI/CD é fortemente recomendado mas não bloqueia.

**O que o Foundry provê (Foundry-8)**:

1. **`templates/cicd/github-actions-validate.template.yml`** — workflow de validação para todo PR:
   - `foundry-doctor.sh` (7 checks estruturais)
   - `skill-security-scan.sh` (5 checks de segurança)
   - Pre-merge G1-G5 (C7 imports, C8 anti-hardcode, C6 observe(), manifest sync, eval freshness)

2. **`templates/cicd/github-actions-eval.template.yml`** — eval automático em mudanças de `prompts/`:
   - Detecta artifact_id modificado
   - Roda eval por categoria; falha PR se `pass_rate < agreement_rate_min`
   - Trace Langfuse obrigatório em CI (C6)
   - Comentário automático no PR com resumo

3. **`templates/cicd/github-actions-audit.template.yml`** — auditoria mensal via cron:
   - Cron: 1ª segunda-feira do mês, 06:00 UTC
   - Invoca reviewer DeepAgent (`foundry-auditor`)
   - Commit automático de `docs/foundry/audits/{YYYY-MM}.md`
   - Cria Issue se SLA breach detectado

4. **`templates/cicd/cicd-checklist.template.md`** — checklist platform-agnostic:
   - 27 itens em 7 seções (validação, pre-merge, eval, auditoria, branch protection, secrets, rastreabilidade)
   - 18 itens 🔴 obrigatórios para Gate 6; 9 itens 🟡 recomendados
   - Campo `gate_6_status: pass | fail | pending` lido pelo `promotion-officer`

**Gate 6 (mecânico no `/novais-digital:promote`)**:

| Evidência exigida | Como verificar |
|---|---|
| `docs/cicd-checklist-{artifact_id}.md` com `gate_6_status: pass` | Ler arquivo; verificar campo YAML |
| Todos os 18 itens 🔴 marcados | Contar checkboxes marcados |
| `ci_pipeline_url` preenchido e acessível | Verificar URL não-nula |
| `last_ci_run_status: passing` | Ler campo; opcionalmente verificar via GitHub API |
| Workflows presentes: `foundry-validate`, `foundry-eval`, `foundry-audit` | `find .github/workflows/ -name "foundry-*.yml"` |

**Mapeamento com a Constitution**:

| Princípio | Como Foundry-8 aplica |
|---|---|
| C1 (Audit trail) | Auditoria mensal automatizada; relatório commitado; Issue criada em SLA breach |
| C4 (SHADOW antes de cobrar) | Gate 6 garante que eval automático está ativo antes de AUTONOMOUS — o dado de produção é monitorado |
| C6 (Telemetria) | Eval em CI tem trace Langfuse obrigatório (campo `LANGFUSE_PUBLIC_KEY` em secrets) |
| C7 (Portabilidade) | Templates de CI são agnósticos de projeto — placeholders `{PROJECT_NAME}`, `{ARTIFACT_ID}` |

**Decisão de versionamento**: Foundry-8 adiciona Gate 6 (novo constraint) mas não muda nenhum princípio da Constitution. É MINOR bump (v0.6.0 → v0.7.0). Não exige ADR de Constitution.

**Trade-off aceito**: Gate 6 aumenta o custo de entrada para AUTONOMOUS (Wave 6 do tasks tem 5 tasks adicionais). Em troca, qualquer SKU em AUTONOMOUS tem garantia mecânica de que regressões são detectadas automaticamente.

---

## F26 (NOVO 2026-05-08) — Foundry-9: Constitution delivery-type agnostic (v0.3.0)

**Status**: ✅ **Formalizado em 2026-05-08 — Constitution v0.3.0**

**Decisão**: Desacoplar a Constitution do pressuposto de "agente de IA". Introduzir `project_type` (`agentic_saas` / `platform` / `automation` / `hybrid`) e `ai_enabled` para que os 8 princípios se apliquem igualmente a plataformas, automações e produtos híbridos.

**Mudanças em C1–C8**: C1 renomeado "Diagnose-before-build"; C3 generalizado para custo-por-outcome OU margem-de-plataforma; C4 ganha vocabulário paralelo (DRAFT/STAGING/PILOT/CANONICAL/DEPRECATED); C6 ganha audit-log como provedor obrigatório quando `ai_enabled=false`; C7 ampliado para integrações/pagamentos/infra.

**Backwards compatible**: projetos sem `docs/foundry/project.json` tratados como `agentic_saas` + `ai_enabled=true`.

---

## F27 (NOVO 2026-05-27) — Foundry-22: PILOT mode + Synthetic pre-validation para `agentic_saas` (Constitution v0.4.0)

**Status**: ✅ **Formalizado em 2026-05-27 — Constitution v0.4.0**

**Decisão**: Introduzir modo `PILOT` na tabela C4 de `agentic_saas` e reconhecer formalmente `Synthetic pre-validation` (Rota B) como caminho alternativo ao SHADOW mínimo de 14 dias.

**O que muda em C4**:
- Nova linha `PILOT` na tabela de modos: agente entrega output normalmente para ≤N clientes controlados (default N=50); CEO aprova ativação; sem cobrança variável adicional nesta fase.
- Rota A (SHADOW precedente): mantém requisito de ≥ 14 dias em SHADOW + eval passing + aprovação CEO.
- Rota B (Synthetic pre-validation): ≥ 3 perfis sintéticos × ≥ 10 análises/perfil, documentados em `docs/evals/synthetic-prevalidation.md`, KPIs ≥ thresholds, aprovação CEO. **Substitui** a janela de 14 dias.
- Promoção para ASSISTED: ≥ 30 dias em PILOT + qualidade ≥ threshold + feedback real documentado + CEO.
- Promoção para AUTONOMOUS: igual ao original + cross-approval Promotion Officer + Security Guardian.

**Contexto (Aicfo)**: 10/10 análises LangGraph validadas em staging. ADR-013 documenta a aplicação no SKU `monthly-analysis`.

---

## Histórico de mudanças

| Versão | Data | Mudança | Razão |
|---|---|---|---|
| 0.1.0 | 2026-04-30 | Aprovação dos 8 defaults iniciais | Plano inicial aprovado |
| 0.1.0 | 2026-04-30 | F4 override: Gemini → DeepAgents/GPT-5.5 | Diretiva direta |
| 0.2.0 | 2026-04-30 | F2 atualizado para repo standalone | Reposicionamento como produto distribuível |
| 0.2.0 | 2026-04-30 | F13-F16 adicionadas | Generalização da Constitution + estrutura examples/ + versionamento + distribuição |
| 0.4.0 | 2026-05-01 | F19-F21 adicionadas | Foundry-5: estratégia de playbooks + reavaliação de deploy global e plugin |
| 0.4.1 | 2026-05-04 | F22 adicionada; sincronização de metadados | Auditoria interna pré-CI detectou 6 divergências acumuladas |
| 0.5.0 | 2026-05-06 | F23 adicionada; Foundry-6 AIOS infraestrutura entregue | Adoção de AIOS Server pelo projeto consumidor SchoolPlatform |
| 0.6.0 | 2026-05-07 | F24 adicionada; Foundry-7 AIOS templates portáveis entregues | 6 agentes canônicos em templates/aios/ para serem reusados por todos os projetos consumidores; schema_agent stack-agnostic |
| 0.7.0 | 2026-05-07 | F25 adicionada; Foundry-8 CI/CD esteira completa entregue | Gate 6 obrigatório para AUTONOMOUS; 4 templates CI/CD; Wave 6 no tasks; promotion-officer atualizado |
| 0.22.0 | 2026-05-08 | F26 adicionada; Constitution v0.3.0 delivery-type agnostic | `project_type` + `ai_enabled` desacoplam regras de IA de regras de plataforma |
| 0.22.1 | 2026-05-27 | F27 adicionada; Constitution v0.4.0 PILOT mode + Synthetic pre-validation | C4 `agentic_saas` ganha PILOT mode (entrega real ≤50 clientes) e Rota B (synthetic pre-validation substitui SHADOW 14 dias) |
