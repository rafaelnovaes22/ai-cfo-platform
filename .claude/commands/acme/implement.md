---
description: Executa as tasks do tasks.md em ondas — orquestra @artifact-prompt-builder, cria estrutura de pastas no projeto consumidor, gera boilerplate com instrumentação C6 obrigatória e camada de abstração C7. NÃO faz deploy nem inicia SHADOW. Pausa em cada gate para validação humana opcional.
allowed-tools: [Read, Write, Edit, Glob, Grep, Bash]
arguments:
  required:
    - artifact_id
  optional:
    - client_id
    - from_wave
    - to_wave
    - dry_run
    - auto_continue
    - via_aios
forge_command_version: 0.1.0
linked_principles: [C5, C6, C7, C8]
invokes_skills:
  - "@artifact-prompt-builder"
  - "@eval-case-author"
  - "@offerings-loader"
output_artifact: src/skus/{artifact_id}/* + prompts/{artifact_id}/* + evals/{artifact_id}/*
trace_required: true
---

# /acme:implement — Execução guiada

## Modo de implementação

> Verificar antes de executar se o artefato usa AIOS como camada de implementação.

**Se `--via aios` for passado OU se spec tem `aios_tier` definido (não vazio):**

```
1. Verificar que kernel AIOS está rodando:
   curl -s --max-time 3 http://localhost:8000/health

2. Se kernel offline: instruir o usuário a iniciar com:
   bash .aios-kernel/runtime/launch_kernel.sh
   Então parar — não prosseguir sem kernel.

3. Verificar que agentes do módulo estão inicializados:
   aios/agents/{módulo}_spec_agent/ existe?
   → Se não: executar /acme:aios-init --module {módulo} primeiro.

4. Executar pipeline via AIOS:
   /acme:aios-run --module {módulo}
   (ou: python aios/orchestrator.py pipeline --module {módulo})

5. Aguardar aprovação humana em cada gate antes de prosseguir para próxima onda.
   Gates definidos em /acme:aios-run — não pular.
```

**Se `--via aios` NÃO for passado E spec NÃO tem `aios_tier`:**
- Comportamento original abaixo (Claude Code direto, 5 ondas padrão).

---

## Propósito

Executa o `tasks-{artifact_id}.md` em ondas, fazendo:

1. **Scaffolding** (Wave 1) — cria estrutura de pastas, TenantContext, abstração de modelo, telemetry wrapper
2. **Prompt build** (Wave 2) — invoca `@artifact-prompt-builder`, wires loader
3. **Eval seed** (Wave 3) — invoca `@eval-case-author` em loop até `c4_threshold_met: true`
4. **SHADOW prep** (Wave 4) — cria subscription `mode: shadow`, valida precondições (sem iniciar)
5. **Metrics** (Wave 5) — configura dashboards e alertas

**Não faz deploy, não inicia SHADOW, não promove modo.** Essas três ações ficam para `/acme:promote` com aprovação humana.

> Por design, esta command **pausa entre ondas** (a menos que `--auto_continue`) para validação humana. Tasks com gates verificáveis (lint, test, hash) são auto-validadas; tasks com gate subjetivo pausam.

## Pre-conditions

1. `docs/clients/{client_id}/tasks-{artifact_id}.md` existe com `dag_validation.cycles: 0`
2. `docs/clients/{client_id}/plan-{artifact_id}.md` referenciado no tasks resolve
3. `docs/specs/{artifact_id}.md` com `c2_validation: pass` e `c4_thresholds` declarados
4. Working tree limpo (sem mudanças não-commitadas) **OU** branch dedicada `forge/implement-{artifact_id}`
5. Tracing configurado

## Inputs

```yaml
artifact_id: <slug>
# opcionais
client_id: <slug>          # auto-detect via tasks
from_wave: 1               # default 1
to_wave: 5                 # default 5
dry_run: false             # se true, simula sem escrever
auto_continue: false       # se true, não pausa entre ondas
# via_aios: detectado automaticamente se spec tem aios_tier; ou passado como --via aios
```

## Execução

```
1. Trace start (escopo: full implementation, sub-traces por onda)

2. Validar pre-conditions; se branch dedicada não existir, sugerir:
   git checkout -b forge/implement-{artifact_id}

3. Para cada wave de from_wave até to_wave:
   3.1 Trace start (escopo: wave N)
   3.2 Para cada task na ordem topológica do DAG:
       - Resolver `depends_on` (todas devem estar `done`)
       - Executar skill/tool da task
       - Verificar gate de pronto (auto via lint/test/hash; manual com prompt humano se subjetivo)
       - Marcar task como `done` ou `failed` em tasks.md (in-place edit)
       - Se `failed`, abortar onda e sair com erro estruturado
   3.3 Trace end (wave summary)
   3.4 Se NOT auto_continue: pausar com sumário da onda e prompt "continuar?"

4. Trace end + output structured (consolidado)
```

## Boilerplate gerado por Wave 1

A command **gera arquivos mínimos viáveis**, não código de negócio completo. Tudo o que vai além desses templates é responsabilidade do dev:

### `src/llm/adapters/{provider}.ts` (boilerplate)

```ts
// AUTO-GERADO POR /acme:implement
// Esta é a ÚNICA camada onde imports do SDK do provider são permitidos (C7).
// Editar com cuidado — alterações aqui afetam todo SKU/produto que usa este adapter.

import { /* SDK do provider — único lugar permitido */ } from "<sdk>";

