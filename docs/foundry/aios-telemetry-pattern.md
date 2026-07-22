# AIOS Agents — Padrão de Telemetria (C6)

> **Foundry-6** — Padrão oficial para projetos consumidores que adotam AIOS Server como camada de implementação.
> Vinculado a: C6 (Telemetry-by-default), C7 (Portability), C8 (Anti-heroic customization)

---

## Obrigação

Toda chamada `send_request()` em agente AIOS de produção deve ter trace Langfuse correspondente.
**Sem trace: chamada não conta como outcome auditável (C6).**

O `trace_id` deve ser propagado no retorno de `run()` para que o orquestrador possa correlacionar
steps de pipeline com traces individuais.

---

## Implementação padrão

```python
# Em cada entry.py de agente AIOS
import os
from langfuse import Langfuse

langfuse = Langfuse(
    public_key=os.environ.get("LANGFUSE_PUBLIC_KEY"),
    secret_key=os.environ.get("LANGFUSE_SECRET_KEY"),
    host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
)

def run(self, task_input: dict) -> dict:
    trace = langfuse.trace(
        name=f"{self.agent_name}-{task_input.get('module', 'unknown')}",
        metadata={
            "agent": self.agent_name,
            "module": task_input.get("module"),
            "tier": task_input.get("tier", "B"),
            "aios_version": "0.2.2",
        }
    )

    generation = trace.generation(
        name="send_request",
        model="claude-sonnet-4-6",
        input=self.messages,
    )

    response = self.send_request(
        agent_name=self.agent_name,
        messages=self.messages,
        base_url="http://localhost:8000",
        model="claude-sonnet-4-6"
    )

    generation.end(output=response)
    trace.update(status_message="completed")

    return {
        "module": task_input.get("module"),
        "trace_id": trace.id,
        "status": "generated",
        "chars": len(response),
    }
```

---

## Campos obrigatórios no trace

| Campo | Onde | Descrição |
|---|---|---|
| `name` | `trace.name` | `{agent_name}-{module}` — padrão rastreável |
| `agent` | `trace.metadata` | nome do agente (ex: `cadastros-spec-agent`) |
| `module` | `trace.metadata` | módulo processado (ex: `cadastros`) |
| `tier` | `trace.metadata` | A/B/C — para correlacionar com autonomia esperada |
| `aios_version` | `trace.metadata` | versão do kernel em uso |
| `trace_id` | retorno do `run()` | propagado ao orquestrador para correlação de pipeline |

---

## Verificação pelo hook `langfuse-trace-check`

O hook em `hooks/post-tool-use/langfuse-trace-check.sh` já detecta chamadas LLM sem trace em `src/agents/**`.
Para agentes AIOS, o hook deve também verificar que `trace_id` está presente no retorno do `run()`:

```bash
# Extensão do hook para AIOS (adicionar ao langfuse-trace-check.sh no projeto consumidor)
if grep -r "send_request" aios/agents/ | grep -v "trace.generation"; then
  echo "[WARN] send_request sem generation trace em agente AIOS"
fi
```

---

## Fallback sem Langfuse (desenvolvimento local)

Durante desenvolvimento local (sem `LANGFUSE_PUBLIC_KEY`), use o mock abaixo.
**Nunca commitar código que remove o trace em produção** — use o mock como fallback, não substituto.

```python
class _MockTrace:
    """Fallback local sem Langfuse — nunca usar em produção."""
    id = "local-dev-no-trace"
    def generation(self, **kwargs): return self
    def end(self, **kwargs): pass
    def update(self, **kwargs): pass

langfuse_available = bool(os.environ.get("LANGFUSE_PUBLIC_KEY"))
trace = langfuse.trace(
    name=f"{self.agent_name}-{task_input.get('module', 'unknown')}",
    metadata={...}
) if langfuse_available else _MockTrace()
```

O boilerplate gerado por `/novais-digital:aios-init` já inclui este mock — não é necessário adicionar manualmente.

---

## Aviso em `/novais-digital:aios-run`

O comando `/novais-digital:aios-run` exibe automaticamente no console:

```
[AIOS-RUN] Trace Langfuse: AVISO — LANGFUSE_PUBLIC_KEY não configurada
           Chamadas desta execução não serão auditáveis (C6).
           Configurar em .env: LANGFUSE_PUBLIC_KEY=pk-...
```

Este aviso é **não-bloqueante** em desenvolvimento mas **deve ser resolvido antes de SHADOW**.

---

## Integração com `/novais-digital:promote`

Antes de promover de SHADOW para ASSISTED, o gate de telemetria (C6) verifica:
- `trace_id` presente em ≥ 99% dos runs registrados
- `trace.metadata.module` preenchido em todos os traces de agentes AIOS
- Nenhum run com `trace_id = "local-dev-no-trace"` em ambiente de produção

---

## Mapeamento com a Constitution

| Princípio | Como este padrão aplica |
|---|---|
| C6 (Telemetry-by-default) | `send_request()` → `trace.generation()` → `generation.end()` em todo agente |
| C7 (Portability) | SYSTEM_PROMPTs funcionam standalone; trace via Langfuse é opcional em dev (mock) |
| C8 (Anti-heroic) | `tenantId` em `task_input`, nunca em `trace.name` ou SYSTEM_PROMPT hardcoded |

---

## Histórico

| Versão | Data | Mudança |
|---|---|---|
| 0.1.0 | 2026-05-06 | Versão inicial — Foundry-6 padrão de telemetria AIOS |
