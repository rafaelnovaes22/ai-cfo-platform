---
adr: "ADR-018"
title: "Exceção à ADR-016 — resumo agregado de fluxo de caixa em texto no WhatsApp"
status: "aceita"
date: "2026-06-05"
deciders: ["Rafael Novaes"]
ratified_by: "the CEO (CEO) — aprovação verbal/informal, 2026-06-05 (sem documento assinado)"
pending_review: ["DPO/jurídico"]
constitution_principles: ["C2", "C4", "C6"]
supersedes: null
amends: "ADR-016 (Regra 1, parcialmente)"
related: ["ADR-014", "ADR-016", "ADR-017"]
---

# ADR-018 — Exceção à ADR-016: resumo agregado de fluxo de caixa em texto no WhatsApp

> **Aprovação:** aceita pelo operador (Rafael Novaes) em 2026-06-05 e ratificada pela CEO
> (verbal/informal) na mesma data. Revisão DPO/jurídico permanece **pendente** (ver §Aprovação).

## Contexto

A [ADR-016](016-whatsapp-lgpd-security.md), **Regra 1**, determina que *nenhum lançamento
financeiro, valor de DRE, KPI numérico ou conteúdo de relatório* seja enviado como texto em
mensagem WhatsApp — tudo via URL assinada (Regra 2, TTL 24h). A ADR-016 foi assinada em
2026-05-29, antes do outcome de **fluxo de caixa via WhatsApp** amadurecer.

A implementação atual do canal **diverge** dessa regra para o fluxo de caixa:

- [`formatCashflowSummary`](../../src/channels/whatsapp/response-formatter.ts) envia **saldo,
  entradas e saídas em R$ como texto** (resumo diário, comando "caixa"/"hoje").
- [`formatCashflowStatement`](../../src/channels/whatsapp/response-formatter.ts) envia
  **totais de entradas/saídas/resultado** do extrato do aluno como texto.
- A análise mensal (DRE/PDF) **respeita** a ADR-016 — [`formatAnalysisReady`](../../src/channels/whatsapp/response-formatter.ts)
  só diz "acesse o app", sem valores.

Há uma tensão real de produto: o valor central do free tier de estudante e do comando "caixa"
é **receber o número no WhatsApp em segundos**. Forçar "clique no link para ver" degrada o
outcome contratável (`cashflow_summary_sent`, `cashflow_from_statement` — ver
[spec §1](../specs/whatsapp-channel.md)).

Quanto à LGPD: o envio é do dado **do próprio titular, para o próprio titular**, com **opt-in
explícito** (Art. 7, I) e finalidade definida — base legal legítima. O risco a endereçar é o
**Art. 46** (medida de segurança adequada), que motivou a Regra 1 da ADR-016: o dado em texto
persiste no histórico do device, backup em nuvem, é capturável por screenshot e exposto a
metadados Meta/BSP.

A decisão: **manter a ADR-016 como regra geral, abrindo uma exceção estrita e escopada para o
resumo *agregado* de caixa.**

## Decisão

### 1. Definição de "resumo agregado de caixa" (o que a exceção permite em texto)

Permitido enviar como texto **apenas**:
- Saldo (inicial/final/atual)
- Total de entradas e total de saídas no período
- Resultado do período (entradas − saídas)
- Contagem de lançamentos (quantidade, sem detalhe)
- Datas/range do período

### 2. O que permanece proibido em texto (ADR-016 Regra 1 intacta)

- **Lançamento individual** (descrição, valor de linha, data específica da transação)
- **Contraparte** (nome de cliente, fornecedor, favorecido)
- **Categoria/linha de DRE**, KPI detalhado
- **Conteúdo de relatório/PDF** ou análise mensal

Esses continuam exclusivamente via **URL assinada TTL 24h** (ADR-016 Regra 2 — inalterada).

### 3. Aceite de risco (Art. 46)

O risco de exposição do resumo agregado no histórico WhatsApp é **aceito** porque:
- **Baixa granularidade**: totais agregados revelam menos que lançamentos individuais ou DRE.
- **Dado do próprio titular**, comunicado ao próprio titular, com consentimento.
- **Alternativa degrada o outcome central** do free tier (número instantâneo no WhatsApp).
- O titular controla o canal: opt-in explícito, desabilitável a qualquer momento.