export interface LLMRequest {
  systemPrompt: string;
  userInput: string;
  metadata: { traceId: string; tenantId: string; promptHash: string };
}

export interface LLMResponse {
  output: string;
  costUsd: number;
  latencyMs: number;
  modelUsed: string;
}

export async function callLLM(req: LLMRequest): Promise<LLMResponse> {
  // TODO: implementar contra SDK do provider
  throw new Error("Adapter não implementado");
}
```

### `src/observability/trace.ts` (boilerplate)

```ts
// AUTO-GERADO POR /acme:implement
// Wrapper obrigatório (C6). Toda chamada LLM deve passar por trace.observe().

import { /* provider de telemetria, ex: langfuse */ } from "<provider>";

export interface TraceContext {
  traceId: string;
  tenantId: string;
  artifactId: string;
  promptHash: string;
  mode: "shadow" | "assisted" | "autonomous";
}

export async function observe<T>(
  ctx: TraceContext,
  event: "call_start" | "call_end" | "outcome_emitted" | "error_caught",
  payload: Record<string, unknown>,
  fn?: () => Promise<T>
): Promise<T | void> {
  // TODO: integrar com provider escolhido
  if (fn) return await fn();
}
```

### `src/tenants/context.ts` (boilerplate)

```ts
// AUTO-GERADO POR /acme:implement
// TenantContext (C8). Resolução de placeholders {{tenant.*}} em runtime.
// PROIBIDO: lógica condicional por nome de tenant em qualquer lugar do código.

export interface TenantContext {
  tenantId: string;
  name: string;       // display only
  tone?: string;
  escalationEmail?: string;
  customFields: Record<string, unknown>;
}

export function resolvePlaceholders(template: string, ctx: TenantContext): string {
  return template.replace(/\{\{tenant\.([\w.]+)\}\}/g, (_, path) => {
    // TODO: resolver path no ctx (suportar custom_fields nested)
    return "";
  });
}
```

### `src/skus/{artifact_id}/index.ts` (boilerplate)

```ts
// AUTO-GERADO POR /acme:implement — handler do artefato.

import { callLLM } from "../../llm/adapters/<provider>";
import { observe } from "../../observability/trace";
import { resolvePlaceholders, TenantContext } from "../../tenants/context";
import { loadPrompt } from "./prompt";

export async function handle{ArtifactName}(
  input: unknown,
  ctx: TenantContext
): Promise<{ outcome: string; category: string; confidence: number }> {
  const prompt = await loadPrompt("v0.1.0");
  const traceCtx = {
    traceId: crypto.randomUUID(),
    tenantId: ctx.tenantId,
    artifactId: "{artifact_id}",
    promptHash: prompt.hash,
    mode: "shadow" as const, // bootstrap
  };

  return observe(traceCtx, "call_start", { input }, async () => {
    const systemPrompt = resolvePlaceholders(prompt.systemMd, ctx);
    const resp = await callLLM({
      systemPrompt,
      userInput: JSON.stringify(input),
      metadata: traceCtx,
    });
    // TODO: validar resp.output contra schema da spec; classificar outcome
    return { outcome: resp.output, category: "unknown", confidence: 0 };
  });
}
```

### `src/skus/{artifact_id}/prompt.ts` (boilerplate)

```ts
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

