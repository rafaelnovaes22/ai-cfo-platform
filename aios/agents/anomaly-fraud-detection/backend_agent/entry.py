"""
Backend Agent — implementa API + service layer de UM módulo.

Gerado a partir de templates/aios/agents/backend_agent/entry.py.template (Forge v0.6.0+).
Stack lida de aios/config.yaml → stack.backend (sem hardcode de framework).

C5/C6/C7/C8 — ver cabeçalho do spec_agent.

Substituições aplicadas pelo /acme:aios-init:
  aicfo, anomaly-fraud-detection, B
"""

import os
from pathlib import Path

import yaml
from cerebrum import BaseAgent

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
    id = "local-dev-no-trace"
    def generation(self, **_): return self
    def end(self, **_): pass
    def update(self, **_): pass


PROJECT_ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = PROJECT_ROOT / "aios" / "config.yaml"


def _load_project_config() -> dict:
    if CONFIG_PATH.exists():
        with CONFIG_PATH.open("r", encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}
    return {}


_CONFIG = _load_project_config()
_PROJECT_NAME = _CONFIG.get("project", {}).get("name", "aicfo")
_STACK_BACKEND = _CONFIG.get("stack", {}).get("backend", "(stack.backend não declarado em aios/config.yaml — preencher antes de rodar)")
_TENANT_FIELD = _CONFIG.get("project", {}).get("tenant_field", "tenantId")


SYSTEM_PROMPT = f"""Você é o Backend Agent do projeto {_PROJECT_NAME}.

Responsabilidade única: implementar API routes e service layer de UM módulo.

Stack obrigatória (declarada em aios/config.yaml → stack.backend):
{_STACK_BACKEND}

LEIA APENAS:
- docs/specs/{{module}}.md (spec aprovada do módulo)
- aios/config.yaml (apenas project.* e stack.*)
- O bloco "task" enviado pelo orquestrador

NÃO LEIA (isolamento de contexto C5):
- Specs de outros módulos
- Código de implementação de outros módulos
- Dados de tenants reais

Regras gerais de implementação:
- Multi-tenancy: toda query deve respeitar o campo `{_TENANT_FIELD}` quando aplicável
- Validação de input em toda rota pública
- Padrão de resposta consistente: {{ data: T, error: null }} | {{ data: null, error: string }}
- Sem hardcode de tenant, cliente ou unidade — receba via parâmetro/header

Estrutura de output (adaptada à stack declarada acima):
- API endpoints do módulo: GET (lista + detail), POST, PUT, DELETE conforme spec
- Service layer com regras de negócio (não no controller/route handler)
- Validação centralizada (schema validator da stack — Zod, Pydantic, ActiveModel, etc.)

Para módulos Tier C (financeiro, cancelamento, integrações críticas):
- Adicione comentários de revisão obrigatória nos pontos de lógica crítica
- Nunca implemente cálculo de multa, juros ou cancelamento sem validação explícita na spec

C7: este prompt funciona standalone em Claude Code sem o kernel AIOS.
C8: tenantId em task_input, nunca hardcoded.
"""


class BackendAgent(BaseAgent):
    agent_name = "anomaly-fraud-detection_backend_agent"

    def __init__(self, agent_name: str | None = None):
        super().__init__(agent_name or self.agent_name)
        self.messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    def _load_context(self, module_name: str) -> dict:
        spec_path = PROJECT_ROOT / "docs" / "specs" / f"{module_name}.md"
        schema_path = PROJECT_ROOT / "docs" / "specs" / "_schema_proposal.md"
        return {
            "spec": spec_path.read_text(encoding="utf-8") if spec_path.exists() else None,
            "schema": schema_path.read_text(encoding="utf-8") if schema_path.exists() else None,
        }

    def run(self, task_input: dict) -> dict:
        module_name = task_input.get("module")
        if not module_name:
            return {"error": "campo 'module' é obrigatório"}

        ctx = self._load_context(module_name)
        if not ctx["spec"]:
            return {"error": f"spec não encontrada: docs/specs/{module_name}.md — rode o Spec Agent primeiro"}

        trace = langfuse.trace(
            name=f"{self.agent_name}-{module_name}",
            metadata={
                "agent": self.agent_name,
                "project": _PROJECT_NAME,
                "module": module_name,
                "tier": task_input.get("tier", "B"),
                "tenant_id": task_input.get("tenant_id"),
                "stack": _STACK_BACKEND,
                "aios_version": "0.2.2",
            },
        ) if _LF_AVAILABLE else _MockTrace()

        self.messages.append({
            "role": "user",
            "content": (
                f"Implemente o backend do módulo: **{module_name}**\n\n"
                f"Spec do módulo:\n{ctx['spec']}\n\n"
                f"Schema (proposto, opcional):\n{ctx['schema'] or '(ainda não gerado — use tipos genéricos com TODO de schema)'}\n\n"
                f"Use a stack declarada em aios/config.yaml: {_STACK_BACKEND}.\n"
                "Gere o código completo seguindo o padrão definido no system prompt."
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

        output_path = PROJECT_ROOT / "docs" / "specs" / f"_backend_{module_name}.md"
        output_path.write_text(response, encoding="utf-8")

        return {
            "module": module_name,
            "output_path": str(output_path),
            "trace_id": trace.id,
            "status": "backend_generated",
            "note": "Revise e mova para src/ após aprovação humana (C4).",
        }