### 4. Condições obrigatórias (mitigações mantidas)

- **Opt-in deve ser explícito sobre isto**: o aviso de privacidade da ativação (ADR-016 Regra 3,
  passo 2) **passa a informar literalmente** que *o resumo de caixa (saldo, entradas e saídas)
  será enviado em texto no WhatsApp e poderá ser visto por quem tiver acesso ao aparelho*.
- Canal nasce **desabilitado** (`whatsappEnabled = false`); envio só após opt-in (já implementado).
- Análise mensal, DRE, extrato detalhado e qualquer relatório seguem por **link assinado TTL 24h**.

### 5. Interação com a ADR-017 (log de mensagens)

A [ADR-017](017-whatsapp-message-log-retention.md) assumia que o `body` persistido era
não-sensível (contexto + link). Com esta exceção, o corpo de uma mensagem `daily_cashflow`
conteria **valores agregados**. Para preservar a baixa sensibilidade do log de retenção:

> O `WhatsappMessage.body` de mensagens do tipo `daily_cashflow` / `cashflow_from_statement`
> **não persiste os valores** — armazena um corpo redigido/templatizado (ex.: "resumo de caixa
> enviado") + metadados (`kind`, `status`, `createdAt`). O caso de uso do operador (ver o que
> foi enviado/suprimido) é atendido por `kind` + `status`, sem reter o número financeiro.

A ADR-017 deve ser ajustada para refletir essa regra de redação antes de sua implementação.

## Consequências

### Positivas
- Preserva o outcome central do WhatsApp (número instantâneo) — C2.
- Conflito ADR-016 ↔ implementação **registrado e resolvido** (sem drift silencioso).
- Mantém a proteção forte onde mais importa (DRE, lançamentos, relatórios via link).
- Log de retenção segue não-sensível (regra de redação §5).

### Negativas / Trade-offs aceitos
- Resumo agregado de caixa fica exposto no histórico do device/backup/screenshot — risco aceito.
- Aviso de opt-in fica mais longo (precisa descrever o que vai em texto).
- Ratificação CEO obtida de forma verbal/informal (sem documento assinado); revisão DPO/jurídico
  segue pendente — risco residual assumido conscientemente até a revisão (ver §Aprovação).
- Cria uma distinção "agregado vs detalhado" que o código precisa respeitar em qualquer
  formatter futuro de caixa (não voltar a listar lançamentos em texto).

## Alternativas descartadas

| Alternativa | Motivo do descarte |
|---|---|
| Conformar 100% à ADR-016 (só link, sem valores) | Degrada o outcome central do free tier (número instantâneo); escolhido não seguir. |
| Manter o status quo sem ADR | Deixa a implementação em violação não-registrada de ADR assinada (drift); reviewer DeepAgent penaliza. |
| Permitir também lançamentos individuais em texto | Alta granularidade + contraparte = risco Art. 46 desproporcional; mantido proibido. |
| Persistir os valores no log (ADR-017) | Amplia a superfície de retenção de dado financeiro sem ganho ao caso de uso do operador. |

## Aprovação

**Aprovado por**: the CEO (CEO) — ratificação **verbal/informal** em 2026-06-05.
**Proposto por**: Rafael Novaes (operador), aceito em 2026-06-05.

Registro fiel do estado do sign-off (artefato auditado pelo reviewer externo):

| Papel | Estado | Data | Observação |
|---|---|---|---|
| Operador (Rafael Novaes) | aceito | 2026-06-05 | Decisão de produto/risco. |
| CEO (the CEO) | ratificado — **verbal/informal** | 2026-06-05 | Sem documento assinado; concordância verbal registrada aqui. |
| DPO / jurídico | **pendente** | — | Revisão do aceite de risco (LGPD Art. 46) ainda não realizada. |

**Risco residual aceito**: o canal opera com a exceção (resumo agregado de caixa em texto)
enquanto a revisão DPO/jurídico não ocorre. Caso essa revisão futura exija mudança material,
o caminho é uma **nova ADR** que supersede esta (ADR assinada não se edita). Recomenda-se
concluir a revisão DPO/jurídico antes de promover o canal a AUTONOMOUS ou de ampliar a base
além do piloto/free tier.
