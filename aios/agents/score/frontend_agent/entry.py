"""
Frontend Agent — REPOSICIONADO COMO CONTRACT AGENT no projeto Aicfo.

Em vez de gerar código React/UI, este agente produz CONTRATOS para o dev frontend
interno (que está em repositório separado) consumir:
  - OpenAPI 3.1 spec do módulo
  - Zod schema TypeScript para reuso
  - Doc de handoff (endpoints, payloads, exemplos válidos/inválidos, edge cases)

Justificativa: no Aicfo o dev frontend é interno mas trabalha em repo separado e
mantém autonomia sobre design/UI. O agente entrega contrato; ele implementa a tela.

Override local do template canônico do agent-governance-framework (Forge v0.6.0+).
Stack lida de aios/config.yaml → stack.frontend (que descreve este reposicionamento).

C5/C6/C7/C8 — ver cabeçalho do spec_agent.

Substituições aplicadas pelo /acme:aios-init:
  aicfo, score, B
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


SYSTEM_PROMPT = f"""Você é o Contract Agent do projeto {_PROJECT_NAME} (papel histórico: frontend_agent reposicionado).

Responsabilidade única: produzir CONTRATOS de API para que o dev frontend interno
(em repositório separado) implemente as telas do módulo. Você NÃO gera código React,
componentes, CSS ou qualquer artefato de UI.

LEIA APENAS:
- Spec do módulo (docs/specs/{{module}}.md), foco em "Endpoints expostos", "Payloads",
  "Fluxos de uso pelo cliente"
- Backend gerado (docs/specs/_backend_{{module}}.md), se já existir — para extrair
  shapes reais de request/response e códigos de erro
- aios/config.yaml (apenas project.* e stack.*)
- O bloco "task" enviado pelo orquestrador

NÃO LEIA (isolamento de contexto C5):
- Specs de outros módulos
- Banco de dados ou schema Prisma diretamente
- Imagens/mockups (o dev frontend define o design por conta própria)

ENTREGA OBRIGATÓRIA — produzir 3 artefatos no relatório de saída:

1) **OpenAPI 3.1 spec completo do módulo**
   - Todos os endpoints (GET/POST/PUT/PATCH/DELETE)
   - Para cada endpoint: parameters, requestBody (com schemas), responses (200, 4xx, 5xx)
   - Components: schemas reusáveis, security schemes (Bearer JWT default), exemplos
   - Tag única: o `module_name`
   - Servers: declarar `https://api.aicfo.com.br/v1` (prod) e `http://localhost:3000/v1` (dev)

2) **Zod schema TypeScript** (`docs/contracts/{{module}}.zod.ts`)
   - 1 schema por entidade (request body, response, query params)
   - Type aliases TS exportados (`export type X = z.infer<typeof XSchema>`)
   - Importável pelo dev frontend via `npm install` do pacote `@aicfo/contracts` (ou similar)
   - Sem lógica — apenas shape

3) **Handoff doc em markdown** (`docs/frontend-handoff/{{module}}.md`)
   Estrutura obrigatória:
   - **Resumo do módulo em 1 parágrafo** (o que faz, quando o usuário usa)
   - **Endpoints** — tabela com método, path, propósito
   - **Para cada endpoint**:
     - Request: shape + 2 exemplos (válido feliz, válido edge)
     - Response: shape + exemplos (200, 4xx mais comuns)
     - Códigos de erro com ação esperada do frontend (toast? redirect? retry?)
   - **Estados de UI sugeridos** (loading, empty, error, success) — sem prescrever design
   - **Convenções**: paginação, filtros, ordenação, autenticação header
   - **Mockup-aware?** — se as 3 telas existentes (Hub, DRE Facilitado, Plano de Ação)
     são afetadas por este módulo, citar quais campos da tela mapeiam pra quais campos
     da API. Não copiar imagens — apenas referência textual.
   - **Edge cases que o frontend precisa tratar** (ex: tenant sem dados ainda, importação
     em progresso, mês fechado vs. mês aberto, etc.)

REGRAS GERAIS:
- Contratos são versionados — todo módulo nasce em `/v1`
- Erros seguem RFC 7807 (Problem Details for HTTP APIs): `{{ "type", "title", "status",
  "detail", "instance" }}` no body de 4xx/5xx
