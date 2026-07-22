---
adr: "ADR-016"
title: "LGPD e segurança no canal WhatsApp — dados financeiros via URL assinada e opt-in explícito"
status: "aceita"
date: "2026-05-29"
deciders: ["Rafael Novaes"]
constitution_principles: ["C2", "C4", "C6"]
supersedes: null
---

# ADR-016 — LGPD e segurança no canal WhatsApp — dados financeiros via URL assinada e opt-in explícito

## Contexto

O WhatsApp é o canal de entrega principal do Aicfo. Dados financeiros de PMEs — DRE, fluxo de caixa, KPIs, lançamentos — são dados sensíveis sob a LGPD (Lei 13.709/2018, especialmente Art. 5º XI e Art. 46).

O histórico de mensagens WhatsApp apresenta riscos de segurança que não existem em um portal web:

1. **Acesso físico ao dispositivo**: qualquer pessoa com o celular desbloqueado vê o histórico completo da conversa, incluindo dados financeiros.
2. **Screenshots são inevitáveis**: não existe mecanismo técnico para impedir que dados enviados como texto em uma mensagem sejam capturados em screenshot e redistribuídos.
3. **Backup em nuvem**: o WhatsApp faz backup do histórico em Google Drive ou iCloud, que podem não ter o mesmo nível de proteção do Aicfo.
4. **Metadados de mensagem**: a Unnichat e a Meta têm acesso aos metadados das conversas e potencialmente ao conteúdo das mensagens.

O Art. 46 da LGPD exige que o controlador adote medidas técnicas e administrativas para proteger dados pessoais de acessos não autorizados. Dados financeiros de empresas enquadram-se como dados de natureza sensível ao negócio — a exposição indevida pode causar dano patrimonial e competitivo ao titular.

A decisão central é: **como entregar relatórios financeiros ricos pelo WhatsApp sem que o dado financeiro viva em texto no histórico da conversa?**

## Decisão

Três regras de segurança obrigatórias para o canal WhatsApp, sem exceções:

### Regra 1 — Dados financeiros nunca como texto na conversa

Nenhum lançamento financeiro, valor de DRE, KPI numérico ou conteúdo de relatório é enviado como texto em uma mensagem WhatsApp. A mensagem de entrega contém apenas:
- Uma frase de contexto (ex.: "Sua análise de abril está pronta.")
- Um link ou documento com TTL de 24 horas

O dado financeiro fica no storage seguro do Aicfo, não no histórico do WhatsApp.

### Regra 2 — Relatórios entregues como URL assinada com TTL de 24 horas

PDFs, relatórios e documentos financeiros são entregues via `adapter.sendDocument()` usando uma **presigned URL** gerada pelo serviço de storage do Aicfo (AWS S3 ou equivalente).

Parâmetros da URL assinada:
- **TTL**: 24 horas a partir da geração
- **Escopo**: somente leitura (`GET`)
- **Binding por tenant**: a URL é gerada para o tenant específico; não é uma URL pública
- **Logging**: toda geração de URL assinada é registrada no WireLog com `{ tenantId, documentType, generatedAt, expiresAt }` (C6)

Após 24 horas, a URL expira e o documento não é mais acessível via WhatsApp. O cliente pode acessar o documento por tempo indefinido pelo portal web do Aicfo (onde a autenticação é controlada).

### Regra 3 — Opt-in explícito obrigatório antes de ativar o canal

O canal WhatsApp só é ativado para um tenant após **opt-in explícito e registrado**:

1. O usuário solicita ativação do canal no portal web do Aicfo
2. O sistema exibe aviso de privacidade informando: (a) que análises financeiras serão enviadas ao número fornecido, (b) que o histórico de mensagens pode ser visualizado por quem tiver acesso ao dispositivo, (c) como revogar o canal
3. O usuário confirma e o número de telefone é registrado em `TenantConfig.whatsappPhone` com `whatsappOptInAt: DateTime`
4. O canal só recebe/envia mensagens para números com `whatsappOptInAt` preenchido

O opt-in é registrado no audit log do tenant para rastreabilidade LGPD (Art. 7º e Art. 9º).

## Consequências

### Positivas

- **Conformidade LGPD (Art. 46)**: medidas técnicas concretas para proteção de dados financeiros no canal. Dados sensíveis não persistem em texto no histórico WhatsApp.
- **Janela de exposição curta**: URL assinada com TTL 24h limita o período em que um link comprometido pode ser usado. Após 24h, o dado não é mais acessível via WhatsApp, mesmo que o link tenha sido copiado.
- **Rastreabilidade (C6)**: geração de URL assinada e opt-ins registrados no WireLog permitem auditoria de acesso a dados financeiros por canal.
- **Outcome-first (C2)**: a entrega do relatório pelo WhatsApp é o outcome contratável — a regra de URL assinada não impede a entrega, apenas muda o veículo do dado sensível.
- **Consentimento documentado (LGPD Art. 7º)**: opt-in explícito com timestamp registrado satisfaz o requisito de base legal por consentimento.

### Negativas / Trade-offs aceitos

- **Fricção na UX de entrega**: o usuário precisa clicar em um link para ver o relatório, em vez de ler os dados diretamente na mensagem. Mitigação: a mensagem de entrega deve ser clara e direta ("Toque para abrir seu relatório — disponível por 24h").
- **Dependência de storage com presigned URL**: o serviço de storage deve suportar geração de URLs assinadas com expiração. AWS S3, Google Cloud Storage e equivalentes suportam isso nativamente.
- **TTL de 24h pode ser insuficiente para alguns usuários**: usuário que recebe a notificação à noite e tenta abrir no dia seguinte à tarde pode encontrar o link expirado. Mitigação: a mensagem informa o prazo explicitamente; o portal web tem acesso permanente.
- **Opt-in acrescenta etapa ao onboarding**: o usuário precisa ativar o canal no portal antes de usar — não é plug-and-play via WhatsApp puro. Esse trade-off é aceito: o opt-in protege o usuário e o Aicfo de ativações não solicitadas.

## Alternativas descartadas

| Alternativa | Motivo do descarte |
|---|---|
| Enviar dados financeiros como texto na mensagem | Viola LGPD Art. 46; dado fica exposto indefinidamente no histórico; screenshots redistribuem dados sensíveis sem controle. Descartado categoricamente. |
| URL assinada com TTL > 7 dias | Janela longa aumenta risco de link comprometido ser usado dias após a geração. TTL 24h é o equilíbrio entre usabilidade e segurança. |
| Opt-in implícito (primeiro contato ativa o canal) | Sem base legal documentada para LGPD; risco regulatório e reputacional. Descartado. |
| Criptografia ponta-a-ponta no WhatsApp | O WhatsApp já possui E2E para mensagens entre usuários, mas o Aicfo não tem controle sobre essa camada — e não impede acesso físico ao dispositivo. Não resolve o problema. |
