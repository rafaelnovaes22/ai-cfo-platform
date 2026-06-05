---
adr: "ADR-017"
title: "Log de mensagens WhatsApp — persistência, retenção e listagem para o operador"
status: "aceita"
date: "2026-06-05"
deciders: ["Rafael Novaes"]
constitution_principles: ["C2", "C6", "C8"]
supersedes: null
related: ["ADR-014", "ADR-016", "ADR-018"]
---

# ADR-017 — Log de mensagens WhatsApp — persistência, retenção e listagem para o operador

## Contexto

Hoje as mensagens enviadas pelo canal WhatsApp são *fire-and-forget*: o
[`notification-service.ts`](../../src/channels/whatsapp/notification-service.ts) chama o
adapter Unnichat e apenas emite um log estruturado via Pino. Nada é persistido em banco.

O operador (Rafael / CEO) precisa de uma visão **dentro do sistema** das mensagens que
o Aicfo enviou — ou deixou de enviar — a cada tenant. O caso de uso explícito que motivou
esta decisão: *"ver as mensagens que já foram enviadas, pro caso de eu não ter habilitado o
envio"*. Ou seja, é necessário registrar inclusive as tentativas **suprimidas** porque
`whatsappEnabled = false` ou `notificationsEnabled = false` — não só as efetivamente enviadas.

A spec [`whatsapp-channel.md`](../specs/whatsapp-channel.md) §2 e §8 declaram, na versão atual,
que o módulo expõe apenas `/webhooks/whatsapp` e não persiste mensagens ("Pino log"). Esta ADR
é o pré-requisito formal para amendar essa spec.

Persistir conteúdo de mensagem toca a LGPD (Lei 13.709/2018): retenção de dado pessoal exige
finalidade declarada e prazo definido (Art. 6º, I e V). A [`ADR-016`](016-whatsapp-lgpd-security.md)
já estabeleceu que **dados financeiros nunca trafegam como texto na conversa** — a mensagem
contém apenas frase de contexto + link assinado com TTL. Logo, o corpo que persistiríamos é,
por construção, **não-sensível** (contexto + URL expirável), o que reduz o risco de retenção.

## Decisão

### 1. Novo model `WhatsappMessage` (Prisma)

Tabela append-only que registra cada evento de canal, multi-tenant via `tenantId` (C8):

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid | PK |
| `tenantId` | string | FK Tenant (índice) |
| `direction` | enum `outbound` \| `inbound` | sentido da mensagem |
| `kind` | enum `daily_cashflow` \| `analysis_ready` \| `reply` \| `other` | tipo de notificação/evento |
| `body` | string | texto da mensagem (contexto + link; **sem dado financeiro**, por ADR-016) |
| `status` | enum `sent` \| `delivered` \| `read` \| `failed` \| `skipped_disabled` | resultado |
| `providerMessageId` | string? | id retornado pela Unnichat (null em `skipped_*`) |
| `error` | string? | motivo da falha quando `status = failed` |
| `createdAt` | DateTime | timestamp do evento |

O status `skipped_disabled` é o que atende ao caso de uso do operador: a notificação foi
**gerada mas suprimida** por opt-out do tenant. O `notification-service` passa a gravar essa
linha em vez de só retornar silenciosamente.

### 2. Pontos de escrita

- [`notification-service.ts`](../../src/channels/whatsapp/notification-service.ts): grava em
  cada envio (`sent`/`failed`) **e** em cada supressão (`skipped_disabled`).
- [`webhook.ts`](../../src/channels/whatsapp/webhook.ts): grava `inbound` ao receber mensagem
  e atualiza `status` via eventos `statuses` da Unnichat (`delivered`/`read`).

### 3. Endpoint de listagem

`GET /whatsapp/messages` — paginado, escopo do tenant autenticado, ordenado por `createdAt desc`.
Filtros opcionais: `status`, `direction`, `from`/`to` (data). Somente `admin`.

### 4. Retenção (LGPD Art. 6º, I e V)

- **Finalidade**: auditoria operacional do canal de entrega (transparência ao operador e ao
  titular sobre o que foi comunicado).
- **Prazo**: retenção de **180 dias**; um job agendado (BullMQ) apaga linhas com
  `createdAt < now() - 180d`. Prazo alinhado com a janela de auditoria mensal (Forge).
- **Conteúdo**: apenas contexto + link (não-sensível por ADR-016). Nenhum valor financeiro,
  CPF/CNPJ ou anexo é persistido no `body`.
- **Regra de redação (ADR-018 §5)**: mensagens de caixa (`daily_cashflow`,
  `cashflow_from_statement`) são enviadas ao titular com valores agregados em texto (exceção
  da ADR-018), mas o `body` **persistido aqui não guarda os valores** — armazena corpo
  redigido/templatizado + metadados (`kind`, `status`, `createdAt`). O caso de uso do operador
  (ver o que foi enviado/suprimido) é atendido por `kind` + `status`, mantendo o log não-sensível.
- O número de telefone do destinatário **não** é duplicado nesta tabela — vive em
  `Tenant.whatsappPhone`. O log referencia o tenant, não o número, minimizando dado pessoal.

## Consequências

### Positivas
- Operador enxerga o que foi enviado e o que foi suprimido — atende ao caso de uso (C2).
- Rastreabilidade do canal de entrega persistida e auditável (C6), complementando o Pino log.
- Risco LGPD contido: corpo não-sensível por construção + prazo de retenção definido.

### Negativas / Trade-offs aceitos
- Custo de escrita adicional por mensagem (1 insert) — desprezível no volume atual.
- Mais uma tabela e um job de expurgo para manter.
- Eventos de status da Unnichat (`delivered`/`read`) exigem casar `providerMessageId` —
  se a Unnichat não devolver o id de forma confiável, o status pode ficar em `sent`.

## Alternativas descartadas

| Alternativa | Motivo do descarte |
|---|---|
| Manter só Pino log e ler via ferramenta de observabilidade | Não atende "ver dentro do sistema"; operador não-técnico não consulta logs; logs têm retenção própria e não são consultáveis por tenant na UI. |
| Persistir o corpo financeiro completo da mensagem | Violaria ADR-016 (dado financeiro nunca em texto) e ampliaria o risco LGPD de retenção. |
| Retenção indefinida | Sem prazo viola LGPD Art. 6º, V (necessidade); 180 dias cobre a auditoria mensal. |
| Guardar o telefone destinatário em cada linha | Duplicação de dado pessoal sem ganho — o tenant já referencia o número. |