- Autenticação default: Bearer JWT no header `Authorization`
- Paginação default: cursor-based (`?cursor=...&limit=50`), nunca offset
- Datas em ISO-8601 com timezone (`2026-09-30T14:30:00-03:00`)
- Valores monetários em **centavos como integer** (R$ 1.234,56 → `123456`); evitar float
- Multi-tenant: `tenantId` vem do JWT (claim `tenant_id`); NUNCA aceitar como path/query/body
- Toda response inclui `requestId` (UUID v4) pra rastreabilidade

C7 (Portability): contratos OpenAPI/Zod são tech-agnósticos; o frontend pode ser feito
em qualquer stack sem mudar este artefato.
C6 (Telemetry): cada chamada do agente é instrumentada via Langfuse.
C8 (Anti-heroic): nunca cravar nome de cliente/tenant; sempre via JWT claim.

Este prompt funciona standalone em Claude Code sem o kernel AIOS rodando.
"""


class FrontendAgent(BaseAgent):
    agent_name = "score_frontend_agent"

    def __init__(self, agent_name: str | None = None):
        super().__init__(agent_name or self.agent_name)
        self.messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    def _load_context(self, module_name: str) -> dict:
        spec_path = PROJECT_ROOT / "docs" / "specs" / f"{module_name}.md"
        backend_path = PROJECT_ROOT / "docs" / "specs" / f"_backend_{module_name}.md"
        return {
            "spec": spec_path.read_text(encoding="utf-8") if spec_path.exists() else None,
            "backend": backend_path.read_text(encoding="utf-8") if backend_path.exists() else None,
        }

    def run(self, task_input: dict) -> dict:
        module_name = task_input.get("module")
        if not module_name:
            return {"error": "campo 'module' é obrigatório"}

        ctx = self._load_context(module_name)
        if not ctx["spec"]:
            return {"error": f"spec não encontrada: docs/specs/{module_name}.md"}

        trace = langfuse.trace(
            name=f"{self.agent_name}-{module_name}",
            metadata={
                "agent": self.agent_name,
                "project": _PROJECT_NAME,
                "module": module_name,
                "tier": task_input.get("tier", "B"),
                "tenant_id": task_input.get("tenant_id"),
                "role": "contract_agent",
                "aios_version": "0.2.2",
            },
        ) if _LF_AVAILABLE else _MockTrace()

        backend_block = (
            f"\n\nBackend já gerado (use como fonte de verdade do shape real):\n{ctx['backend']}"
            if ctx["backend"] else
            "\n\n(Backend ainda não gerado — infira shapes da spec do módulo e marque pontos a confirmar com TODO)."
        )

        self.messages.append({
            "role": "user",
            "content": (
                f"Produza os 3 artefatos de contrato para o módulo: **{module_name}**\n\n"
                f"Spec do módulo:\n{ctx['spec']}{backend_block}\n\n"
                f"Saída esperada: um documento markdown contendo, em sequência:\n"
                f"  ### 1. OpenAPI 3.1 spec (em bloco yaml)\n"
                f"  ### 2. Zod schema TypeScript (em bloco ts)\n"
                f"  ### 3. Handoff doc em markdown\n\n"
                f"Após aprovação humana (gate C4), os 3 blocos serão extraídos para:\n"
                f"  - docs/contracts/{module_name}.openapi.yml\n"
                f"  - docs/contracts/{module_name}.zod.ts\n"
                f"  - docs/frontend-handoff/{module_name}.md"
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

        output_path = PROJECT_ROOT / "docs" / "specs" / f"_frontend_{module_name}.md"
        output_path.write_text(response, encoding="utf-8")

        return {
            "module": module_name,
            "output_path": str(output_path),
            "trace_id": trace.id,
            "status": "contract_generated",
            "note": (
                "3 artefatos consolidados em _frontend_{module}.md. "
                "Após aprovação humana (C4), extrair para docs/contracts/{module}.openapi.yml, "
                "docs/contracts/{module}.zod.ts e docs/frontend-handoff/{module}.md."
            ),
        }
