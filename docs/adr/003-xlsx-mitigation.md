---
adr_id: "003"
title: "Mitigação de vulnerabilidade alta em `xlsx` (SheetJS) sem fix upstream"
status: "aceita"
constitution_version: "0.2.0"
created_at: "2026-05-12"
last_updated: "2026-05-12"
authors: ["Rafael Novaes"]
supersedes: []
superseded_by: []
linked_principles: [C6, C8]
---

# ADR-003 — Mitigação de vulnerabilidades altas no `xlsx` (SheetJS) sem fix upstream

> **Status**: ✅ Aceita
> **Data**: 2026-05-12
> **Princípios Constitution afetados**: C6 (telemetry — auditoria de upload), C8 (defesa em profundidade no parser)

---

## 1. Contexto

`npm audit --omit=dev` aponta **1 vulnerabilidade `high` direta** no pacote
[`xlsx`](https://www.npmjs.com/package/xlsx) (versão `0.18.5`), encadeando dois CVEs:

- **GHSA-4r6h-8v6p-xvw6** — *Prototype Pollution in sheetJS*
- **GHSA-5pgg-2g8v-p4x9* — *Regular Expression Denial of Service (ReDoS)*

**Sem fix disponível no npm registry.** O autor (SheetJS LLC) parou de publicar
versões corrigidas no registry público a partir da v0.18.5 — atualizações de
segurança ficaram restritas ao registry pago `cdn.sheetjs.com`.

Trocar de dependência teria custo alto (parsing de Excel em Node ESM com
suporte a `.xlsx`/`.xls`/datas/locale BR não tem alternativa drop-in com a
mesma cobertura — `exceljs` cobre `.xlsx` mas não `.xls`, e tem sua própria
superfície CVE).

## 2. Decisão

**Mantém o `xlsx` 0.18.5** com mitigação defensiva em código + monitoramento de
audit em CI **não bloqueante para essa CVE específica** (mas o CI continua
rodando `npm audit` para captar regressões em OUTRAS deps).

### Mitigações aplicadas

#### 2.1. Limite duro de tamanho do arquivo
- `MAX_XLSX_BYTES = 20 MB` em [`src/ingest/parsers/excel.ts`](../../src/ingest/parsers/excel.ts).
- Buffer maior que isso é rejeitado **antes** do `XLSX.read()`.
- `@fastify/multipart` na rota `/ingest/upload` também tem `limits.fileSize = 20 MB`
  como primeira barreira.

#### 2.2. Limite duro de linhas
- `MAX_XLSX_ROWS = 50_000` aplicado via `sheetRows` do `XLSX.read()`.
- O parser também trunca defensivamente o array antes de iterar.
- Mitiga o ReDoS amplificando por massa.

#### 2.3. Acesso defensivo aos resultados
- `workbook.SheetNames[0]` e `workbook.Sheets[name]` são verificados antes de
  qualquer leitura. Não confiamos que o parser sempre devolva estruturas válidas.

#### 2.4. Sem confiança em campos do workbook
- Não lemos `workbook.Props`, `workbook.Custprops`, `WBView`, etc.
- Apenas `Sheets[0]` em modo `header: 1` (matriz de valores), o que reduz a
  superfície de prototype pollution drasticamente.

#### 2.5. Buffer entra, RawLedger sai
- O parser nunca expõe o objeto Sheet/Workbook ao restante do sistema. Apenas
  produz `RawLedger[]` (campos primitivos: `date: string`, `amountCents: number`, etc.).
- Qualquer protótipo poluído ficaria contido no escopo do parser.

#### 2.6. Auditoria de upload
- A rota `/ingest/upload` já carrega `requireAuth` + `requireScope("ingest:write")`.
- A `service.ts` do ingest emite trace Langfuse com `tenantId`, `source`, contagem
  de entries e órfãos (C6).

### Não mitigado (risco residual)

- **Prototype pollution no `XLSX.read()`**: se o autor da planilha conseguir
  embarcar um payload malicioso que polua `Object.prototype` durante o parse, o
  contágio pode escapar do parser. Não conseguimos isolar em VM/worker sem custo
  de complexidade alto.
  - **Compensação parcial**: o backend é stateless por request, o pool de
    workers BullMQ é separado, e `tenantId` sempre vem do JWT (não do payload),
    então pollution não muda decisão de tenant ou autorização.
- **ReDoS persiste como possibilidade** se uma string específica passar pelos
  limites de tamanho/linhas. Mitigação efetiva exigiria isolar o parser em
  worker thread com timeout — TODO para Onda C+ se uploads aumentarem ICP.

## 3. Plano de saída

- **T+30 dias**: revisar se SheetJS publicou correção pública (acompanhar
  [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6)).
- **T+60 dias**: se sem progresso, prototipar substituição por `exceljs`+`csv-parse`
  para `.xlsx`+`.csv` (cobrindo ≥80% dos uploads reais). `.xls` legado pode ser
  bloqueado com warning ao cliente.
- **T+90 dias**: se substituição viável, abrir ADR-004 propondo a migração.

## 4. Decisão operacional sobre `npm audit` no CI

- O workflow CI roda `npm audit --omit=dev` mas **não falha** o build pelo
  resultado dessa CVE específica.
- A vulnerabilidade está documentada aqui; auditoria mensal (DeepAgent reviewer)
  inclui revisar progresso do plano de saída.

## 5. Aprovação

- [x] Tech Lead (Rafael) leu e aceitou risco residual
- [ ] CEO ciente (informativo — risco operacional baixo)
- [x] Mitigação aplicada e testada (build/typecheck passa)

## 6. Histórico

| Data | Mudança | Autor |
|---|---|---|
| 2026-05-12 | ADR inicial — mitigação + plano de saída | Rafael Novaes |
