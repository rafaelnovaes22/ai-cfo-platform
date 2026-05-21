# Monthly Analysis — seleção de modelos e matriz de avaliação

Status: template operacional
SKU: `monthly-analysis`
Escopo: Frente 3 — matriz tarefa/modelo, estrutura de relatório e decisão sem chamadas LLM por padrão.

## Objetivo

Definir como comparar modelos por tarefa do pipeline multiagente do Monthly Analysis sem depender de credenciais ou chamadas LLM no fluxo padrão.

A seleção final deve respeitar os princípios já documentados em `docs/monthly-analysis/agent-model-plan.md`:

- **SLM first**: menor modelo confiável por tarefa.
- **Fallback só quando necessário**: modelo maior entra por falha, baixa confiança ou blocker de QA.
- **Regra antes de LLM**: cálculo financeiro e agregação DRE ficam determinísticos.
- **Output estruturado**: todo resultado deve validar schema.
- **QA independente**: revisor deve evitar o mesmo modelo do gerador.
- **SHADOW antes de produção**: nenhum modelo novo publica autonomamente antes dos gates.

## Ferramenta estática

Script:

```bash
npm run eval:model-matrix
```

Características:

- Gera a matriz de tarefas agentic do `monthly-analysis`.
- Usa `src/llm/router.ts` como fonte dos modelos primários e fallbacks atuais.
- Não faz chamada para OpenAI, Anthropic, Google ou modelo local.
- Não exige `.env` nem credenciais.
- Pode emitir Markdown ou JSON.

Exemplos:

```bash
# Markdown no stdout, sem chamadas LLM
npm run eval:model-matrix

# JSON no stdout
npm run eval:model-matrix -- --json

# Escrever snapshot Markdown versionável
npm run eval:model-matrix -- --output=docs/monthly-analysis/model-matrix.generated.md

# Flag explícita de segurança; é o comportamento padrão
npm run eval:model-matrix -- --no-call
```

## Matriz inicial de tarefas e modelos

| Tarefa | Primário | Fallback | Papel |
|---|---|---|---|
| `normalization` | `openai/gpt-4.1-nano` | `openai/gpt-4.1-mini` | limpar/enriquecer lançamentos sem alterar valores financeiros |
| `clarity-judge` | `openai/gpt-4.1-nano` | `openai/gpt-4.1-mini` | decidir se descrição é clara ou ambígua |
| `dre-classification` | `openai/gpt-4.1-mini` | `anthropic/claude-haiku-4-5` | classificar lançamento em categoria DRE |
| `anomaly-detection` | `google/gemini-2.5-flash-lite` | `openai/gpt-4.1-mini` | detectar outliers, duplicidades e movimentos atípicos |
| `margin-diagnosis` | `google/gemini-2.5-flash-lite` | `openai/gpt-4.1-mini` | explicar margens e drivers com evidência numérica |
| `cashflow-risk` | `openai/gpt-4.1-mini` | `anthropic/claude-haiku-4-5` | estimar risco de caixa e explicitar limitações |
| `narrative-synthesis` | `google/gemini-2.5-flash` | `anthropic/claude-sonnet-4-6` | gerar 3 cards executivos com evidência |
| `action-planning` | `google/gemini-2.5-flash` | `anthropic/claude-sonnet-4-6` | gerar plano de ação 3 horizontes |
| `financial-qa-review` | `openai/gpt-4.1-mini` | `anthropic/claude-haiku-4-5` | revisar coerência e decidir publishable/needs_review |

> Observação: a matriz acima é uma fotografia do router atual. O script deve ser usado como fonte operacional para evitar divergência quando o router mudar.

## Métricas comuns do relatório

Todo relatório de avaliação por modelo deve conter:

- `task`
- `provider`
- `model`
- `dataset_version`
- `attempted_cases`
- `schema_success_rate`
- `task_pass_rate`
- `latency_p50_ms`
- `latency_p95_ms`
- `cost_cents_per_analysis`
- `retry_rate`
- `hallucination_rate`
- `human_review_rate`
- `threshold_met`
- `decision`: `keep_primary`, `keep_fallback`, `promote`, `demote`, `needs_more_data`
- `reviewer_notes`

