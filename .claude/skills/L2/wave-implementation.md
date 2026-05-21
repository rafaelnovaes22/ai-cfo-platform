---
name: wave-implementation
description: Implementa em ondas verticais finas, verificando entre cada onda com forge-doctor. Use quando executar /acme:implement, ao implementar qualquer mudança que toque mais de um arquivo, ou sempre que sentir a tentação de escrever muito código de uma vez antes de testar. Adaptado de incremental-implementation (agent-skills).
tier: 2
vocabulary_aliases: [L2, wave, incremental, ondas]
linked_principles: [C3, C6, C8]
version: 1.0.0
activation:
  keywords: [implement, onda, wave, incremental, tarefa, task, /acme:implement]
  explicit_invocation: "@wave-implementation"
---

# Wave Implementation (Forge)

## Visão Geral

Construa em ondas verticais finas — implemente uma onda, verifique com `forge-doctor`, commit, avance. Não implemente um feature inteiro em um passe. Cada onda deve deixar o sistema num estado funcional e auditável.

No contexto Forge, "onda" tem dois significados sobrepostos:

1. **Ondas do pipeline `/acme:tasks`** — Onda 1 (scaffolding) → Onda 2 (prompt/service) → Onda 3 (eval/test) → Onda 4 (SHADOW/PILOT prep) → Onda 5 (métricas) → Onda 6 (CI/CD)
2. **Ondas de implementação** — dentro de cada onda do pipeline, implementar em fatias verticais: schema → lógica → instrumentação C6 → teste

Esta skill trata do segundo: disciplina de execução dentro de cada onda.

## Quando Usar

- Executando tarefas de `/acme:tasks` — especialmente Ondas 1–3
- Ao escrever código que toca mais de um arquivo
- Quando a tarefa parece grande demais para um passe só
- Ao implementar adapters C7 em `src/llm/adapters/`
- Ao adicionar instrumentação C6 (`observe()`) em código existente

**Quando NÃO usar:** Mudança de arquivo único e escopo mínimo (ex.: corrigir um typo num template).

## O Ciclo de Onda

```
Implementar ──→ forge-doctor ──→ Commit ──┐
     ▲                                     │
     └───────────── Próxima fatia ◄────────┘
```

Para cada fatia:

1. **Implementar** a menor peça completa de funcionalidade
2. **Verificar** com `bash scripts/forge-doctor.sh` — zero FAILs antes de avançar
3. **Commit** com mensagem no formato: `type(scope): desc`
4. **Avançar** para a próxima fatia

`forge-doctor` é o gate entre commits. Não pule, não faça "depois eu arrejo".

## Estratégias de Fatiamento para Forge

### Fatia Vertical (Padrão)

Construa um caminho completo pela stack em cada fatia:

```
Fatia 1: Schema + adapter C7 + observe() mínimo
    → forge-doctor passa, trace aparece no Langfuse

Fatia 2: Lógica de negócio + casos de erro
    → forge-doctor passa, casos de erro testados

Fatia 3: Eval seed (3+3 casos mínimos para C4)
    → forge-doctor passa, eval suite verde

Fatia 4: Prompt compression e cost check (C3)
    → forge-doctor passa, cost ≤ 25% do preço
```

Cada fatia entrega funcionalidade testável de ponta a ponta.

### TDD-Red First (Forge-10)

Para projetos agentic (`ai_enabled: true`), a Onda 3 exige TDD-red:

```
Fatia 0: Escrever testes que FALHAM (red phase)
    → Confirmar que os testes falham pelo motivo certo

Fatia 1: Implementar o mínimo para passar (green phase)
    → forge-doctor + testes passam

Fatia 2: Refatorar sem quebrar (refactor)
    → forge-doctor ainda passa
```

Nunca pule o red phase — é um gate do Forge-10 verificado em CI.

### Risk-First (Para Integrações Externas)

Se a fatia mais incerta é a integração com SDK externo:

```
Fatia 1: Provar que o adapter C7 conecta (maior risco)
    → Confirmar antes de investir nas fatias 2+

Fatia 2: Construir lógica sobre adapter confirmado
Fatia 3: Adicionar observabilidade C6 completa
```

## Regras de Implementação

### Regra 0: Simplicidade Primeiro

Antes de escrever código, pergunte: "Qual é a coisa mais simples que funciona?"

```
CHECK DE SIMPLICIDADE:
✗ EventBus genérico com pipeline de middleware para uma notificação
✓ Chamada de função direta

✗ Factory pattern abstrato para dois adapters similares
✓ Dois adapters diretos com utilitários compartilhados

✗ Config-driven form builder para três formulários
✓ Três componentes de formulário
```

### Regra 0.5: Disciplina de Escopo (C8-aware)

Toque apenas o que a tarefa requer. No Forge, há uma armadilha extra: **não adicione código específico por tenant enquanto implementa um feature genérico**.

