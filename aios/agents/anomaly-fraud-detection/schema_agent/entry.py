"""
Schema Agent — propõe schema de banco para o projeto consumidor.

Gerado a partir de templates/aios/agents/schema_agent/entry.py.template (Forge v0.6.0+).

DIFERENÇA-CHAVE vs. agentes anteriores: este é COMPARTILHADO entre módulos
(não específico) e **agnóstico de stack** — ele lê aios/config.yaml → stack.database
e sugere o schema na stack declarada. Se stack.database não estiver declarada,
ele PROPÕE 1-3 stacks viáveis com tradeoffs e pede decisão humana antes de gerar
o schema definitivo.

C5/C6/C7/C8 — ver cabeçalho do spec_agent.
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
_STACK_DB = _CONFIG.get("stack", {}).get("database", "")
_TENANT_FIELD = _CONFIG.get("project", {}).get("tenant_field", "tenantId")


def _build_system_prompt() -> str:
    """SYSTEM_PROMPT muda conforme stack já decidida ou não."""
    if _STACK_DB.strip():
        # Stack já decidida → gerar schema diretamente
        stack_block = f"""Stack do banco DECIDIDA pelo projeto consumidor (aios/config.yaml → stack.database):
{_STACK_DB}

Sua tarefa: gerar o schema completo NA STACK ACIMA. Use a sintaxe correta da stack
(Prisma DSL, SQL DDL, SQLAlchemy ORM, Mongoose, Drizzle, etc. conforme declarado)."""
        mode = "GERAR_SCHEMA"
    else:
        # Stack não decidida → propor opções com tradeoffs
        stack_block = """Stack do banco AINDA NÃO DECIDIDA (aios/config.yaml → stack.database está vazio).

Sua tarefa: propor 1 a 3 stacks viáveis para o projeto, considerando:
- Volume estimado e padrão de leitura/escrita das specs
- Multi-tenancy obrigatório
- Necessidade de relações complexas vs. dados denormalizados
- Skill set provável do time consumidor

Para cada opção proposta, declare:
- Nome (ex: "PostgreSQL 16 via Prisma")
- Quando faz sentido / quando NÃO faz
- Custo de operação aproximado (managed vs self-hosted)
- Esforço de migração futura
- Recomendação final do agente

NÃO gere schema definitivo — peça a decisão humana antes."""
        mode = "PROPOR_STACK"

    return f"""Você é o Schema Agent do projeto {_PROJECT_NAME}.

MODO: {mode}

Responsabilidade única: projetar o schema do banco baseado nas specs aprovadas.

{stack_block}

LEIA APENAS:
- Todas as specs aprovadas em docs/specs/*.md (ignore arquivos prefixados com _)
- aios/config.yaml (apenas project.* e stack.*)

NÃO LEIA (isolamento de contexto C5):
- Código de implementação em src/
- Dados de tenants reais
- Specs de outros projetos

Regras CRÍTICAS independente da stack:
- Multi-tenancy obrigatório: toda entidade que carrega dados de tenant deve ter o
  campo `{_TENANT_FIELD}` (ou equivalente da stack escolhida)
- Sem hardcode de tenant — campo genérico, valor injetado em runtime
- Relações explícitas com política de cascata definida (onDelete equivalente)
- Índices em campos usados em filtros frequentes (status, {_TENANT_FIELD}, createdAt)
- Campos justificados na spec — sem campos especulativos

Output esperado:
- Schema completo na sintaxe da stack (modo GERAR_SCHEMA) OU
- Comparação de 1-3 stacks com recomendação (modo PROPOR_STACK)
- Lista de decisões de design com justificativa
- Campos que o operador humano DEVE revisar obrigatoriamente antes de aplicar
"""


class SchemaAgent(BaseAgent):
    agent_name = "schema_agent"  # COMPARTILHADO — sem prefixo de módulo

    def __init__(self, agent_name: str | None = None):
        super().__init__(agent_name or self.agent_name)
        self.messages = [{"role": "system", "content": _build_system_prompt()}]

    def _load_all_specs(self) -> str:
        specs_dir = PROJECT_ROOT / "docs" / "specs"
        if not specs_dir.exists():
            return "(nenhuma spec encontrada — rode o Spec Agent para os módulos primeiro)"
        specs = []
        for spec_file in sorted(specs_dir.glob("*.md")):
            # ignora arquivos auxiliares prefixados com _
            if spec_file.name.startswith("_"):
                continue
            specs.append(f"### {spec_file.stem}\n{spec_file.read_text(encoding='utf-8')}")
        return "\n\n---\n\n".join(specs) if specs else "(nenhuma spec aprovada ainda)"

    def run(self, task_input: dict) -> dict:
        all_specs = self._load_all_specs()
        mode = "GERAR_SCHEMA" if _STACK_DB.strip() else "PROPOR_STACK"

        trace = langfuse.trace(
            name=f"{self.agent_name}-{mode}",
            metadata={
                "agent": self.agent_name,
                "project": _PROJECT_NAME,
                "mode": mode,
                "stack_db_configured": bool(_STACK_DB.strip()),
                "stack_db": _STACK_DB or None,
                "aios_version": "0.2.2",
            },
        ) if _LF_AVAILABLE else _MockTrace()

        if mode == "GERAR_SCHEMA":
            user_msg = (
                f"Com base nas specs abaixo, gere o schema completo na stack declarada ({_STACK_DB}).\n\n"
                f"Specs aprovadas:\n{all_specs}\n\n"
                f"Requisitos:\n"
                f"- Multi-tenancy via {_TENANT_FIELD} em todas as entidades aplicáveis\n"
                f"- Inclua todas as configurações da stack (datasource/conexão, generators, enums)\n"
                f"- Liste ao final as decisões de design que precisam de aprovação humana"
            )
            output_filename = "_schema_proposal.md"
        else:
            user_msg = (
                f"O projeto {_PROJECT_NAME} ainda não declarou stack.database em aios/config.yaml.\n\n"
                f"Com base nas specs abaixo, proponha 1 a 3 stacks viáveis com tradeoffs e recomendação final.\n"
                f"NÃO gere schema definitivo — apenas proposta + recomendação para decisão humana.\n\n"
                f"Specs aprovadas:\n{all_specs}"
            )
            output_filename = "_schema_stack_proposal.md"

        self.messages.append({"role": "user", "content": user_msg})

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

        output_path = PROJECT_ROOT / "docs" / "specs" / output_filename
        output_path.write_text(response, encoding="utf-8")

        return {
            "output_path": str(output_path),
            "mode": mode,
            "trace_id": trace.id,
            "status": "schema_proposed" if mode == "GERAR_SCHEMA" else "stack_proposal_generated",
            "note": (
                "Operador humano deve revisar antes de aplicar."
                if mode == "GERAR_SCHEMA"
                else "Decida a stack, atualize aios/config.yaml → stack.database e rode o Schema Agent novamente."
            ),
        }