## Gates mínimos por família

### Classificação DRE

- `schema_success_rate >= 99%`
- `accuracy_clear >= 90%`
- `accuracy_overall >= 85%`
- `ambiguous_to_review >= 95%`
- Nenhuma categoria material de DRE pode ficar abaixo do threshold acordado sem fallback ou revisão humana.

### Narrativa executiva

- Sempre gerar exatamente 3 cards.
- Cada card deve conter pelo menos uma evidência numérica ou `evidenceRef`.
- `task_pass_rate >= 90%`.
- `hallucination_rate = 0%` para afirmações materiais.
- Cards sem evidência devem virar `needs_review`.

### Plano de ação

- Pelo menos 3 ações de curto prazo.
- Pelo menos 1 ação de médio prazo.
- Pelo menos 1 ação de longo prazo.
- 100% das ações com `doneWhen`, `evidenceRefs` e `confidence`.
- Ação sem critério de conclusão mensurável falha o case.

### QA financeiro

- `schema_success_rate >= 99%`.
- Detectar pelo menos 90% dos erros plantados.
- `false_block_rate <= 10%`.
- Nenhuma análise autônoma deve publicar sem `publishable=true`.
- Preferir provider/modelo diferente dos geradores revisados quando possível.

## Template de relatório mensal

Copiar o bloco abaixo para cada rodada real de avaliação.

```md
# Monthly Analysis — relatório de seleção de modelos

Período avaliado: YYYY-MM
Dataset version: `monthly-analysis-eval-vX`
Modo: SHADOW / ASSISTED / AUTONOMOUS-candidate
Responsável: <nome>
Data: YYYY-MM-DD

## Sumário executivo

- Decisão geral: keep / change / needs_more_data
- Principal ganho observado:
- Principal risco observado:
- Custo estimado por análise:
- Recomendação para próximo ciclo:

## Resultados por tarefa

### `<task>`

- Modelo primário testado: `<provider>/<model>`
- Fallback testado: `<provider>/<model>`
- Cases tentados: N
- `schema_success_rate`: N%
- `task_pass_rate`: N%
- `latency_p50_ms`: N
- `latency_p95_ms`: N
- `cost_cents_per_analysis`: N
- `retry_rate`: N%
- `hallucination_rate`: N%
- `human_review_rate`: N%
- Threshold met: sim/não
- Decisão: `keep_primary` / `keep_fallback` / `promote` / `demote` / `needs_more_data`
- Evidências:
  - Case IDs que passaram:
  - Case IDs que falharam:
  - Falhas críticas:
- Próxima ação:

## Blockers de promoção

- [ ] Dataset mínimo completo.
- [ ] Schemas validados em 99%+ onde aplicável.
- [ ] Custo por outcome dentro do limite de unit economics.
- [ ] QA detecta blockers críticos.
- [ ] Rodada em SHADOW revisada por humano.

## Decisão final

Registrar aqui a decisão aprovada e atualizar `src/llm/router.ts` somente após a avaliação passar nos gates.
```

## Política de uso de chamadas LLM

- O comando `eval:model-matrix` é sempre seguro para CI/local porque não chama LLM.
- Rodadas com LLM real devem usar o runner específico (`eval:llm`) ou script futuro com flag explícita, por exemplo `--execute-live`, nunca por padrão.
- Não registrar prompts com dados reais de cliente sem anonimização.
- Não commitar `.env`, chaves, outputs contendo PII ou traces sensíveis.

## Critério para alterar o router

Só alterar `src/llm/router.ts` quando:

1. A matriz estática refletir a tarefa correta.
2. O dataset versionado tiver amostra mínima.
3. O modelo candidato passar nos gates da tarefa.
4. O custo estimado respeitar C3/unit economics.
5. A rodada tiver revisão humana em SHADOW.
6. A mudança tiver rollback simples para o modelo anterior.