NÃO faça:
- "Limpar" código adjacente à sua mudança
- Adicionar features não descritas na spec porque "parecem úteis"
- Hardcodar tenant-specific behavior enquanto implementa a lógica genérica (viola C8)
- Refatorar imports em arquivos que você só está lendo

Se notar algo fora do escopo:

```
NOTADO MAS NÃO TOCANDO:
- src/llm/adapters/claude.ts tem model hardcoded (violação C8 — tarefa separada)
- O trace em observe() está sem o campo required_field (C6 — tarefa separada)
→ Quer que eu crie tasks para isso?
```

### Regra 1: Uma Coisa por Commit

Cada commit muda uma coisa lógica. Não misture concerns:

**Ruim:** Um commit que adiciona adapter, refatora utilitário existente e atualiza manifest.

**Bom:** Três commits separados — um para cada mudança.

### Regra 2: forge-doctor Verde Entre Commits

Após cada fatia, o projeto deve passar no `forge-doctor`:

```bash
bash scripts/forge-doctor.sh
# Deve retornar 0 FAILs antes do commit
```

Não passe para a próxima fatia com FAILs pendentes. Debugar 500 linhas de uma vez é mais caro do que parar agora.

### Regra 3: Save Point Pattern (forge-release-discipline)

Commit após cada tarefa que passa no forge-doctor. Isso cria save points auditáveis:

```bash
# Após cada fatia bem-sucedida:
git add src/llm/adapters/claude.ts
git commit -m "feat(skill-L2): adapter claude com observe() mínimo"

# Não acumule mudanças grandes não-commitadas
```

### Regra 4: Manifest Sync em Cada Onda Completa

Ao completar uma onda inteira (ex.: Onda 1 scaffolding), o hook `manifest-sync` roda automaticamente. Verifique que o manifest foi atualizado:

```bash
git diff docs/forge/manifest.json
# Deve refletir novos artefatos da onda
```

Se o manifest não atualizou, atualize manualmente antes de fechar a onda.

## Trabalhando com Ondas do Pipeline

Ao executar `/acme:tasks`, cada task tem um gate de pronto. Trate cada gate como o "commit" entre fatias:

```markdown
# tasks-{artifact_id}.md
## Onda 1 — Scaffolding
- [x] T1.1: Criar src/prompts/{artifact_id}/v1.md — Gate: arquivo existe
- [x] T1.2: Criar src/llm/adapters/{artifact_id}.ts — Gate: forge-doctor passes
- [ ] T1.3: Criar TenantContext mínimo — Gate: C8 check passa
```

Marque cada task como concluída antes de avançar. Não marque antecipadamente.

## Checklist Entre Fatias

Após cada fatia:

- [ ] A mudança faz uma coisa e faz completamente
- [ ] `forge-doctor.sh` passa sem FAILs
- [ ] Instrumentação C6 (`observe()`) presente em toda chamada LLM nova
- [ ] Nenhum tenant hardcoded introduzido (C8)
- [ ] Commit feito com mensagem no formato correto
- [ ] Manifest sincronizado se artefato novo foi criado

## Racionalizações Comuns

| Racionalização | Realidade |
|---|---|
| "Vou testar tudo no final" | Bugs se compõem. Um bug na Fatia 1 corrompe as Fatias 2–5. `forge-doctor` a cada fatia. |
| "É mais rápido fazer tudo de uma vez" | *Parece* mais rápido até algo quebrar e você não saber qual das 500 linhas causou. |
| "Esse C8 fix é pequeno, incluo no mesmo commit" | Fixes de compliance misturados com features tornam ambos mais difíceis de auditar. Separe. |
| "Vou adicionar o observe() depois" | C6 não é opcional. Implementar sem telemetria e adicionar depois é trabalho duplo. Faça na fatia. |
| "Esse refactor aqui é rápido" | Refactors misturados com features dificultam rollback e revisão. Crie uma task separada. |

## Red Flags

- Mais de 100 linhas escritas sem rodar `forge-doctor`
- Múltiplas mudanças não relacionadas num único incremento
- "Deixa eu adicionar isso rapidinho também" — expansão de escopo
- forge-doctor com FAILs entre fatias
- Grandes mudanças não-commitadas acumulando
- Tenant hardcode introduzido "provisoriamente" (viola C8 permanentemente até ser descoberto)
- Instrumentação C6 adiada para "depois"
- Manifest desincronizado com artefatos criados

## Verificação Final da Onda

Ao completar todas as fatias de uma onda:

- [ ] Cada fatia foi individualmente verificada e commitada
- [ ] `forge-doctor.sh` passa completamente
- [ ] Feature funciona de ponta a ponta conforme spec
- [ ] Sem mudanças não-commitadas
- [ ] Manifest sincronizado
- [ ] Se onda agentic: traces visíveis no Langfuse
- [ ] Se onda platform: acceptance tests passando
