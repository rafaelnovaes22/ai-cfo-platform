---
name: foundry-release-discipline
description: Disciplina de versionamento e release para o framework Foundry e para projetos consumidores. Use ao fazer qualquer mudança no Foundry (nova skill, hook, command, agente) ou ao preparar um release em consumer project. Garante SemVer correto, CHANGELOG.md atualizado, manifest.json sincronizado e badge de README consistente. Adaptado de git-workflow-and-versioning (agent-skills).
tier: 1
vocabulary_aliases: [L1, versioning, release, semver, git-workflow]
linked_principles: [C4, C5]
version: 1.0.0
activation:
  keywords: [versionar, release, commit, bump, changelog, manifest, semver, branch]
  explicit_invocation: "@foundry-release-discipline"
---

# Foundry Release Discipline

## Visão Geral

Git é a rede de segurança. Commits são save points, branches são sandboxes, e histórico é documentação. Com agentes de IA gerando código em alta velocidade, controle de versão disciplinado é o mecanismo que mantém mudanças rastreáveis, revisáveis e reversíveis.

**Dois contextos:** (1) releases do próprio framework Foundry, (2) releases de projetos consumidores.

## Regras de SemVer para o Foundry

| Tipo | Quando | Exemplos |
|------|--------|---------|
| **MAJOR** | Quebra da Constitution (princípio C1-C8 removido ou reformulado) | Remover C6, renomear C4 |
| **MINOR** | Onda Foundry concluída (nova capability: skill, command, agente, hook, template) | Foundry-15: +3 skills +1 hook |
| **PATCH** | Correção sem mudar contrato (fix de typo, hash de manifest, badge de README) | foundry-doctor FAIL → fix badge |

**Regra do MAJOR:** exige ADR em `docs/foundry/decisions.md` + comunicação ao reviewer DeepAgent + atualização do prompt do reviewer.

## Checklist de Release (Foundry Framework)

Toda nova onda do Foundry exige estes 5 artefatos atualizados **antes** do commit:

```
- [ ] 1. docs/foundry/manifest.json  — versão + novos artefatos com sha256 + phase
- [ ] 2. CHANGELOG.md              — nova seção [X.Y.Z] com Added/Changed/Fixed
- [ ] 3. README.md                 — badge version + badge phase
- [ ] 4. docs/foundry/decisions.md   — nova entrada F-série com data e trade-offs
- [ ] 5. bash scripts/foundry-doctor.sh — 0 FAIL antes de commitar
```

Qualquer FAIL no foundry-doctor é um gate: não commita até corrigir.

## Padrão de Commit para o Foundry

### Formato

```
<type>(<scope>): <descrição curta>

<corpo opcional — o porquê, não o quê>
```

**Types:**
- `feat` — nova skill, command, agente, hook, template
- `fix` — correção de bug, hash desatualizado, badge errado
- `refactor` — reorganização sem mudar comportamento
- `docs` — documentação, decisions.md, roadmap
- `chore` — scripts, CI, configuração

**Scopes Foundry:** `skill-L0`, `skill-L1`, `skill-L2`, `hook`, `command`, `agent`, `template`, `manifest`, `ci`

**Exemplos:**
```
feat(skill-L2): add debugging-pipeline skill for Foundry artifact triage
feat(hook): add SessionStart hook with foundry-context injection
fix(manifest): update sha256 hashes for Foundry-15 artifacts
docs(decisions): register F50 — SessionStart + orchestration patterns
```

### Commits Atômicos

Cada commit faz uma coisa lógica:

```
# BOM — cada commit é independente e reversível
git log --oneline
a1b2c3d feat(skill-L2): add debugging-pipeline skill
d4e5f6g feat(skill-L2): add prompt-simplification skill
h7i8j9k feat(skill-L1): add foundry-release-discipline skill
m1n2o3p feat(manifest): register 3 new skills v0.17.0

# RUIM — tudo misturado
x1y2z3a add skills, fix manifest, update changelog, bump version
```

**Não misture** simplificação de prompt com nova feature. **Não misture** refatoração de hook com atualização de CHANGELOG.

## Padrão de Branch

### Branches do Foundry

```
master (sempre deployável — foundry-doctor 0 FAIL)
  │
  ├── foundry-15/session-start-hook    ← feature por onda
  ├── foundry-15/sdlc-skills           ← sub-feature dentro da onda
  └── fix/manifest-hash-drift        ← correções isoladas
```

- Branch a partir de `master`
- Vida curta: merge dentro de 1-3 dias
- Deletar após merge
- Branch names: `foundry-{N}/{feature}` ou `fix/{descrição}`

### Branches de Consumer Project

```
main (sempre deployável)
  │
  ├── feature/shadow-prompt-v2       ← nova versão de prompt
  ├── feature/eval-seed-{artifact}   ← eval cases de um artefato
  ├── wave-2/implement-{artifact}    ← implementação de uma wave
  └── fix/c6-missing-observe         ← violação C6 detectada no pre-merge
```

Branches longos (>3 dias) são custo oculto — acumulam conflito de merge e atrasam integração.

## Padrão Save Point

