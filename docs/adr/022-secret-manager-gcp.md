---
adr: 022
title: GCP Secret Manager como vault de secrets (GitOps)
status: accepted
date: 2026-06-29
deciders: Rafael Novaes (Engenheiro de IA, Novais Digital) — custo reportado à CEO (the CEO)
linked_principles: [C7]
linked_artifacts:
  - src/llm/adapters/google.ts
  - railway.toml
supersedes: null
superseded_by: null
related: [009, 012]
---

# ADR-022 — GCP Secret Manager como vault de secrets

## Contexto

Hoje os secrets vivem como env vars no dashboard do Railway (não commitados, injetados em runtime; GCP SA via JSON inline). Funciona, mas: (1) são **mutáveis fora da esteira** — qualquer um com acesso ao dashboard altera produção sem PR, o que contraria o objetivo de **GitOps total** (toda mudança via PR); (2) **sem rotação automática nem trilha de auditoria de acesso**. Com o piloto escalando para milhares de clientes, o volume e a sensibilidade dos secrets crescem.

Avaliamos GCP Secret Manager, Doppler, Infisical (cloud/self-hosted) e o status quo (Railway env vars). Comparativo de custo no roadmap (`bubbly-purring-book.md`, Anexo A).

## Decisão

Adotar **GCP Secret Manager** como fonte de verdade de secrets.

Justificativa: o projeto já roda no GCP (Vertex AI, ADR-009/019), então reusa a Service Account existente e a região; tem **rotação e auditoria de acesso nativas**; e é o **menor custo** das opções com essas garantias (~US$ 2-5/mês no volume do Aicfo — $0,06/versão ativa + $0,03/10k acessos, com 6 versões e 10k acessos grátis), **sem adicionar fornecedor**. Doppler (~US$36-56/mês) só se justificaria por DX de equipe acima de custo; Infisical self-hosted adicionaria um serviço para operar.

## Consequências

- **GitOps**: nomes/referências de secret passam a ser versionados; o Railway recebe os valores via sync da esteira (ou o app lê na boot). Mudança de secret deixa de ser ad-hoc no dashboard.
- **C7 (portabilidade)**: a leitura de secrets fica atrás de uma abstração na borda de config (junto da config central Zod planejada), agnóstica ao provider — trocar de vault não vaza para o resto do código.
- **Custo**: ~US$3/mês (reportado à CEO).
- **Implementação faseada** (Gate 3 do roadmap, não neste ADR): (1) provisionar os secrets no Secret Manager; (2) abstração de leitura na boot + fallback para env var durante a transição; (3) reduzir acesso de escrita ao dashboard Railway. A migração não bloqueia os Gates 0-2.
- **Não cobre**: secrets de terceiros que exijam injeção em build-time (ex: `VITE_API_URL` do frontend permanece build-arg).
