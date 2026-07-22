---
name: sdk-migration
description: Gerencia migração de SDKs externos, modelos depreciados e atualizações do próprio Foundry framework em projetos consumidores. Use quando o Anthropic SDK, Langfuse ou Prisma bumpar uma versão com breaking changes, quando um modelo LLM for depreciado pela Anthropic, ou quando um consumer project precisar sincronizar para uma nova versão do Foundry. Adaptado de deprecation-and-migration (agent-skills).
tier: 1
vocabulary_aliases: [L1, migration, sdk, deprecation, upgrade]
linked_principles: [C7, C4]
version: 1.0.0
activation:
  keywords: [migração, migration, upgrade, deprecate, SDK, modelo, version, breaking change, Foundry update]
  explicit_invocation: "@sdk-migration"
---

# SDK Migration (Foundry)

## Visão Geral

Código é um passivo, não um ativo. SDKs evoluem, modelos são depreciados, o próprio Foundry bumpa versões. A disciplina de migração no contexto Foundry tem uma vantagem estrutural: o princípio C7 já isola todas as dependências externas — SDKs LLM em `src/llm/adapters/`, integrações em `src/integrations/`, infra em `src/infra/`. Isso significa que migrações ficam contidas, não virais.

## Quando Usar

- Anthropic SDK bumpa versão com breaking change (ex.: `messages.create` muda assinatura)
- Modelo LLM é depreciado pela Anthropic (ex.: `claude-2`, `claude-3-sonnet` removidos do catálogo)
- Langfuse ou Prisma bumpa versão com breaking change
- Foundry framework bumpa MINOR/MAJOR e consumer project precisa sincronizar
- Skills ou commands obsoletos acumulando no manifest sem uso

**Quando NÃO usar:** Upgrade de patch sem breaking change (apenas `npm update` e foundry-doctor).

## A Decisão de Migrar

Antes de iniciar qualquer migração, responda:

```
1. O sistema atual ainda entrega valor único?
   → Se sim, manter. Se não, ou se está depreciado upstream, prosseguir.

2. Quantos consumidores dependem dele?
   → Para adapters: grep em src/ quantos importam o adapter sendo substituído.
   → Para skills/commands: verificar manifest + grep em prompts.

3. O substituto existe e está provado?
   → Não deprece sem alternativa. Construa/verifique o substituto primeiro.

4. Qual o custo de migração vs custo de NÃO migrar?
   → SDK com vulnerabilidade: compulsório. Modelo depreciado com data: compulsório.
   → Versão mais nova sem urgência: advisory, planeje em próximo sprint.

5. Qual o risco de regressão SHADOW/PILOT?
   → Migração de modelo exige re-eval. Migração de SDK pode não exigir (C7 isola).
```

## Tipos de Migração no Foundry

### Tipo A: Migração de SDK (Anthropic, Langfuse, Prisma)

**Por que C7 torna isso barato:** As chamadas SDK ficam em `src/llm/adapters/`, `src/integrations/`, ou `src/infra/`. O código de negócio não importa o SDK diretamente. Uma migração de SDK toca no máximo 2–3 arquivos.

**Processo:**

```
1. Verificar breaking changes no changelog/migration guide do SDK
   → @source-driven-implementation para ler a documentação antes de tocar código

2. Criar adapter novo (ou atualizar o existente) isolado
   → Nunca editar inline enquanto o sistema está em SHADOW/PILOT ativo

3. Rodar eval suite com adapter novo
   → Se pass rate cair: a mudança de SDK mudou comportamento — investigar

4. Substituir referência no código de negócio (deve ser zero ou mínimo — C7)

5. foundry-doctor + commit
```

**Quando re-eval é obrigatório após migração de SDK:**
- Mudança de modelo (qualquer — afeta saída)
- Mudança de como o prompt é enviado (system prompt format, tool_use format)
- Mudança de tokenização que afeta custo (C3 — recalc unit economics)

**Quando re-eval NÃO é necessário:**
- Mudança de cliente HTTP interno do SDK (sem impacto na resposta)
- Mudança de tipagem TypeScript (sem impacto em runtime)
- Bump de patch sem breaking change

### Tipo B: Migração de Modelo LLM Depreciado

Quando a Anthropic depreca um modelo (ex.: `claude-2` → removido do catálogo):

```
1. Verificar deadline de remoção na documentação oficial
   → docs.anthropic.com/en/docs/resources/model-deprecations

2. Identificar todos os pontos de uso
   grep -r "claude-2\|claude-3-sonnet" src/ docs/ templates/
   → Em C8-compliant: deve aparecer APENAS em TenantContext e nos adapters

3. Atualizar TenantContext default (se o modelo estava como fallback)
4. Atualizar adapters que referenciam o modelo por string
5. Rodar eval completo — mudança de modelo = re-eval obrigatória
6. Verificar C3 (custo pode mudar com modelo novo)
7. commit + foundry-doctor
```

**Red flag:** Se `grep` retorna ocorrências fora de TenantContext e adapters → violação C8. Corrija antes da migração.

### Tipo C: Migração do Foundry Framework (MINOR/MAJOR)

Quando o repositório `agent-governance-framework` bumpa versão e o consumer precisa sincronizar:

**Para bumps PATCH (ex.: 0.17.0 → 0.17.1):**
```bash
# Copiar arquivos atualizados (scripts/foundry-sync.sh cobre isso)
# Rodar foundry-doctor — deve passar sem mudança de comportamento
```

