---
name: prompt-simplification
description: Simplifica artefatos de prompt Forge e código de consumer project para clareza e eficiência de tokens, sem mudar comportamento. Use após uma wave de implementação quando o prompt funciona mas está verbose, redundante ou caro demais. Também aplica-se a código de consumer project antes de /acme:pre-merge-check. Adaptado de code-simplification (agent-skills).
tier: 2
vocabulary_aliases: [L2, prompt-compression, refactoring, token-reduction]
linked_principles: [C3, C5, C6, C7]
version: 1.0.0
activation:
  keywords: [simplificar, comprimir, refatorar, reduzir tokens, prompt verbose, código redundante]
  explicit_invocation: "@prompt-simplification"
requires_helper:
  - skill: artifact-prompt-builder
    field: __forge_cache.current_prompt
    optional: true
---

# Prompt Simplification (Forge)

## Visão Geral

Simplifique reduzindo complexidade sem mudar comportamento. O objetivo não são menos linhas — é um artefato que produz os mesmos outcomes com menos tokens (C3) e que é mais fácil de versionar, auditar e manter.

**Dois contextos de uso:**
1. **Prompt Forge** (`prompts/{id}/v{n}/system.md`) — reduz custo de inferência (C3) e facilita manutenção do artefato ao longo do ciclo SHADOW→AUTONOMOUS.
2. **Código de consumer project** — integra com `/acme:pre-merge-check` gates G1-G3 (C6/C7/C8) antes de merge.

## Quando Usar

- Prompt funciona (eval passa) mas o custo por outcome está acima ou próximo do threshold C3
- Prompt tem instruções duplicadas, exemplos 3+3 redundantes, ou contexto já disponível via L0/L1
- Código consumer tem nesting profundo, nomes genéricos, ou lógica duplicada
- Após merge de múltiplas waves de implementação que acumularam redundância

**Quando NÃO usar:**
- O prompt ainda não passou em eval — simplificar antes de funcionar é otimização prematura
- Você não entende completamente o que a instrução faz — entenda antes de remover
- O artefato está prestes a ser substituído inteiramente por uma nova versão

## Os Cinco Princípios

### 1. Preservar Comportamento Exatamente

Não mude o que o prompt produz — apenas como expressa. Todos os outcomes, edge cases e exemplos negativos (3+3) devem permanecer idênticos. Se não tiver certeza que uma simplificação preserva comportamento, não faça.

```
ANTES DE CADA MUDANÇA NO PROMPT:
→ Esse output é idêntico para todos os inputs do eval suite?
→ Os exemplos negativos ainda são rejeitados corretamente?
→ O mesmo gabarito seria gerado para os cases existentes?
→ A eval suite passa sem modificação nos cases?
```

### 2. Respeitar a Hierarquia de Tier (C5)

Antes de remover contexto do prompt, verifique se ele está sendo fornecido por L0/L1 ou se precisa estar embutido no L2.

```
Contexto pode ser removido do prompt se:
  → Está disponível via @company-dna (L0)
  → Está em TenantContext (C8) injetado no runtime
  → É redundante com exemplos já presentes

Contexto DEVE permanecer no prompt se:
  → É específico ao outcome_category deste artefato
  → Não está disponível em nenhuma skill L0/L1
  → Sua ausência causaria falha em cases adversariais
```

### 3. Preferir Clareza à Compactação

Instrução explícita é melhor que implícita quando a versão implícita exige que o modelo infira demais.

```
# POUCO CLARO — compacto mas ambíguo
"Classifique a mensagem como positivo/negativo/neutro conforme o contexto."

# CLARO — explícito sobre o critério de decisão
"Classifique como positivo se o usuário indica intenção de compra.
 Classifique como negativo se indica cancelamento ou reclamação.
 Classifique como neutro em todos os demais casos."
```

### 4. Manter Balance

Simplificação tem um failure mode: simplificação excessiva. Cuidado com:

- **Remover exemplos negativos** — o 3+3 (C2) existe para calibrar os casos de borda; jamais remova exemplos sem rodar eval
- **Fundir instruções não relacionadas** — dois parágrafo simples fundidos em um parágrafo complexo não é mais simples
- **Remover contexto de "por quê"** — se uma instrução explica a razão de uma regra, preserve; o modelo se alinha melhor

### 5. Escopo no Que Mudou

Por padrão, simplifique o artefato da wave atual. Evite simplificações não solicitadas em artefatos de waves anteriores a menos que explicitamente pedido.

## Processo de Simplificação

### Step 1: Entender Antes de Tocar (Cerca de Chesterton)

Antes de remover qualquer instrução ou bloco, entenda por que existe.

```
ANTES DE SIMPLIFICAR, RESPONDA:
- Qual outcome_category esta instrução protege?
- Qual case falharia sem ela? (rodar eval para verificar)
- Ela existe por um edge case raro mas alto-impacto?
- Há um exemplo no 3+3 que depende desta instrução?
- O git blame mostra por que foi adicionada?
```

Se não conseguir responder, leia mais contexto antes.

### Step 2: Identificar Oportunidades de Simplificação

Varredura por estes padrões — cada um é sinal concreto:

**Prompt (`system.md`):**

| Padrão | Sinal | Simplificação |
|--------|-------|---------------|
| Instrução duplicada | Mesma regra em 2 parágrafos | Manter a mais precisa, remover a outra |
| Contexto redundante com L0 | DNA da empresa descrito no prompt | Remover — vem de @company-dna via TenantContext |
| Exemplo positivo genérico demais | Input trivial que qualquer modelo acertaria sem instrução | Substituir por caso mais calibrador |
| Instrução negativa desnecessária | "Não faça X" onde X nunca aparece nos cases | Remover se eval continuar passando |
| Verbosidade em instruções de formato | Parágrafo descrevendo o formato quando um template seria suficiente | Substituir por template de output |

