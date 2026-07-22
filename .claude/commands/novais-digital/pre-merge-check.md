---
description: Consolida 5 gates de qualidade antes do merge — (G1) C7 imports SDK só em src/llm/adapters/, (G2) C8 sem hardcode por tenant, (G3) C6 toda chamada LLM com observe(), (G4) manifest sincronizado com artefatos do branch, (G5) eval suite verde para artefatos modificados. Saída go/no-go consumível por CI ou pre-commit hook. Read-only — não modifica nada.
allowed-tools: [Read, Glob, Grep, Bash]
arguments:
  optional:
    - base_ref
    - artifact_id
    - skip_eval
    - reviewer_format
foundry_command_version: 0.1.0
linked_principles: [C5, C6, C7, C8]
invokes_skills: []
output_artifact: null
trace_required: false
read_only: true
gate_count: 5
---

# /novais-digital:pre-merge-check — 5 gates de qualidade

## Propósito

**Last line of defense** antes do merge. Roda 5 verificações estruturais que detectam quebras de princípios C5-C8 + drift de manifest + regressão de eval. Read-only — não escreve, não invoca LLM, idealmente concluída em < 30 segundos.

Pode rodar:
- **Manualmente** pelo dev antes de pedir review
- **Em CI** como step obrigatório de PR
- **Em pre-commit hook** se Foundry-4 ativo (hook `pre-merge-check`)

> Esta command **não** roda eval suite por default (custa $$ e tempo). Apenas verifica que existe run recente verde para os artefatos tocados no branch. `--skip_eval=false` força execução.

## Pre-conditions

1. Working directory é repositório git
2. `base_ref` (default `master`) existe e é alcançável de HEAD
3. Manifest existe e parseia
4. Lint engine disponível (regex via grep/ripgrep — sem dependência de TS/Node)

## Inputs

```yaml
# todos opcionais
base_ref: master              # default; pode ser main, dev, etc.
artifact_id: <slug>           # se quiser focar em 1 artifact (default: detectar via diff)
skip_eval: false              # se true, G5 vira warning ao invés de fail
reviewer_format: false        # se true, output adicional consumível pelo reviewer DeepAgent
```

## Os 5 gates

### G1 — C7 (Portability)
**Regra**: imports do SDK do provider apenas em `src/llm/adapters/`.

```
Lint: grep -r "import .* from ['\"]@anthropic-ai/sdk['\"]\|import .* from ['\"]openai['\"]\|import .* from ['\"]@google-ai\b" src/ --include="*.ts" --include="*.js" \
  | grep -v "src/llm/adapters/"
```

Se output vazio → PASS. Senão → FAIL (lista violations).

### G2 — C8 (Anti-customização heroica)
**Regra**: nenhum hardcode por nome de tenant em código de produção.

```
Lint patterns proibidos em src/skus/, src/products/, src/skills/:
  - if (tenantId === '...')
  - if (tenant.name === '...')
  - switch (tenantName)
  - clients/{nome}/ ou tenants/{nome}/ como pasta
```

PASS se 0 matches. FAIL com lista de paths.

### G3 — C6 (Telemetry-by-default)
**Regra**: toda chamada `callLLM` envelopada em `observe()` (ou wrapper equivalente).

```
Lint: grep -r "callLLM\|llm\.call\|llmAdapter\.call" src/skus/ src/products/ \
   --include="*.ts" --include="*.js" -A 2 -B 2 \
   | grep -B 4 "callLLM" | grep -v "observe\|withTrace" | grep "callLLM"
```

PASS se vazio. FAIL com paths e linhas.

### G4 — Manifest sincronizado
**Regra**: artefatos novos/modificados/removidos no branch refletidos em `docs/foundry/manifest.json`.

```
1. git diff --name-only base_ref...HEAD → lista de arquivos
2. Filter por paths declarados no manifest (skills, commands, agents, hooks, templates, prompts)
3. Para cada arquivo modificado:
   - É novo? Está no manifest? Se não → FAIL
   - É deletado? Ainda está no manifest? Se sim → FAIL
   - Modificado? `sha256` no manifest está null OU desatualizado? warn (Foundry-4 hook fará sync)
```

PASS se entries esperadas presentes. FAIL com lista de discrepâncias.

### G5 — Eval suite verde para artefatos modificados
**Regra**: para todo `artifact_id` cujo `prompts/{id}/v*/system.md` foi tocado, há run recente em `evals/{id}/runs/` com `status: pass` e `prompt_hash` matching.

```
1. git diff base_ref...HEAD --name-only | grep '^prompts/' → lista de prompts mudados
2. Para cada prompt mudado:
   - Calcular prompt_hash atual
   - Buscar evals/{id}/runs/*-eval-{prompt_hash}.md mais recente
   - Se ausente OU > 7 dias → FAIL
   - Se status != pass → FAIL
```

