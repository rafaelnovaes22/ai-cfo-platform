---
name: doubt-driven-review
description: Submete cada artefato Forge não-trivial (prompt, spec, eval case, plano técnico) a uma revisão adversarial fresh-context antes de avançar para SHADOW, promote ou merge. Adaptado de doubt-driven-development (agent-skills). Use quando a correção importa mais que a velocidade, em decisões de alto risco (SHADOW start, promote, pre-merge final), ou quando um artefato vai impactar outcome contratual.
tier: 2
vocabulary_aliases: [L2, adversarial-review, doubt-cycle]
linked_principles: [C2, C4, C6, C7]
version: 1.0.0
activation:
  keywords: [revisar adversarialmente, doubt, cross-examine, antes de shadow, antes de promote]
  explicit_invocation: "@doubt-driven-review"
requires_helper:
  - skill: artifact-prompt-builder
    field: __forge_cache.current_prompt
    optional: true
---

# Doubt-Driven Review (Forge)

## Visão Geral

Uma resposta confiante não é uma resposta correta. Sessões longas acumulam contexto que silenciosamente transforma premissas em "fatos" sem que ninguém perceba. O doubt-driven review é a disciplina de materializar um revisor fresh-context — com viés de **desprovar**, não aprovar — antes que qualquer artefato Forge não-trivial avance no pipeline.

Isso não é `/acme:pre-merge-check`. O pre-merge-check é um gate final sobre código. Esta skill é uma postura em voo: artefatos não-triviais são cross-examinados enquanto correção de rota ainda é barata.

**No contexto Forge**, os artefatos-alvo típicos são:
- `prompts/{id}/v{n}/system.md` — antes de start_shadow
- `docs/specs/{id}.md` — antes de /acme:plan
- `evals/{id}/cases/` — antes de /acme:eval
- `docs/clients/{client}/plan-{id}.md` — antes de /acme:implement
- Qualquer decisão de arquitetura não-trivial antes de commit

## Quando Usar

Um artefato é **não-trivial** quando ao menos um destes é verdade:

- Vai ser usado em SHADOW ou modo superior
- Contém cláusula de outcome (C2) ou threshold (C4)
- Cruza fronteira de módulo ou serviço
- Afirma uma propriedade que eval ou tipo não verificam (thread safety, idempotência, ordenação)
- Seu blast radius é irreversível (promoção de modo, deploy, mudança de API pública)
- Mudou após o último ciclo de eval

**Quando NÃO usar:**

- Operações mecânicas (renaming, formatting, mover arquivo)
- Seguindo instrução do usuário clara e sem ambiguidade
- Mudanças de uma linha com correção óbvia
- Operações de tooling puro (rodar testes, listar arquivos)
- O usuário pediu explicitamente por velocidade

Se você duvidar de cada keystroke, nada sai. A skill aplica-se apenas a artefatos não-triviais conforme definido acima.

## Constraints de Carregamento

Esta skill é projetada para o **orquestrador principal**, onde o Step 3 (DUVIDAR) pode spawnar um revisor fresh-context.

- **NÃO adicione esta skill ao frontmatter `skills:` de um Guardian.** Um Guardian que segue o Step 3 spawnaria outro Guardian — o anti-padrão explicitamente proibido em `docs/forge/orchestration-patterns.md`.
- **Se estiver aplicando de dentro de um contexto sub-agente**: a via preferida é subir ao usuário que o doubt-driven não pode rodar aninhado e deixar a sessão principal lidar. Como último recurso, existe um fallback degradado de auto-questionamento — reescreva ARTEFATO + CONTRATO como um fresh-prompt com separador mental explícito e percorra Steps 1–5. Isso **não é revisão fresh-context** (você carrega seu próprio contexto), então sinalize o resultado como degradado.

## O Processo

Copie esta checklist quando aplicar a skill:

```
Ciclo de dúvida:
- [ ] Step 1: AFIRMAÇÃO — escrevi a afirmação + por que importa
- [ ] Step 2: EXTRAÇÃO — isolei artefato + contrato, removi raciocínio
- [ ] Step 3: DUVIDAR — invoquei revisor fresh-context com prompt adversarial
- [ ] Step 4: RECONCILIAR — classifiquei cada finding contra o texto do artefato
- [ ] Step 5: PARAR — atingi condição de parada (findings triviais, 3 ciclos, ou override do usuário)
```

