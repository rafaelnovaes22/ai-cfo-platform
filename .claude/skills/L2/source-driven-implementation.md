---
name: source-driven-implementation
description: Fundamenta cada decisão de integração em documentação oficial antes de implementar. Use quando escrever código que chame SDKs externos (Anthropic, Langfuse, ClickUp, Prisma, etc.) em projetos consumidores, quando implementar adaptadores C7 em src/llm/adapters/, ou quando revisar integrações que podem usar padrões depreciados. Adaptado de source-driven-development (agent-skills).
tier: 2
vocabulary_aliases: [L2, source-driven, api-verification, docs-first]
linked_principles: [C6, C7]
version: 1.0.0
activation:
  keywords: [SDK, API, integração, adapter, Anthropic, Langfuse, ClickUp, Prisma, docs]
  explicit_invocation: "@source-driven-implementation"
---

# Source-Driven Implementation (Foundry)

## Visão Geral

Toda decisão específica de SDK ou API externa deve ser fundamentada em documentação oficial. Não implemente de memória — verifique, cite, e deixe o usuário ver as fontes. Dados de treinamento ficam desatualizados, APIs são depreciadas, práticas recomendadas evoluem.

No contexto Foundry, isso é especialmente crítico em `src/llm/adapters/` (C7): um adapter que usa uma API depreciada do Anthropic SDK silenciosamente quebra a abstração sem violar a estrutura de pastas.

## Quando Usar

- Implementando ou revisando `src/llm/adapters/` (C7 — toda chamada LLM passa aqui)
- Usando Langfuse para instrumentação `observe()` (C6)
- Integrando ClickUp, Prisma, ou qualquer SDK de terceiro
- Qualquer momento em que estiver prestes a escrever código de SDK de memória

**Quando NÃO usar:**
- Lógica pura sem dependência de versão (loops, condicionais, estruturas de dados)
- O usuário quer velocidade explicitamente ("faz logo")
- Rename, move de arquivo, sem toque em APIs externas

## O Processo

```
DETECTAR ──→ BUSCAR ──→ IMPLEMENTAR ──→ CITAR
   │            │             │             │
   ▼            ▼             ▼             ▼
 Qual SDK    Doc oficial   Seguir os     Mostrar
 e versão?   relevante     padrões       as fontes
```

### Step 1: Detectar Stack e Versões

Leia o `package.json` do projeto consumidor para identificar versões exatas:

```bash
# Versões relevantes para Foundry
cat package.json | python3 -c "
import sys,json
d=json.load(sys.stdin)
deps = {**d.get('dependencies',{}), **d.get('devDependencies',{})}
foundry_keys = ['@anthropic-ai/sdk','langfuse','@langfuse/langchain','prisma','@prisma/client']
for k in foundry_keys:
    if k in deps: print(f'{k}: {deps[k]}')
"
```

Declare explicitamente:

```
STACK DETECTADA:
- @anthropic-ai/sdk: ^0.39.0
- langfuse: ^3.22.0
- prisma: ^6.5.0
→ Buscando documentação oficial para os padrões relevantes.
```

Se as versões estiverem ausentes ou ambíguas, **pergunte ao usuário**. Não adivinhe — a versão determina quais padrões são corretos.

### Step 2: Buscar Documentação Oficial

Busque a página específica para a feature que está implementando. Não a homepage — a página relevante.

**Hierarquia de fontes (por ordem de autoridade):**

| Prioridade | Fonte | Exemplos Foundry |
|------------|-------|----------------|
| 1 | Documentação oficial | docs.anthropic.com, langfuse.com/docs, prisma.io/docs |
| 2 | Changelog / migration guide | SDK release notes, breaking changes |
| 3 | Padrões web | MDN para fetch/WebSocket |
| 4 | Repositório oficial | GitHub do SDK (issues + exemplos) |

**Não autoritativo — nunca cite como fonte primária:**
- Stack Overflow
- Blog posts / tutoriais (mesmo populares)
- Seus próprios dados de treinamento (este é o ponto — verifique)

**Seja preciso no que busca:**

```
RUIM:  Buscar a homepage do Anthropic SDK
BOM:   Buscar docs.anthropic.com/claude/reference/messages — seção tool_use

RUIM:  Buscar "langfuse observe example"
BOM:   Buscar langfuse.com/docs/sdk/typescript/decorators — seção @observe
```

### Step 3: Implementar Seguindo Padrões Documentados

Escreva código que corresponda ao que a documentação mostra:

- Use as assinaturas de API da documentação, não de memória
- Se a documentação mostra um jeito novo, use o novo
- Se a documentação depreca um padrão, não use o depreciado
- Se a documentação não cobre algo, marque como não-verificado

**Quando docs conflitam com código existente no consumer project:**