Se `--skip_eval=true` → warning em vez de fail.

## Execução

```
1. (sem trace; command é read-only e barato)

2. Coletar diff: git diff --name-only $base_ref...HEAD

3. Detectar artifact_ids tocados (do diff)

4. Rodar 5 gates em paralelo onde possível:
   - G1, G2, G3: lint regex (rápido, < 5s cada)
   - G4: parse manifest + cruza com diff
   - G5: glob evals + check de hash

5. Agregar resultados; classificar como pass | fail | warn

6. Output structured (markdown ou JSON conforme reviewer_format)
```

## Output structured

```yaml
command: /novais-digital:pre-merge-check
status: pass | fail | warn
base_ref: master
diff_summary:
  total_files_changed: 12
  artifacts_touched: [triagem-tickets-tier1-v1]
  prompts_changed: [prompts/triagem-tickets-tier1-v1/v0.1.0/system.md]
gates:
  g1_c7_portability:
    status: pass
    violations: []
  g2_c8_anti_customization:
    status: pass
    violations: []
  g3_c6_telemetry:
    status: fail
    violations:
      - path: src/skus/triagem-tickets-tier1-v1/index.ts
        line: 42
        snippet: "const out = await callLLM({ ... })"
        reason: "Não envelopado em observe()"
  g4_manifest_sync:
    status: warn
    discrepancies:
      - { path: ".claude/skills/L1/new-skill.md", reason: "novo arquivo, ausente do manifest" }
  g5_eval_green:
    status: pass
    skipped_due_to_flag: false
    artifacts_with_pending_eval: []
gates_passed: 3
gates_failed: 1
gates_warning: 1
overall: fail
recommendations:
  - "G3: envolver chamada LLM em observe() (src/observability/trace.ts:observe)"
  - "G4: rodar manifest-sync (Foundry-4 hook futuro) ou atualizar manifest manualmente"
generated_at: 2026-04-30T...
elapsed_seconds: 4.8
exit_code: 1   # 0 se pass; 1 se fail; 2 se warn (configurável em CI)
```

## Verification gate (meta — desta própria command)

- [x] Todos os 5 gates rodaram (mesmo que algum não-aplicável → status `na`)
- [x] Tempo de execução < 30 segundos (sem `--skip_eval=false`); senão suspeitar de bug
- [x] Read-only confirmado: nenhum arquivo escrito
- [x] Exit code refletindo overall: 0 (pass) | 1 (fail) | 2 (warn-only)
- [x] Lista de paths/linhas em violations (não só contagem) — actionable

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Pular G5 sempre, eval é caro" | Sem G5, prompt drift entra em master sem validação | Default `skip_eval: false`; flag explícita necessária para warning |
| "G2 false positive em string com nome de cliente em comentário" | Comentários não rodam em runtime, mas viram drift documental | Lint detecta; resposta é remover o nome do comentário (CLAUDE.md proíbe) |
| "G4 warning é OK, manifest atualiza no merge" | Manifest desincronizado quebra reviewer DeepAgent na próxima auditoria | Warn aceito antes de Foundry-4 (hook `manifest-sync`); pós Foundry-4 vira fail |
| "G3 com `// eslint-disable` resolve" | Disable de lint = drift silencioso; reviewer depois penaliza | Bloqueio aqui; comentário disable não conta como passing |
| "Vou rodar só G1 hoje, resto amanhã" | Quebra invariante "5 gates atomicos"; reviewer vê PR já merged | All-or-nothing; subset só com `--skip_eval` declarado |
| "Modificar a command pra suprimir false positives específicos" | Drift de regra; cada exceção corrói C7/C8 | Falsos positivos viram issue no Foundry; regra ajustada via PR e ADR |
| "exit_code=0 sempre, falha não bloqueia merge" | Anula propósito da command em CI | Exit code reflete overall; CI deve `set -e` |

## Saída de erro estruturada

```yaml
command: /novais-digital:pre-merge-check
status: error
error: <enum>
hint: <ação>
```

`error` ∈ `not_in_git_repo` | `base_ref_unreachable` | `manifest_parse_failed` | `lint_engine_unavailable` | `evals_dir_unreadable`.

## Integração com hooks (Foundry-4)

Quando Foundry-4 entregar o hook `pre-merge-check`, esta command será invocada automaticamente em:
- `git pre-commit` (modo lite — só G1, G2, G3 — < 5s)
- `git pre-push` (modo full — todos os 5 gates)
- CI workflow `pre-merge.yml`

Bypass via `NOVAIS_FOUNDRY_BYPASS=incident` em `settings.local.json` deixa rastro em `docs/foundry/bypass-log/{date}.md`.

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Foundry-2 onda 3 (validation) |