```
Agente começa uma wave de implementação
    │
    ├── Implementa uma task
    │   ├── foundry-doctor passa? → Commit → Próxima task
    │   └── foundry-doctor falha? → Reverter para último commit → Investigar
    │
    ├── Implementa outra task
    │   ├── foundry-doctor passa? → Commit → Próxima task
    │   └── foundry-doctor falha? → Reverter → Investigar
    │
    └── Wave completa → Todos os commits formam histórico limpo
```

Este padrão garante que você nunca perde mais de uma increment de trabalho. `git reset --hard HEAD` leva de volta ao último estado bom.

## Change Summary (pós-wave)

Após qualquer wave de implementação, forneça um resumo estruturado:

```
MUDANÇAS FEITAS:
- .claude/skills/L2/debugging-pipeline.md: nova skill criada
- .claude/skills/L2/prompt-simplification.md: nova skill criada
- docs/foundry/manifest.json: 2 novas entradas + bump v0.17.0
- CHANGELOG.md: seção [0.17.0] adicionada

COISAS QUE NÃO TOQUEI (intencionalmente):
- .claude/skills/L1/baseline-cost-builder.md: escopo desta wave
- hooks/pre-tool-use/: não era parte desta wave

PONTOS DE ATENÇÃO:
- foundry-doctor retorna 0 FAIL ✅
- 3 skills novas adicionadas ao manifest com sha256 correto
```

O bloco "NÃO TOQUEI" é especialmente importante — mostra disciplina de escopo e que não houve renovação não-solicitada.

## Higiene Pré-Commit

Antes de todo commit no Foundry:

```bash
# 1. Validar framework completo
bash scripts/foundry-doctor.sh

# 2. Verificar que manifest.json é JSON válido
node -e "console.log(JSON.parse(require('fs').readFileSync('docs/foundry/manifest.json','utf8')).framework.version)"

# 3. Verificar que não há segredo no diff
git diff --staged | grep -iE "password|secret|api_key|token|cpf|cnpj"

# 4. Conferir o que vai ser commitado
git diff --staged --stat
```

## Arquivos Que NUNCA Vão para Git (Foundry)

```
.gitignore deve cobrir:
  settings.local.json        ← overrides pessoais de dev
  .env, .env.local           ← variáveis de ambiente
  docs/foundry/bypass-log/     ← logs de bypass são locais
  *.pyc, __pycache__/        ← build Python do reviewer
  node_modules/              ← dependências
```

**Arquivos que SÃO commitados no Foundry:**
- `docs/foundry/manifest.json` — inventory versionado
- `docs/foundry/decisions.md` — registro de decisões
- `docs/foundry/session-gate-reports/` — audits datados
- `hooks/*.sh` — scripts de hook são parte do framework
- `.claude/settings.json` — configuração canônica do framework

## Usando Git para Depuração no Foundry

```bash
# Descobrir qual commit introduziu uma violação de foundry-doctor
git bisect start
git bisect bad HEAD
git bisect good <sha-quando-passava>
git bisect run bash scripts/foundry-doctor.sh

# Ver o que mudou recentemente
git log --oneline -10
git diff HEAD~3..HEAD -- docs/foundry/manifest.json

# Encontrar quem adicionou um hash desatualizado
git blame docs/foundry/manifest.json | grep "sha256"

# Buscar commits relacionados a uma decisão
git log --grep="F50" --oneline
```

## Racionalizações Comuns

| Racionalização | Realidade |
|---|---|
| "Vou commitar quando a onda estiver completa" | Um commit gigante é impossível de revisar, depurar ou reverter. Commite cada task. |
| "A mensagem de commit não importa" | Mensagens são documentação. Você (e agentes futuros) precisarão entender o que e por que mudou. |
| "Não preciso do foundry-doctor antes de commitar" | O foundry-doctor é o gate de qualidade do framework. Um commit com hash desatualizado cria dívida técnica invisível. |
| "Vou separar o refactor depois" | Refactoring misturado com feature é mais difícil de revisar, reverter e entender em histórico. Separe antes de submeter. |
| "Branches adicionam overhead" | Branches de vida curta são gratuitos e evitam conflitos de trabalho paralelo. Branches longos são o problema. |
| "Vou atualizar o CHANGELOG depois" | O CHANGELOG é parte do contrato do release. Sem ele, consumidores do framework não sabem o que mudou. |

## Red Flags

- Grandes mudanças não-commitadas acumulando
- Mensagens de commit como "fix", "update", "misc", "wip"
- Mudanças de formatação misturadas com mudanças de comportamento
- Commit sem foundry-doctor passando
- Badge de README divergindo da versão em manifest.json
- Bump de versão sem entrada em CHANGELOG.md
- Bump de MAJOR sem ADR em decisions.md
- Push para `master` sem branch + PR review (exceto patches urgentes documentados)

## Verificação

Para cada commit no Foundry:

- [ ] Commit faz uma coisa lógica
- [ ] Mensagem explica o *porquê*, segue o formato `type(scope): descrição`
- [ ] `bash scripts/foundry-doctor.sh` retorna 0 FAIL
- [ ] Nenhum segredo no diff (grep confirmado)
- [ ] Nenhuma mudança de formatação misturada com mudança de comportamento
- [ ] Para MINOR: CHANGELOG.md tem nova seção + README.md tem badge atualizado
- [ ] Para MINOR: manifest.json tem novos artefatos com sha256 corretos
- [ ] Para MAJOR: ADR em decisions.md + comunicação ao reviewer planejada