**Código de consumer project:**

| Padrão | Sinal | Simplificação |
|--------|-------|---------------|
| Nesting profundo (3+ níveis) | Difícil seguir o fluxo | Guard clauses / return antecipado |
| Funções longas (50+ linhas) | Múltiplas responsabilidades | Dividir em funções focadas com nomes descritivos |
| Ternário encadeado | Requer stack mental para parsear | Substituir por if/else ou objeto de lookup |
| `if (tenantId === '...')` | **Violação C8 direta** | Remover — levar para TenantContext ou config |
| `callLLM()` sem `observe()` | **Violação C6 direta** | Adicionar wrapper `observe()` imediatamente |
| SDK import fora de `adapters/` | **Violação C7 direta** | Mover para camada de abstração correta |
| Nomes genéricos | `data`, `result`, `temp` | Renomear para descrever conteúdo: `classifiedOutcome`, `tenantConfig` |

### Step 3: Aplicar Mudanças Incrementalmente

Faça uma simplificação de cada vez. Rode eval após cada mudança em prompts; rode forge-doctor após cada mudança estrutural.

```
PARA CADA SIMPLIFICAÇÃO DE PROMPT:
1. Fazer a mudança
2. Rodar /acme:eval (ou o subset de cases afetados)
3. Pass rate mantido? → Commit ou próxima simplificação
4. Pass rate caiu? → Reverter e reconsiderar
```

**Nunca simplificação de prompt e nova feature no mesmo commit.** São dois artefatos separados.

### Step 4: Verificar o Resultado

Após todas as simplificações, avalie o todo:

```
COMPARAR ANTES E DEPOIS:
- A versão simplificada é genuinamente mais fácil de manter?
- O custo de tokens estimado reduziu? (contar tokens antes/depois)
- O diff é limpo e revisável?
- O eval suite passa com exatamente os mesmos pass_rates?
```

Se a versão "simplificada" for mais difícil de entender ou mantiver o mesmo custo, reverta. Nem toda tentativa de simplificação é bem-sucedida.

## Padrões de Compressão de Prompt

### Remover Redundância de Contexto (C5)

```
# ANTES — contexto disponível via L0
"Você é um assistente da Acme Soluções, empresa brasileira
 especializada em automação de processos. Nossa missão é..."

# DEPOIS — referência ao que vem de L0
"[contexto da empresa via TenantContext]"
# Ou simplesmente remover — @company-dna já injeta isso
```

### Consolidar Instruções Duplicadas

```
# ANTES — duplicado em dois parágrafos
"Responda sempre em português brasileiro.
 ...
 Lembre-se: use apenas o idioma português do Brasil nas respostas."

# DEPOIS — uma vez, no lugar certo
"Responda em português brasileiro."
```

### Trocar Parágrafo por Template

```
# ANTES — instrução verbal de formato
"Sua resposta deve conter primeiro a classificação, depois
 a justificativa de uma linha, depois a confiança em porcentagem."

# DEPOIS — template direto
"Formato de resposta:
classificacao: <positivo|negativo|neutro>
justificativa: <uma linha>
confianca: <0-100>%"
```

### Substituir Exemplo Genérico por Calibrador

```
# ANTES — positivo trivial (não calibra)
"POSITIVO: 'Quero assinar o plano'"

# DEPOIS — positivo calibrador (testa a borda)
"POSITIVO: 'Pensando bem, talvez eu assine' (intenção implícita conta)"
```

## Racionalizações Comuns

| Racionalização | Realidade |
|---|---|
| "Está funcionando, não preciso tocar" | Código que funciona mas é difícil de ler será difícil de corrigir quando quebrar. Simplificar agora economiza tempo em toda mudança futura. |
| "Menos tokens sempre é melhor" | Um prompt com 1 instrução ambígua não é mais simples que um com 3 claras. Simplicidade é velocidade de compreensão, não contagem de tokens. |
| "Vou simplificar essa parte não-relacionada também" | Simplificação fora do escopo cria diffs barulhentos e risco de regressão em código que não era intenção mudar. Foque no artefato da wave atual. |
| "Remover exemplos do 3+3 vai reduzir tokens" | Os exemplos negativos (C2) são gates de calibração. Remova apenas após verificar com eval que o case adversarial correspondente ainda passa. |
| "O modelo vai inferir essa instrução" | Talvez. Em 80% dos cases. Os 20% restantes são exatamente os adversariais que causam SLA breach. |

## Red Flags

- Simplificação que exige modificar gabaritos de eval para passar (você mudou o comportamento)
- Código "simplificado" mais longo e mais difícil de seguir que o original
- Renomear coisas para corresponder a preferências pessoais em vez de convenções do projeto
- Remover tratamento de erro porque "deixa o código mais limpo"
- Simplificar código que você não entende completamente
- Múltiplas simplificações sem rodar eval entre elas
- Remover instrução de prompt sem verificar qual case ela protege

## Verificação

Após um passe de simplificação:

- [ ] Eval suite passa sem modificação nos cases (pass_rates idênticos)
- [ ] `bash scripts/forge-doctor.sh` retorna 0 FAIL
- [ ] `/acme:pre-merge-check` retorna go (C6/C7/C8 não foram violados)
- [ ] Custo estimado de tokens reduziu ou se manteve (nunca aumentou)
- [ ] Nenhum exemplo do 3+3 foi removido sem verificação via eval
- [ ] Contexto de "por quê" de instruções críticas foi preservado ou documentado em comentário
- [ ] Diff é limpo — sem mudanças não-relacionadas misturadas
