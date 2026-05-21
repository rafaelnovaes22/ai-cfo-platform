# Padrões de Orquestração — Acme Forge

Catálogo de referência de padrões de orquestração endossados pelo Forge, mais anti-padrões a evitar. Leia isto antes de adicionar um novo `/acme:*` command que coordene múltiplos Guardians, ou antes de criar um Guardian que "envolva" outros.

A regra central: **o usuário (ou um slash command) é o orquestrador. Guardians não invocam outros Guardians. Skills não invocam outras skills de tier superior.**

Adaptado de `agent-skills/references/orchestration-patterns.md` por addyosmani, estendido para o vocabulário Forge.

---

## Padrões Endossados

### 1. Invocação Direta (sem orquestração)

Um Guardian, uma perspectiva, um artefato. O padrão padrão e mais barato.

```
usuário → @po-guardian → cláusula de outcome validada → usuário
```

**Use quando:** o trabalho é uma perspectiva sobre um artefato e você consegue descrever em uma frase.

**Exemplos:**
- "Valide a cláusula de outcome desta spec" → `@po-guardian`
- "Verifique se o custo está dentro do C3" → `@unit-economist`
- "Há PII exposto neste trace?" → `@security-privacy-guardian`
- "O código tem hardcode de tenant?" → `@tenant-context-curator`

**Custo:** uma ida e volta. A baseline contra qual comparar padrões orquestrados.

---

### 2. Slash Command como Wrapper de Um Guardian

Um `/acme:*` command que envolve um Guardian com o contexto do projeto. Poupa o usuário de re-explicar o workflow toda vez.

```
/acme:spec → @po-guardian (valida C2) → spec.md persistida
```

**Use quando:** a mesma invocação de único Guardian acontece repetidamente com o mesmo setup.

**Exemplos neste repo:** `/acme:diagnose`, `/acme:eval`, `/acme:sla-threshold`.

**Custo:** mesmo que invocação direta. O command é apenas um prompt salvo.

**Anti-sinal:** se o corpo do command é majoritariamente "decidir qual Guardian chamar", delete-o e deixe o usuário chamar o Guardian diretamente.

---

### 3. Fan-Out Paralelo com Merge (Promote Gate)

Múltiplos Guardians operam sobre o mesmo input concorrentemente, cada um produzindo um relatório independente. Um merge step sintetiza em uma decisão go/no-go.

```
                        ┌─→ @po-guardian          (C2 outcome hash) ─┐
/acme:promote ──────  ┼─→ @unit-economist        (C3 viabilidade)   ├→ merge → go/no-go + signature
                        ├─→ @eval-engineer         (C4 gate)          │
                        ├─→ @artifact-architect    (C5/C7/C8 code)    │
                        └─→ @promotion-officer     (assinatura final) ─┘
```

**Use quando:**
- As sub-tarefas são genuinamente independentes (sem estado mútuo compartilhado, sem dependência de ordem)
- Cada sub-agente se beneficia de seu próprio context window
- O merge step é pequeno o suficiente para caber no contexto principal
- Latência de wall-clock importa

**Exemplos neste repo:** `/acme:promote` (fan-out de 5 Guardians + merge).

**Checklist antes de adotar:**
- [ ] Posso rodar todos os sub-agentes ao mesmo tempo sem problemas de ordenação?
- [ ] Cada Guardian produz um tipo *diferente* de finding, não a mesma perspectiva?
- [ ] O merge step caberá no contexto restante do agente principal?
- [ ] O tempo de espera do usuário é longo o suficiente para que o paralelismo seja perceptível?

Se qualquer resposta for "não", retorne à invocação direta ou a um command de único Guardian.

---

### 4. Pipeline Sequencial por Slash Commands (usuário como orquestrador)

O usuário executa slash commands em ordem definida, carregando contexto (ou histórico de commits) entre eles. Não há agente orquestrador — **o usuário É o orquestrador**.

```
usuário executa:
/acme:diagnose → /acme:spec → /acme:unit-economics → /acme:sla-threshold
→ /acme:plan → /acme:tasks → /acme:implement → /acme:eval
→ /acme:pre-merge-check → /acme:promote → /acme:audit-monthly
```