export async function loadPrompt(version: string) {
  const path = `prompts/{artifact_id}/v${version}/system.md`;
  const systemMd = await readFile(path, "utf8");
  const hash = createHash("sha256").update(systemMd).digest("hex").slice(0, 16);
  return { systemMd, hash, version };
}
```

> Boilerplates acima são **stubs**. `callLLM`, `observe` e `resolvePlaceholders` lançam/retornam vazio — dev integra contra SDK e provider escolhidos. Esta command **não escolhe**.

## Output structured

```yaml
command: /acme:implement
status: ok | partial | error
artifact_id: <>
client_id: <>
waves_executed: [1, 2, 3]   # se interrompido
waves_skipped: [4, 5]
tasks_status:
  total: <N>
  done: <N>
  failed: <N>
  pending: <N>
files_created:
  - src/skus/<>/index.ts
  - src/skus/<>/prompt.ts
  - src/llm/adapters/<>.ts
  - src/observability/trace.ts
  - src/tenants/context.ts
  - prompts/<>/v0.1.0/system.md
  - evals/<>/cases/case-billing-001.md
  - ... (truncado se >50)
files_count: <N>
prompt_hash: <sha256:16>
recalc_unit_economics_required: true
trace_id: <>
generated_at: 2026-04-30T...
next_step: "/acme:eval --artifact_id=<>" | "/acme:promote --artifact_id=<>"
```

## Verification gate

- [x] Tasks executadas em ordem topológica do DAG (não pular dependências)
- [x] Cada task com gate de pronto verificado (auto ou manual)
- [x] Imports do SDK do provider apenas em `src/llm/adapters/` (lint regex enforce)
- [x] Nenhum `if (tenantId === '...')` ou `switch (tenantName)` em código gerado (C8 enforce)
- [x] Toda chamada a `callLLM` envelopada em `observe()` (C6 enforce)
- [x] `prompt_hash` registrado e idêntico ao output de `@artifact-prompt-builder`
- [x] Eval suite de Wave 3 com `c4_threshold_met: true` para todas as categorias
- [x] Subscription criada em Wave 4 com `mode: shadow`, `delivered: false`, `billing: 0`
- [x] **NÃO** iniciou SHADOW (`@shadow-mode-runner.start` NUNCA chamado por esta command)
- [x] Trace_id por wave + trace consolidado da execução completa

## Tabela anti-rationalization

| Tentação | Por que é errado | Resposta correta |
|---|---|---|
| "Vou iniciar SHADOW direto pra ganhar tempo" | Quebra ownership; SHADOW start é decisão de promotion-officer com aprovação humana | `/acme:implement` para em Wave 4 prep; `start` é responsabilidade de `/acme:promote` |
| "Boilerplate completo com lógica de negócio inferida" | Inferência sem domínio = bugs sutis em produção | Stubs com `TODO` explícito; dev preenche com conhecimento de domínio |
| "Provider escolhido pra acelerar (Anthropic SDK direto)" | Quebra C7 — provider é decisão do consumidor | Adapter declarado mas com `throw new Error('não implementado')`; dev escolhe |
| "Resolver placeholder simplificado: split + replace" | `tenant.custom_fields.nested.value` precisa resolução recursiva | Boilerplate com `// TODO: nested resolution`; dev implementa conforme schema |
| "Eval seed com 5 cases, gera os outros depois" | Quebra C4 hard gate antes de SHADOW | Wave 3 loopa até ≥30 por categoria; falha senão |
| "Auto-continuar entre todas as ondas, mais rápido" | Pula validação humana em gates subjetivos | `auto_continue: false` default; `true` só com flag explícita do dev |
| "Edit no master direto, branch é overhead" | Implement gera 10+ arquivos; revert difícil sem branch | Pre-condition exige working tree limpo OU branch `forge/implement-*` |
| "Skip recalc_unit_economics_required, é só warning" | C3 desatualizada vira drift silencioso | Output sempre `recalc_unit_economics_required: true`; flag visível no próximo `/acme:promote` |

## Saída de erro estruturada

```yaml
command: /acme:implement
status: error
error: <enum>
wave_failed: <N>
task_failed: <id>
hint: <ação>
trace_id: <>
```

`error` ∈ `pre_conditions_failed` | `working_tree_dirty` | `dag_traversal_blocked_unresolved` | `task_gate_failed` | `prompt_builder_failed` | `eval_threshold_not_reached` | `c8_violation_detected` (lint regex de tenant hardcode) | `c6_violation_detected` (chamada LLM sem trace) | `c7_violation_detected` (SDK fora de adapters) | `subscription_creation_failed` | `shadow_start_attempted` (skill tentou iniciar — bloqueio).

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-04-30 | Versão inicial — Forge-2 onda 2 (implementation) |
| 0.2.0 | 2026-05-06 | Forge-6: suporte a `--via aios` + detecção automática de `spec.aios_tier` |
