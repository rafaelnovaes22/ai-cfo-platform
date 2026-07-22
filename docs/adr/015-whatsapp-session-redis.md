---
adr: "ADR-015"
title: "Estado conversacional WhatsApp em Redis com TTL de 30 minutos"
status: "aceita"
date: "2026-05-29"
deciders: ["Rafael Novaes"]
constitution_principles: ["C7", "C8"]
supersedes: null
---

# ADR-015 — Estado conversacional WhatsApp em Redis com TTL de 30 minutos

## Contexto

O canal WhatsApp do Aicfo opera como uma conversa multi-turno: o usuário envia uma mensagem, o sistema responde, e a conversa evolui por vários passos (autenticação por telefone, seleção de empresa, escolha de análise, entrega de resultado). Entre as mensagens de um mesmo usuário é necessário manter:

- Qual tenant está associado ao número de telefone
- Em qual passo do fluxo conversacional o usuário se encontra (`step`)
- Contexto acumulado da sessão (ex.: empresa selecionada, período de análise solicitado)

Esse estado é **efêmero por natureza**: se o usuário abandonar a conversa por mais de 30 minutos, o próximo contato deve reiniciar o fluxo do zero, sem criar inconsistências.

O projeto já utiliza **ioredis** para BullMQ (filas de jobs). A infraestrutura Redis está provisionada e operacional no stack atual — adicionar uso de sessão não requer nenhum novo serviço.

Alternativas avaliadas para persistência de sessão:

1. **Redis (ioredis, já disponível)**: armazenamento em memória com TTL nativo, sem schema, sem migration, aproveitamento de infra existente.
2. **PostgreSQL (Prisma)**: banco relacional já em uso para dados permanentes (tenants, análises). Sessão conversacional é dado temporário — persistir em banco relacional gera overhead de transação, write amplification e ruído no schema para um dado que expira em minutos.
3. **Memória do processo (in-process Map)**: simples, mas não sobrevive a restart do servidor e não funciona em múltiplos workers/réplicas.

## Decisão

Armazenar o estado conversacional WhatsApp exclusivamente em **Redis via ioredis** com TTL de **30 minutos**, reutilizando a conexão já estabelecida pelo BullMQ.

### Estrutura da chave

```
whatsapp:session:{phoneE164}
```

- `phoneE164`: número de telefone no formato E.164 (ex.: `+5511999990000`)
- Valor: JSON serializado com o tipo `WhatsAppSession`:

```typescript
interface WhatsAppSession {
  tenantId: string;          // UUID do tenant autenticado
  step: WhatsAppStep;        // passo atual do fluxo conversacional
  context: Record<string, unknown>; // dados acumulados na sessão
  expiresAt: string;         // ISO 8601 — informacional, TTL real gerenciado pelo Redis
}
```

### Operações canônicas

| Operação | Comando Redis | Notas |
|---|---|---|
| Criar/atualizar sessão | `SET whatsapp:session:{phone} {json} EX 1800` | TTL em segundos (30 min) |
| Ler sessão | `GET whatsapp:session:{phone}` | null = sessão expirada ou inexistente |
| Encerrar sessão explicitamente | `DEL whatsapp:session:{phone}` | logout ou conclusão do fluxo |

A implementação vive em `src/channels/whatsapp/session.ts` e expõe interface `IWhatsAppSessionStore`. A dependência concreta de ioredis fica isolada nesse módulo — conforme C7, a camada de fluxo conversacional não importa ioredis diretamente.

## Consequências

### Positivas

- **Zero overhead de infra**: Redis já está provisionado para BullMQ. Nenhum novo serviço, nenhuma nova variável de ambiente, nenhum custo adicional.
- **TTL nativo**: limpeza automática de sessões expiradas pelo Redis, sem job de manutenção. Usuário inativo por 30 min recomeça o fluxo — comportamento correto e esperado.
- **Sem migration de banco**: dados de sessão não poluem o schema PostgreSQL. `prisma migrate dev` não é afetado.
- **Performance**: reads/writes de sessão em sub-milissegundo — latência imperceptível no contexto de mensagens WhatsApp (que já têm latência de rede).
- **Multi-replica seguro**: múltiplos workers do Fastify compartilham o mesmo Redis, garantindo consistência de sessão entre instâncias.
- **Portabilidade (C7)**: interface `IWhatsAppSessionStore` permite trocar Redis por outro store (ex.: Upstash, Valkey) sem alterar a camada de fluxo.
- **Sem anti-customização heroica (C8)**: sem lógica complexa de expiração customizada — Redis TTL resolve o problema de forma padrão.

### Negativas / Trade-offs aceitos

- **Sessões perdem-se em flush do Redis**: se o Redis for reiniciado com flush (ex.: `FLUSHALL` acidental, ou mudança de plano), todas as sessões ativas são perdidas. Mitigação: TTL de 30 min limita impacto — o usuário reinicia o fluxo sem perda de dado permanente (dados financeiros estão no PostgreSQL).
- **30 minutos pode ser curto para alguns fluxos**: usuário que sai para buscar um dado e volta após 31 minutos recomeça do zero. Esse comportamento é documentado na UX do canal.
- **Sem histórico de sessões encerradas**: sessões expiradas desaparecem; não há log de sessões para auditoria de comportamento conversacional. Se necessário no futuro, eventos de sessão podem ser enviados para o WireLog sem alterar esta decisão.

## Alternativas descartadas

| Alternativa | Motivo do descarte |
|---|---|
| PostgreSQL (tabela `whatsapp_sessions`) | Write amplification para dado efêmero; necessita migration; TTL via job agendado (complexidade extra). Viola C8 — é uma solução mais complexa para um problema simples. |
| In-process Map | Não sobrevive a restart; incompatível com múltiplas réplicas. Descartado imediatamente. |
| Redis com TTL > 1h | Sessões longas aumentam consumo de memória e risco de estado inconsistente. 30 min alinha com o timeout padrão de WhatsApp para "conversa ativa". |