### Step 1: AFIRMAÇÃO — Surface o que está em pé

Nomeie a decisão em duas ou três linhas:

```
AFIRMAÇÃO: "O prompt system.md v2 produz outcomes corretos para
            o outcome_category 'triagem-positiva' conforme spec."
POR QUE IMPORTA: um erro aqui faz o agente SHADOW errar sistematicamente
                 e inflar o custo por outcome além do C3.
```

Se não conseguir escrever a afirmação assim compactamente, você tem uma sensação, não uma decisão. Surface-a antes de escrutinar.

### Step 2: EXTRAÇÃO — Menor unidade revisável

Um revisor fresh-context precisa do **artefato** e do **contrato**, não da jornada.

- Prompt: o system.md atual — não todo o diretório `prompts/`
- Spec: a cláusula de outcome + 3+3 exemplos — não o doc inteiro
- Eval case: o caso específico + gabarito + justificativa — não toda a suite
- Plano técnico: a seção de decisão de arquitetura — não o plano inteiro

Remova seu raciocínio. Se passar conclusões, receberá validação de suas conclusões. A unidade deve ser pequena o suficiente para um revisor segurar em mente em uma leitura — se é um plan.md de 200 linhas, decomponha primeiro.

### Step 3: DUVIDAR — Invocar o revisor fresh-context

O prompt do revisor **deve ser adversarial**. O framing decide a resposta.

```
Revisão adversarial. Encontre o que está errado com este artefato Forge.
Assuma que o autor é super-confiante. Procure por:
- Premissas não declaradas
- Edge cases não tratados
- Violações dos princípios C1-C8
- Formas como o CONTRATO pode ser violado
- Ambiguidades na cláusula de outcome (C2)
- Custo por outcome que não fecha com o baseline (C3)
- Chamadas LLM sem observe() (C6)
- Hardcode de modelo ou tenant (C7/C8)

NÃO valide. NÃO resuma. Encontre problemas, ou afirme explicitamente
que não encontrou nenhum após exame minucioso.

ARTEFATO: <cole artefato>
CONTRATO: <cole contrato — cláusula de outcome + thresholds C4>
```

**Passe ARTEFATO + CONTRATO apenas. NÃO passe a AFIRMAÇÃO.** Passar sua conclusão ao revisor o vicia em favor de concordar.

Em Claude Code, use os Guardians de `.claude/agents/` — eles iniciam com contexto isolado por design:
- Prompt system.md → `@artifact-architect` (C5/C7/C8) + `@observability-guardian` (C6)
- Spec / outcome clause → `@po-guardian` (C2)
- Eval cases → `@eval-engineer` (C4)
- Custo / margem → `@unit-economist` (C3)
- PII / secrets → `@security-privacy-guardian`

**O prompt adversarial acima tem precedência sobre o formato de resposta padrão do Guardian.** Guardiões como `@po-guardian` estão escritos para produzir veredictos balanceados; o doubt-driven precisa de saída issues-only. Cole o prompt adversarial verbatim na invocação.

### Step 4: RECONCILIAR — Dobrar findings de volta

O output do revisor é dado, não veredicto. **Você ainda é o orquestrador.** Releia o texto do artefato contra cada finding antes de classificar — rubber-stamp no revisor é o mesmo failure mode que ignorá-lo.

Para cada finding, classifique nesta **ordem de precedência** (primeiro matching ganha):

1. **Contrato mal lido** — revisor sinalizou algo porque o CONTRATO que você forneceu estava pouco claro. Corrija o contrato primeiro, reclassifique no próximo ciclo.
2. **Válido + acionável** — problema real exigindo mudança no artefato. Mude, re-loop.
3. **Trade-off válido** — problema é real mas custo de corrigir excede custo de aceitar. Documente o trade-off explicitamente para o usuário ver.
4. **Ruído** — revisor sinalizou algo correto sob contexto que ele não tinha. Anote, siga em frente.

Um revisor fresh-context pode estar errado porque falta contexto. Não defira apenas porque é "fresh".

### Step 5: PARAR — Loop limitado, não recursão

Pare quando:

- Próxima iteração retorna apenas findings triviais ou já considerados, **ou**
- 3 ciclos completados (escale ao usuário, não grind um quarto sozinho), **ou**
- Usuário explicitamente diz "segue"

