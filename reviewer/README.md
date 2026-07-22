# Novais Digital Foundry — Reviewer

> Entrypoint do DeepAgent reviewer e dos assets de auditoria mensal.

---

## O que é este diretório

Contém os artefatos que habilitam o **reviewer externo independente** (DeepAgent / GPT-5.5) a auditar qualquer projeto que usa o Foundry. O reviewer valida os 8 princípios C1–C8 mensalmente a partir do `manifest.json` do projeto consumidor.

## Ordem de leitura

Para um DeepAgent que vai executar uma auditoria:

1. **[`prompt.template.md`](./prompt.template.md)** — system prompt completo; carregar como contexto antes de tudo
2. **[`validation-rules.json`](./validation-rules.json)** — checks machine-readable dos 8 princípios; input primário dos checks
3. **[`output-schema.json`](./output-schema.json)** — schema JSON do relatório de saída; validar output contra ele
4. **[`example-audit.md`](./example-audit.md)** — exemplo sintético de relatório bem-feito; usar como referência de formato

Para um dev humano configurando o reviewer:

- **[`deepagents/README.md`](./deepagents/README.md)** — como configurar e executar o reviewer DeepAgents CLI (LangChain Python)
- **[`deepagents/conversion-log.md`](./deepagents/conversion-log.md)** — histórico de conversão dos 10 SKILL.md para formato DeepAgents

## Assets

| Arquivo | Tipo | Audiência |
|---|---|---|
| `prompt.template.md` | System prompt | deep-agent |
| `validation-rules.json` | Checks machine-readable | deep-agent |
| `output-schema.json` | Schema JSON de output | deep-agent |
| `example-audit.md` | Exemplo de relatório | deep-agent, framework-maintainer |
| `deepagents/` | Implementação via LangChain | human-developer |

## Contrato

O contrato formal do reviewer (SLAs de auditoria, frequência, escopo) está em:
[`docs/foundry/reviewer-contract.md`](../docs/foundry/reviewer-contract.md)

A decisão sobre stack e runtime está em **F4**, **F9**, **F17**, **F18** de
[`docs/foundry/decisions.md`](../docs/foundry/decisions.md).