**Use quando:** o workflow tem dependências (cada step precisa do output do anterior) e julgamento humano entre steps agrega valor.

**Custo:** um sub-agente por step. Grátis para a camada de orquestração porque não há agente orquestrador.

**Por que não automatizar:** um LLM "lifecycle orchestrator" (a) perderia nuance entre steps por ter que resumir para hand-off, (b) pularia os checkpoints humanos que detectam direção errada cedo, e (c) dobraria o custo de tokens por paraphrasing turns.

---

### 5. Isolamento de Pesquisa (preservação de contexto)

Quando uma tarefa exige leitura de grande quantidade de material que não deve poluir o contexto principal, spawnar um sub-agente de pesquisa que retorna apenas um digest.

```
agente principal → sub-agente Explore (lê 40 arquivos) → digest → agente principal continua
```

**Use quando:**
- A sessão principal precisa permanecer focada em uma tarefa downstream
- O resultado da investigação é muito menor que o input consumido
- A qualidade de decisão beneficia o agente principal tendo espaço para pensar depois

**Exemplos Forge:** "Encontre todos os artefatos no manifest sem linked_principles", "Summarize o que as 5 audits dizem sobre drift de custo".

**No Claude Code, use o sub-agente `Explore` built-in** em vez de definir um Guardian customizado. `Explore` roda em Haiku, não tem ferramentas de escrita, e é feito para este padrão.

---

### 6. Fan-Out de Review (Pre-Merge Paralelo)

Para `/acme:pre-merge-check`, múltiplas verificações de princípio rodam em paralelo sobre o diff, cada uma focada em um eixo diferente.

```
                  ┌─→ G1: C7 imports check     (SDK só em adapters/)
                  ├─→ G2: C8 tenant hardcode   (zero if/switch por tenant)
/pre-merge ─────  ┼─→ G3: C6 observe() check  (toda chamada LLM rastreada)
                  ├─→ G4: manifest sync         (hashes atualizados)
                  └─→ G5: eval suite            (pass rate ≥ threshold)
                                    ↓
                             go/no-go estruturado
```

**Por que paralelizar:** cada gate é independente. Um G1 failure não impede G3 de rodar. O merge lista todos os failures de uma vez — mais útil que falhar no primeiro.

---

## Anti-Padrões

### A. Guardian Roteador ("meta-orquestrador")

Um Guardian cujo trabalho é decidir qual outro Guardian chamar.

```
/acme:work → guardian-router → "isto precisa de review" → @po-guardian → router (parafraseia) → usuário
```

**Por que falha:**
- Camada de roteamento puro sem valor de domínio
- Adiciona duas paráfrases → perda de informação + ~2× custo de tokens
- O usuário já sabia que queria review; poderia ter chamado diretamente
- Replica o trabalho que os slash commands e `@forge-router` já fazem

**O que fazer em vez disso:** adicionar ou refinar um `/acme:*` command. Documentar mapeamento de intenção → command em `CLAUDE.md` e no `@forge-router`.

---

### B. Guardian que Invoca Outro Guardian

Um `@artifact-architect` que internamente invoca `@po-guardian` quando vê uma spec.

**Por que falha:**
- Guardians foram projetados para produzir uma perspectiva única; encadeá-los derrota isso
- O resumo que o Guardian chamador passa perde contexto que o chamado precisa
- Failure modes se multiplicam (qual formato de output ganha? quais regras se aplicam?)
- Esconde custo do usuário

**O que fazer em vez disso:** o Guardian chamador *recomenda* um follow-up em seu relatório. O usuário ou um slash command roda o segundo Guardian.

---

### C. Orquestrador Sequencial que Parafraseia

Um agente que chama `/acme:diagnose`, depois `/acme:spec`, depois `/acme:plan` em nome do usuário, automaticamente.

**Por que falha:**
- Perde os checkpoints humanos que detectam trabalho em direção errada
- Cada hand-off resume contexto — drift acumulado em pipeline longo
- Dobra custo de tokens: turn do orquestrador + turn do sub-agente por step
- Remove agência do usuário exatamente nos pontos onde julgamento importa mais

