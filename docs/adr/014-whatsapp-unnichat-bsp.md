---
adr: "ADR-014"
title: "WhatsApp via Unnichat como BSP preferencial"
status: "aceita"
date: "2026-05-29"
deciders: ["Rafael Novaes"]
constitution_principles: ["C7"]
supersedes: null
---

# ADR-014 — WhatsApp via Unnichat como BSP preferencial

## Contexto

O WhatsApp é o canal de entrega principal do Aicfo para PMEs brasileiras — não um canal secundário. PMEs no ICP (R$ 500k–R$ 10M faturamento) operam primariamente via WhatsApp; qualquer produto B2B que exija instalação de app adicional perde adoção.

Para integrar com a WhatsApp Business API existem dois caminhos:

1. **Meta Cloud API direta**: a própria Meta disponibiliza acesso via `graph.facebook.com`. Requer abertura de Meta Business Account verificada, número de telefone dedicado, aprovação de templates de mensagem e pagamento na tabela de preços Meta sem desconto.

2. **BSP (Business Solution Provider)**: empresa intermediária homologada pela Meta que revende acesso à API com camada de suporte, pricing negociado e muitas vezes SDK proprietário REST.

A Unnichat é um BSP brasileiro, com operação focada em empresas de SaaS e startups nacionais. O CEO da Unnichat estabeleceu parceria direta com a Novais Digital/Aicfo, o que garante:
- Credenciais de WhatsApp Business API sem necessidade de conta Meta própria verificada
- Custo por conversa abaixo da tabela pública Meta
- Suporte em PT-BR com SLA para incidentes
- Free tier ativo com deadline 2026-06-02 (relevante para fase de desenvolvimento/staging)

O Aicfo já possui stack de integração HTTP (Fastify 5 + TypeScript) e não precisa de SDK específico — uma camada adapter REST é suficiente.

## Decisão

Usar **Unnichat** como BSP para todas as integrações WhatsApp Business do Aicfo em vez de acessar a Meta Cloud API diretamente.

O adapter será implementado em `src/channels/whatsapp/adapter.ts` e expõe a interface canônica `IWhatsAppAdapter` — conforme C7, o Aicfo não depende diretamente do contrato Unnichat em nenhuma camada acima do adapter.

O webhook de entrada (`POST /webhooks/whatsapp`) recebe eventos no formato Unnichat e os normaliza para o formato interno antes de propagar para o serviço de sessão.

## Consequências

### Positivas

- **Onboarding acelerado**: sem processo de verificação de Meta Business Account. Credenciais disponíveis via parceria já estabelecida.
- **Custo menor**: preço por conversa negociado abaixo da tabela pública Meta, melhorando a margem do canal e mantendo C3 (custo ≤ 25% do preço).
- **Suporte local**: incidentes de entrega de mensagem resolvidos em PT-BR com SLA, sem depender de suporte Meta em inglês.
- **Free tier para desenvolvimento**: janela até 2026-06-02 para desenvolver e testar sem custo de conversas.
- **Portabilidade preservada (C7)**: interface `IWhatsAppAdapter` isola o contrato Unnichat. Troca futura para Meta direto ou outro BSP requer apenas nova implementação do adapter — zero mudança em camadas superiores.

### Negativas / Trade-offs aceitos

- **Dependência de terceiro intermediário**: se a Unnichat tiver downtime, o canal WhatsApp fica indisponível mesmo que a Meta API esteja operacional. Mitigação: monitorar uptime Unnichat + manter plano de fallback documentado (troca de adapter em < 1 dia de trabalho).
- **Menor controle sobre limites de taxa**: a Unnichat aplica seus próprios rate limits sobre a tabela Meta. Limites devem ser mapeados antes do go-live.
- **Formato de webhook proprietário**: o formato de eventos Unnichat difere do formato Meta padrão. O adapter precisa manter mapeamento atualizado a cada mudança de versão da API Unnichat.
- **Risco de lock-in parcial por features exclusivas**: se funcionalidades como catálogos ou flows do WhatsApp forem usadas via Unnichat com abstrações proprietárias, a portabilidade se reduz. Regra: usar apenas primitivas mapeáveis para Meta nativo (`sendText`, `sendDocument`, `sendTemplate`).

## Alternativas descartadas

| Alternativa | Motivo do descarte |
|---|---|
| Meta Cloud API direta | Sem parceria = custo tabela padrão + processo de verificação de Business Account (prazo incerto) + suporte somente em inglês. Não viável no prazo do free tier (2026-06-02). |
| Twilio (BSP internacional) | Custo mais alto para volume BR; sem vantagem de parceria; latência maior para mensagens na região. |
| Outro BSP BR sem parceria estabelecida | Sem vantagem diferencial de custo nem de onboarding sobre Unnichat. |
