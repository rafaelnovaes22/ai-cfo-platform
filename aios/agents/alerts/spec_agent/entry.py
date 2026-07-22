"""
Spec Agent — converte descrição de módulo em spec executável.

Gerado a partir de templates/aios/agents/spec_agent/entry.py.template (Foundry v0.6.0+).

C5 (three-tier): isolamento de contexto declarado em LEIA APENAS / NÃO LEIA.
C6 (telemetry):  send_request envolto em langfuse.trace() → generation.end().
C7 (portability): este SYSTEM_PROMPT funciona standalone em Claude Code (sem kernel AIOS).
C8 (anti-heroic): tenantId em task_input, nunca hardcoded; project_name lido de config.

Substituições aplicadas pelo /novais-digital:aios-init:
  aicfo   → nome do projeto consumidor
  alerts         → nome do módulo (kebab-case)
  B           → A | B | C
"""

import os
from pathlib import Path

import yaml
from cerebrum import BaseAgent

# --- Telemetria C6 -----------------------------------------------------------
try:
    from langfuse import Langfuse
    _LF_AVAILABLE = bool(os.environ.get("LANGFUSE_PUBLIC_KEY"))
    if _LF_AVAILABLE:
        langfuse = Langfuse(
            public_key=os.environ["LANGFUSE_PUBLIC_KEY"],
            secret_key=os.environ.get("LANGFUSE_SECRET_KEY", ""),
            host=os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com"),
        )
    else:
        langfuse = None
except Exception:
    _LF_AVAILABLE = False
    langfuse = None


class _MockTrace:
    """Fallback dev local sem Langfuse — proibido em produção."""
    id = "local-dev-no-trace"
    def generation(self, **_): return self
    def end(self, **_): pass
    def update(self, **_): pass


# --- Configuração lida do projeto (C8) --------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = PROJECT_ROOT / "aios" / "config.yaml"


def _load_project_config() -> dict:
    if CONFIG_PATH.exists():
        with CONFIG_PATH.open("r", encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}
    return {}


_CONFIG = _load_project_config()
_PROJECT_NAME = _CONFIG.get("project", {}).get("name", "aicfo")


# --- SYSTEM_PROMPT (C7: funciona standalone) --------------------------------
SYSTEM_PROMPT = f"""Você é o Spec Agent do projeto {_PROJECT_NAME}.

Responsabilidade única: converter a descrição de um módulo em spec executável
para os agentes de código (backend, frontend, schema, test, review).

LEIA APENAS:
- docs/specs/{{module}}.md (se existir — pode estar em rascunho)
- O bloco "task" enviado pelo orquestrador
- aios/config.yaml (apenas os campos project.* e stack.* — NÃO leia outros campos)

NÃO LEIA (isolamento de contexto C5):
- Specs de outros módulos
- Código de implementação em src/
- Dados ou exemplos de tenants reais
- Specs de outros clientes/projetos

Estrutura obrigatória da spec gerada:

## Entidades
  - Nome, campos, tipos, constraints, relações

## Regras de negócio
  - Cada regra com exemplo positivo e negativo

## Edge cases críticos
  - Especialmente em cenários financeiros, cancelamento, transferências, integrações externas

## Fluxos de tela
  - Sequência de passos do usuário para cada ação principal

## Critério de pronto
  - O que precisa funcionar para o módulo ser aceito

C8: tenantId vem em task_input["tenant_id"]; nunca o hardcode aqui.
C7: este prompt funciona como prompt standalone em Claude Code sem o kernel AIOS.
"""


class SpecAgent(BaseAgent):
    agent_name = "alerts_spec_agent"

    def __init__(self, agent_name: str | None = None):
        super().__init__(agent_name or self.agent_name)
        self.messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    def _load_context(self, module_name: str) -> str:
        """Lê apenas a spec atual do módulo (se houver) — não vaza para outros módulos."""
        spec_path = PROJECT_ROOT / "docs" / "specs" / f"{module_name}.md"
        if spec_path.exists():
            return spec_path.read_text(encoding="utf-8")
        return "(spec ainda não existe — gere a partir do zero baseado na descrição da task)"

    def run(self, task_input: dict) -> dict:
        module_name = task_input.get("module")
        if not module_name:
            return {"error": "campo 'module' é obrigatório"}

        # --- Telemetria C6 (abre trace) -----------------------------------
        trace = langfuse.trace(
            name=f"{self.agent_name}-{module_name}",
            metadata={
                "agent": self.agent_name,
                "project": _PROJECT_NAME,
                "module": module_name,
                "tier": task_input.get("tier", "B"),
                "tenant_id": task_input.get("tenant_id"),
                "aios_version": "0.2.2",
            },
        ) if _LF_AVAILABLE else _MockTrace()

        context = self._load_context(module_name)
        self.messages.append({
            "role": "user",
            "content": (
                f"Gere a spec completa para o módulo: **{module_name}**\n\n"
                f"Spec atual (pode estar vazia):\n{context}\n\n"
                f"Salve o resultado em: docs/specs/{module_name}.md"
            ),
        })

        generation = trace.generation(
            name="send_request",
            model="claude-sonnet-4-6",
            input=self.messages,
        )

        response = self.send_request(
            agent_name=self.agent_name,
            messages=self.messages,
            base_url=f"http://localhost:{_CONFIG.get('server', {}).get('port', 8000)}",
            model=_CONFIG.get("llm", {}).get("model", "claude-sonnet-4-6"),
        )

        generation.end(output=response)
        trace.update(status_message="completed")

        spec_path = PROJECT_ROOT / "docs" / "specs" / f"{module_name}.md"
        spec_path.parent.mkdir(parents=True, exist_ok=True)
        spec_path.write_text(response, encoding="utf-8")

        return {
            "module": module_name,
            "spec_path": str(spec_path),
            "trace_id": trace.id,
            "status": "spec_generated",
            "chars": len(response),
        }