**O que fazer em vez disso:** manter o usuário como orquestrador. Documentar a sequência recomendada em `HELLO.md` e deixar o usuário invocá-la. `@forge-router` classifica a intenção e sugere o próximo command — não executa a sequência toda.

---

### D. Árvores Profundas de Guardian

`/acme:promote` chama um `pre-promote-coordinator` que chama um `quality-coordinator` que chama `@artifact-architect`.

**Por que falha:**
- Cada camada adiciona latência e tokens sem valor de decisão
- Debug vira investigação multi-nível
- Os Guardians folha perdem contexto para múltiplos steps de sumarização

**O que fazer em vez disso:** manter a profundidade de orquestração em no máximo 1 (slash command → Guardians). O merge acontece no agente principal.

---

### E. Skill que Viola Hierarquia de Tier (C5)

Uma skill L1 que lê diretamente de `evals/` (Tier 3), pulando o carregamento de contexto estratégico L0.

**Por que falha:**
- Viola C5: L1 não lê Tier 3 sem passar por L0 primeiro
- Contamina contexto tático com dados operacionais
- Reduz cache efficiency (Tier 1 tokens não reutilizados)

**O que fazer em vez disso:** declarar `must_not_read: [3]` no frontmatter da skill L1. O agente principal passa o digest necessário como parâmetro em vez de deixar a skill ler.

---

## Fluxo de Decisão

Quando considerar um novo workflow orquestrado, percorra este fluxo:

```
O trabalho é uma perspectiva sobre um artefato?
├── Sim → Invocação direta. Parar.
└── Não → A mesma composição vai se repetir?
           ├── Não → Invocação direta, ad hoc. Parar.
           └── Sim → As sub-tarefas são independentes?
                      ├── Não → Pipeline sequencial de slash commands pelo usuário (Padrão 4).
                      └── Sim → Fan-out paralelo com merge (Padrão 3).
                                 Validar contra o checklist acima.
                                 Se qualquer check falhar → retornar ao command de único Guardian (Padrão 2).
```

---

## Compatibilidade com Claude Code

### Onde Guardians vivem

Guardians do Forge ficam em `.claude/agents/`. São auto-descobertos pelo Claude Code quando a sessão inicia. Sem configuração de path necessária.

### Sub-agentes vs. Agent Teams

Claude Code tem duas primitivas de paralelismo. O Padrão 3 (fan-out paralelo com merge) usa **sub-agentes**. Para Guardians que precisam debater entre si, use **Agent Teams** (experimental).

| | Sub-agentes | Agent Teams |
|--|-------------|-------------|
| Coordenação | Agente principal faz fan-out, sub-agentes só reportam de volta | Teammates trocam mensagens, compartilham task list |
| Context | Próprio context window por sub-agente | Próprio context window por teammate |
| Use quando | Tarefas independentes produzindo relatórios | Trabalho colaborativo precisando de debate |
| Status | Estável | Experimental — `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |

**Fan-out paralelo em Claude Code** exige múltiplas chamadas `Agent tool` em um único turn do assistente. Turns sequenciais serializam a execução.

### Sub-agentes built-in a conhecer

| Built-in | Propósito no Forge |
|----------|-------------------|
| `Explore` | Pesquisa read-only de codebase — Padrão 5 (isolamento) |
| `Plan` | Pesquisa read-only durante plan mode |
| `general-purpose` | Tasks multi-step precisando de exploração e modificação |

Não redefina esses. Construa Guardians especializados em cima deles.

---

## Quando adicionar um novo padrão a este catálogo

Adicione uma nova entrada apenas após:

1. Você usou o padrão pelo menos duas vezes em trabalho real no Forge
2. Você consegue nomear um artefato concreto neste repo que o demonstra
3. Você consegue explicar por que um padrão existente não teria funcionado
4. Você consegue descrever seu anti-padrão sombra (o que as pessoas vão construir errado em vez disso)

Entradas prematuras viram documentação aspiracional que ninguém segue.
