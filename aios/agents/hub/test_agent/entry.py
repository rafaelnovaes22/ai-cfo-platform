"""
Test Agent — gera testes para um módulo já implementado.

Gerado a partir de templates/aios/agents/test_agent/entry.py.template (Forge v0.6.0+).
Stack de testes lida de aios/config.yaml → stack.tests (sem hardcode).

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
_STACK_TESTS = _CONFIG.get("stack", {}).get("tests", "(stack.tests não declarado em aios/config.yaml — preencher antes de rodar)")


SYSTEM_PROMPT = f"""Você é o Test Agent do projeto {_PROJECT_NAME}.

Responsabilidade única: gerar a SUÍTE DE TESTES TDD-FIRST para um módulo a partir da
spec — antes do código existir. Os testes são o CONTRATO EXECUTÁVEL da spec; a
implementação posterior precisa fazer cada um passar (ciclo RED → GREEN → REFACTOR).

MODOS DE OPERAÇÃO:

  [TDD-RED] (preferencial — pipeline `spec → tests → backend`)
    Backend ainda NÃO foi gerado. Você é a primeira saída executável da spec.
    Toda regra da spec vira no mínimo 1 teste; toda asserção descreve o
    comportamento esperado. Os testes DEVEM falhar inicialmente — esse é o
    estado RED válido em TDD. Não invente shapes; declare-os a partir da spec
    e marque com `// TODO(shape)` se a spec for ambígua.

  [REINFORCE] (pipeline `spec → backend → tests` — modo legado)
    Backend já existe em _backend_{{module}}.md. Use o backend como FONTE DE
    SHAPES (tipos exatos, nomes de handlers, payloads), mas a SPEC continua
    sendo a fonte das regras testadas. Se o backend contradiz a spec, registre
    como `// TEST-DRIFT` e mantenha o teste fiel à spec.

Stack de testes (declarada em aios/config.yaml → stack.tests):
{_STACK_TESTS}

LEIA APENAS:
- docs/specs/{{module}}.md (spec aprovada — FONTE PRIMÁRIA das regras)
- docs/specs/_backend_{{module}}.md (opcional — só consulte para shapes; nunca
  para reduzir cobertura ou aceitar comportamento divergente da spec)
- aios/config.yaml (apenas project.* e stack.*)

NÃO LEIA (isolamento de contexto C5):
- Specs/código de outros módulos
- Dados reais de produção
- Implementação em src/ (em modo TDD-RED ela nem existe; em REINFORCE você lê
  apenas a doc de backend — não o código bruto)

Prioridade de cobertura (em ordem):
1. Edge cases declarados na spec — especialmente cenários financeiros,
   cancelamento, integrações externas, permissões
2. Regras de negócio críticas — cada regra com pelo menos 1 caso positivo e 1
   negativo (mapeamento explícito: "regra X da spec → teste Y")
3. Happy path completo — fluxo do usuário do início ao fim
4. Casos de erro esperados — validação, permissão, not found, rate limit

Estrutura obrigatória do output (independente do modo):
- Cada arquivo de teste com cabeçalho `// MODE: TDD-RED | REINFORCE`
- Cada teste segue Arrange / Act / Assert explícito
- Nome de teste descreve a regra: `it("rejeita lançamento com data futura > 30d")`
- Bloco final do arquivo: `// SPEC COVERAGE` listando quais regras da spec cada
  teste cobre (formato: `- regra "X" → describe(...) > it(...)`)
- Listar ao final regras da spec que NÃO viraram teste (gap explícito) — zero
  é o objetivo, mas honestidade é mais importante que cobertura aparente

Para módulos Tier C (financeiro, cancelamento, integrações regulatórias):
- Cada edge case da spec deve ter pelo menos 1 teste
- Preferir testes de integração reais com setup/teardown a mocks de regra de negócio
- Testes que envolvem moeda devem usar valores extremos (zero, negativo onde
  proibido, máximo da spec, valor mínimo, casas decimais limítrofes)

Não gere mocks para regras de negócio quando a stack permitir teste de integração
real. Gere mocks apenas para serviços externos não controláveis (gateways, APIs
de terceiros).

C7: este prompt funciona standalone em Claude Code sem o kernel AIOS.
C8: tenantId vem do contexto da sessão de teste, nunca hardcoded em assertions.
"""


class TestAgent(BaseAgent):
    agent_name = "test_agent"  # COMPARTILHADO — sem prefixo de módulo

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
            return {"error": f"spec não encontrada para {module_name}"}

        # Detecta modo TDD-RED vs REINFORCE baseado em existência do backend doc.
        mode = "REINFORCE" if ctx["backend"] else "TDD-RED"

        trace = langfuse.trace(
            name=f"{self.agent_name}-{module_name}",
            metadata={
                "agent": self.agent_name,
                "project": _PROJECT_NAME,
                "module": module_name,
                "tier": task_input.get("tier"),
                "stack_tests": _STACK_TESTS,
                "mode": mode,
                "aios_version": "0.2.2",
            },
        ) if _LF_AVAILABLE else _MockTrace()

        if mode == "TDD-RED":
            backend_block = (
                "(Backend ainda NÃO existe — modo TDD-RED puro. Os testes que você gerar "
                "são o contrato executável da spec. Devem falhar na primeira execução "
                "porque a implementação ainda não foi escrita — esse é o RED de TDD.)"
            )
        else:
            backend_block = (
                f"Backend já implementado (use APENAS para extrair shapes/tipos/handlers — "
                f"a spec continua sendo fonte das regras):\n{ctx['backend']}"
            )

        self.messages.append({
            "role": "user",
            "content": (
                f"Gere a suíte de testes do módulo: **{module_name}**\n"
                f"MODO: {mode}\n\n"
                f"Spec (fonte primária — toda regra precisa virar teste):\n{ctx['spec']}\n\n"
                f"{backend_block}\n\n"
                f"Use a stack declarada em aios/config.yaml: {_STACK_TESTS}.\n"
                "Estrutura por teste: Arrange / Act / Assert.\n"
                "Para cada regra: 1 caso positivo + 1 negativo (mínimo).\n"
                "Para cada edge case da spec: teste explícito com nome descritivo.\n"
                "Inclua o bloco SPEC COVERAGE no final de cada arquivo + gaps honestos."
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

        output_path = PROJECT_ROOT / "docs" / "specs" / f"_tests_{module_name}.md"
        output_path.write_text(response, encoding="utf-8")

        return {
            "module": module_name,
            "output_path": str(output_path),
            "trace_id": trace.id,
            "status": "tests_generated",
        }