```
CONFLITO DETECTADO:
O código existente usa `anthropic.messages.create()` com model hardcoded,
mas a documentação atual do Anthropic SDK v0.39 mostra que o model
deve ser injetado via TenantContext (alinhado com C7 e C8).

Opções:
A) Seguir o padrão documentado — passar model via parâmetro (C7 compliant)
B) Manter o existente — consistente com o código atual
→ Qual abordagem prefere?
```

Surface o conflito. Não escolha silenciosamente.

### Step 4: Citar as Fontes

Cada padrão específico de SDK recebe uma citação. O usuário deve poder verificar cada decisão.

**Em comentário de código:**
```typescript
// Anthropic SDK v0.39 — streaming com tool_use
// Source: docs.anthropic.com/claude/reference/messages-streaming#tool-use-blocks
const stream = anthropic.messages.stream({ ... });
```

**Em conversação:**
```
Estou usando `observe()` do Langfuse como wrapper em vez de decorators
porque o projeto usa CommonJS e decorators exigem configuração de transpiler.

Source: langfuse.com/docs/sdk/typescript/decorators#requirements
"TypeScript decorators require experimentalDecorators: true in tsconfig.json"
```

**Regras de citação:**
- URLs completas, não encurtadas
- Prefira deep links com anchors (`/messages#tool-use` > `/messages`)
- Se não encontrar documentação para um padrão, diga explicitamente:

```
NÃO-VERIFICADO: Não encontrei documentação oficial para este padrão.
Baseado em dados de treinamento — pode estar desatualizado.
Verifique antes de usar em produção.
```

## Fontes Primárias para o Ecossistema Foundry

| SDK / Serviço | URL Base | Seções Críticas |
|---------------|----------|-----------------|
| Anthropic SDK | docs.anthropic.com | `/claude/reference/messages`, `/tool-use`, `/streaming` |
| Langfuse | langfuse.com/docs/sdk/typescript | `/decorators`, `/tracing`, `/prompt-management` |
| Claude Code | docs.anthropic.com/claude-code | `/reference/`, `/hooks/` |
| Prisma | prisma.io/docs | `/reference/api-reference/prisma-client-reference` |
| ClickUp API | clickup.com/api | endpoints específicos do projeto |

## Integração com Princípios Foundry

**C7 (portabilidade de modelo):** Sempre que implementar um adapter em `src/llm/adapters/`, verificar que a assinatura segue o padrão documentado atual — não uma versão antiga memorizada.

**C6 (observabilidade):** Verificar na documentação do Langfuse a assinatura correta de `observe()` para a versão instalada. Uma assinatura errada faz o trace ser criado mas sem os campos obrigatórios.

**C8 (anti-hardcode):** Se a documentação mostra `model: 'claude-opus-4-7'` hardcoded num exemplo, o Foundry exige parametrizar. Cite a doc mas adapte para C8.

## Racionalizações Comuns

| Racionalização | Realidade |
|---|---|
| "Estou confiante nessa API" | Confiança não é evidência. Dados de treinamento contêm padrões desatualizados que parecem corretos mas quebram na versão atual. Verifique. |
| "Buscar docs gasta tokens" | Alucinar uma API gasta mais. O usuário depura por uma hora, depois descobre que a assinatura da função mudou. Uma busca previne horas de rework. |
| "A docs não vai ter o que preciso" | Se a documentação não cobre, essa é informação valiosa — o padrão pode não ser oficialmente recomendado. |
| "É uma tarefa simples, não preciso verificar" | Tarefas simples com padrões errados viram templates. O usuário copia seu adapter depreciado para dez módulos antes de descobrir o approach moderno. |

## Red Flags

- Escrever código de SDK sem verificar a documentação para aquela versão
- Usar "acredito" ou "acho" sobre uma API em vez de citar a fonte
- Implementar um padrão sem saber qual versão ele se aplica
- Citar Stack Overflow ou blog posts em vez de documentação oficial
- Usar APIs depreciadas porque aparecem em dados de treinamento
- Não ler `package.json` antes de implementar integrações
- Entregar código sem citações para decisões específicas de SDK

## Verificação

Após implementar com source-driven:

- [ ] Versões do SDK identificadas em `package.json`
- [ ] Documentação oficial buscada para os padrões específicos
- [ ] Todas as fontes são documentação oficial (não blog posts)
- [ ] Código segue os padrões mostrados na documentação da versão atual
- [ ] Decisões não-óbvias incluem citações com URLs completas
- [ ] Nenhuma API depreciada usada (verificado nos migration guides)
- [ ] Conflitos entre docs e código existente foram surfaçados ao usuário
- [ ] Qualquer coisa não-verificada está marcada explicitamente como tal