Se após 3 ciclos o revisor ainda surfaça problemas substanciais, o artefato pode não estar pronto. Surface isso ao usuário — três ciclos não resolvidos é informação sobre o artefato, não razão para continuar em loop.

## Integração com Gates do Forge

| Gate | Onde se encaixa o doubt-driven |
|------|-------------------------------|
| **G1 pre-merge** | Rodar antes de `/acme:pre-merge-check` em prompts modificados |
| **Gate 1 promote** | Rodar sobre spec antes de `start_shadow` |
| **Gate 4 promote** | Rodar sobre eval suite antes de `shadow_to_assisted` |
| **Gate 5 promote** | Rodar sobre plano técnico antes de `assisted_to_autonomous` |
| **/acme:implement** | Rodar sobre cada decisão de arquitetura não-trivial na Onda 2 |

## Racionalizações Comuns

| Racionalização | Realidade |
|---|---|
| "Estou confiante, pulo o doubt step" | Confiança correlaciona mal com correção em problemas novos. Momentos de certeza são exatamente quando blind spots se escondem. |
| "Spawnar um Guardian é caro" | Debugar um commit errado em produção é mais caro. O check é limitado; o bug não é. |
| "O revisor vai apenas nitpick" | Só se não tiver escopo. Constranja o prompt a 'problemas que fariam isto falhar sob o contrato'. |
| "Vou fazer doubt no final com /pre-merge-check" | Pre-merge-check é um gate final. Doubt-driven pega direções erradas cedo quando correção de rota é barata. No PR, já é tarde demais. |
| "Se duvidar de tudo, nunca vou promover" | A skill aplica-se a artefatos não-triviais, não a cada keystroke. Releia 'Quando NÃO usar'. |
| "O revisor discordou então eu estava errado" | O revisor não tem seu contexto — discordância é informação, não veredicto. Releia o artefato, classifique, então decida. |

## Red Flags

- Spawnar revisão adversarial para um rename de variável ou mudança de formatação
- Tratar output do revisor como autoritativo sem reler o texto do artefato
- Looping >3 ciclos sem escalar ao usuário
- Prompt ao revisor com "isto está bom?" em vez de "encontre problemas"
- Pular doubt sob pressão de tempo em decisão de alto risco (exatamente quando mais importa)
- Re-spawnar fresh-context em artefato não-modificado (você vai obter os mesmos findings; você está estagnando)
- **Doubt theater**: em 2+ ciclos onde o revisor surfaçou findings substanciais, zero foram classificados como acionáveis. Você está validando, não duvidando. Pare e escale.
- Duvidar apenas após commit — isso é `/review`, não doubt-driven

## Interação com Outros Artefatos Forge

- **`/acme:pre-merge-check`**: complementar. Pre-merge-check é veredicto pós-hoc sobre PR; doubt-driven é postura em voo por artefato.
- **`/acme:eval`**: quando doubt-driven aplica-se a um eval case, o ciclo RED do TDD (escrever caso que reproduz o problema antes de corrigir) **é** o step de dúvida para afirmações comportamentais.
- **`@artifact-prompt-builder`**: quando um prompt é construído por esta skill L2, rodar doubt-driven antes de passar para shadow-mode-runner.
- **`docs/forge/orchestration-patterns.md`**: esta skill orquestra da sessão principal. Um Guardian chamando outro Guardian é o anti-padrão B — veja Constraints de Carregamento acima.

## Verificação

Após aplicar o doubt-driven review:

- [ ] Todo artefato não-trivial (per definição acima) foi nomeado explicitamente como AFIRMAÇÃO antes de avançar
- [ ] Ao menos uma revisão fresh-context por artefato não-trivial (um eval case RED do TDD satisfaz isso para afirmações comportamentais)
- [ ] O revisor recebeu ARTEFATO + CONTRATO — NÃO a AFIRMAÇÃO, NÃO seu raciocínio
- [ ] O prompt do revisor foi adversarial ("encontre problemas"), não validador ("está bom")
- [ ] Findings foram classificados contra o texto do artefato (não rubber-stamped) usando a precedência: contrato mal lido / acionável / trade-off / ruído
- [ ] Uma condição de parada foi atingida (findings triviais, 3 ciclos, ou override do usuário)