**Para bumps MINOR (nova capability, ex.: 0.17.0 → 0.18.0):**
```
1. Ler CHANGELOG.md da nova versão — identificar novos artefatos
2. Copiar novos skills/commands/hooks
3. Atualizar .claude/settings.json _foundry_version
4. Atualizar docs/foundry/manifest.json manifest_version + novos artefatos
5. foundry-doctor para verificar consistência
```

**Para bumps MAJOR (quebra de Constitution, ex.: 0.x → 1.0):**
- Consultar CONTRIBUTING.md → seção "Processo para MAJOR bumps"
- Exige ADR no consumer project documentando decisão de migrar
- Exige aviso prévio do mantenedor + janela de suporte N-1
- NÃO migre automaticamente — requer decisão humana explícita

## Padrões de Migração

### Strangler Pattern (Para Adapters)

Rode o adapter antigo e o novo em paralelo. Roteie via TenantContext:

```typescript
// TenantContext controla qual adapter usa
// Fase 1: 100% no adapter antigo
// Fase 2: canary — 10% no adapter novo (tenant específico)
// Fase 3: 100% no adapter novo
// Fase 4: remover adapter antigo
```

O SHADOW mode é naturalmente um strangler: output novo não vai para produção enquanto não aprovado.

### Adapter Pattern (O Foundry já faz isso)

`src/llm/adapters/` é o Adapter Pattern. A migração de SDK fica dentro do adapter. O código de negócio nunca sabe que o SDK mudou.

```
ANTES: src/llm/adapters/claude.ts usa @anthropic-ai/sdk v0.30
DEPOIS: src/llm/adapters/claude.ts usa @anthropic-ai/sdk v0.40
→ Nenhuma mudança fora do adapter
```

### Feature Flag Migration (Para Modelos em Teste)

Ao testar um modelo novo sem substituir o atual:

```
TenantContext.model pode ser:
  - string fixa (tenant usa modelo específico)
  - env var (todos os tenants usam o default do ambiente)
  - override por subscription (tenant opt-in para modelo novo)
```

Use TenantContext, nunca `if (model === 'claude-3-5-sonnet')` no código de negócio (viola C8).

## Código Zumbi no Foundry

Código zumbi no contexto Foundry: skills, commands, adapters ou prompts que ninguém usa mas continuam no manifest.

**Sinais:**
- Skill sem entrada no manifest de nenhum consumer project por 3+ meses
- Command que não aparece em nenhum `tasks.md` de cliente
- Adapter para modelo que foi depreciado upstream
- Prompt versão antiga que nenhum SHADOW ativo usa

**Resposta:** Ou atribuir responsável e manter ativamente, ou deprecar com migration guide. Não pode ficar em limbo — acumula confusão e FALSOs POSITIVOS no foundry-doctor.

## Compulsório vs Advisory

| Tipo | Quando Usar | Mecanismo |
|------|-------------|-----------|
| **Advisory** | Migração opcional, SDK antigo ainda funciona | Nota no CHANGELOG, prazo frouxo |
| **Compulsório** | Vulnerabilidade de segurança, modelo depreciado com deadline, breaking change com data anunciada | Deadline explícito, migration guide detalhado, suporte ativo |

Default: advisory. Compulsório requer: migration guide completo + foundry-doctor passando + re-eval se modelo mudou.

## A Regra do Churn

Se você é o mantenedor do Foundry e bumpa uma versão com breaking change, você é responsável por:
- Entregar migration guide em `CHANGELOG.md` e `INSTALL.md`
- Atualizar `scripts/foundry-sync.sh` para automatizar o que for automável
- Suportar a versão anterior por pelo menos uma onda (N-1)

Não anuncie breaking change e deixe o consumer resolver sozinho.

## Racionalizações Comuns

| Racionalização | Realidade |
|---|---|
| "Ainda funciona, por que migrar?" | SDK funcionando com API depreciada acumula débito de segurança. O prazo de remoção da Anthropic não negocia. |
| "A migração de modelo vai mudar os resultados do eval" | Vai mesmo — é por isso que re-eval é obrigatória. Descubra o impacto antes de ir para produção. |
| "Posso manter os dois adapters indefinidamente" | Dois adapters fazendo a mesma coisa dobra manutenção, testes e onboarding. |
| "O Foundry vai deprecar esta skill, mas depois" | Planejamento de deprecação começa no design. Skills sem uso ativo devem ter prazo de remoção. |
| "Os consumers vão migrar por conta própria" | Não vão. Entregar foundry-doctor + migration guide + scripts de sync é responsabilidade do mantenedor. |

## Red Flags

- Adapter usando SDK com versão depreciada pela Anthropic (verificar em source-driven-implementation)
- Modelo hardcoded fora de TenantContext e adapters (viola C8 — impede migração sem re-deploy)
- Migração de modelo sem re-eval (a mudança de modelo SEMPRE afeta saída)
- Skills ou commands no manifest sem consumer ativo há 3+ meses
- Breaking change de Foundry sem migration guide no CHANGELOG
- Consumer project com _foundry_version desatualizado há mais de 2 versões MINOR

## Verificação

Após completar uma migração:

- [ ] Substituto provado em produção ou SHADOW (não apenas "teoricamente funciona")
- [ ] Migration guide existe com passos concretos e exemplos
- [ ] Re-eval rodada se modelo ou comportamento de prompt mudou
- [ ] foundry-doctor passa com 0 FAILs
- [ ] C3 verificado se custo de inferência pode ter mudado (recalc se necessário)
- [ ] Código/adapter/skill antigo completamente removido (sem referências órfãs)
- [ ] Manifest atualizado — sem entradas para artefatos removidos
- [ ] Deprecation notices removidos (cumpriram seu propósito)
