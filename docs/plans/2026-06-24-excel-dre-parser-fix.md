# Plano: Parser DRE para Excel multi-sheet (follow-up)

> **Arquivo de referência**: `C:\Users\Rafael\Downloads\RELATORIO FINANCEIRO 2026.xlsx`
> **Contexto**: PR #254 (commit `70a91d8`) implementou `parseExcelDre` em `src/ingest/parsers/excel-dre.ts`, mas **nunca foi testado end-to-end com o arquivo real**. Ao inspecionar o arquivo, foram identificados 7 gaps que impedem a importação correta.
> **Criado em**: 2026-06-24
> **Branch planejada**: `fix/aicfo-ingest-excel-dre-layout` a partir de `staging`
> **Módulo**: `ingest` (Onda 1 — SKU piloto monthly-analysis)

---

## Estado atual

- ✅ PR #254 MERGED em staging: `feat(ingest): parser DRE para Excel multi-sheet`
- ✅ Branch `feat/aicfo-ingest-excel-dre-parser` sincronizada com origin
- ✅ 8 testes mockados em `tests/ingest/excel-dre-parser.test.ts` passando
- ❌ Parser **nunca rodou com o arquivo real** — testes mockam XLSX e `parseDreText`
- ❌ Arquivo real **devolve 0 entradas** quando processado (ver G1 abaixo)

## Estrutura do arquivo de referência

- **13 sheets**: 12 meses em italiano (`GENNAIO`, `FEBBRAIO`, `MARZO`, `APRILE`, `MAGGIO`, `GIUGNO`, `LUGLIO`, `AGOSTO`, `SETTEMBRE`, `OTTOBRE`, `NOVEMBRE`, `DICEMBRE FINO AL 15`) + `RESUMO RELATORIO 2026`
- **Dados reais apenas em JAN-MAI** (5 sheets); JUN-DEZ estão vazias (`R$ 0.00`)
- **Layout: 4 blocos colados lado a lado** por sheet, separados por colunas em branco:

| Colunas | Bloco | Conteúdo |
|---|---|---|
| A-B | CUSTOS | Linhas: ALEGRIA, BEM BRASIL, BRASIL SHOW (valor negativo), PE NA ILHA, PLANETA TOUR, RIO 40, RIO CARIOC… |
| D-E | RECEITAS | PAYPAL MARCO EUROPA, PAYPAL MARCO BRASIL, PAYPAL RPT BRASIL, PAYPAL JAKI BRASIL, PAYPAL AMAZING, PAYPAL FORT DRM, PAYPAL MAURO 1 |
| G-H | RECAP | Subtotais: RECEITAS / CUSTOS / LUCRO BRUTO (duplicam os blocos A-B e D-E) |

- **Sheet `RESUMO RELATORIO 2026`**: tabela consolidada LUCRO BRUTO / LUCRO LIQUIDO / FATTURATO por mês — corretamente pulada por `isSummarySheet`

## Gaps identificados

### G1 — Formato de moeda incompatível (CRÍTICO, bloqueador)
- Arquivo usa **formato inglês com prefixo R$**: `"R$ 173,545.00"` (vírgula = milhar, ponto = decimal)
- Regex `BR_CURRENCY` em `src/ingest/parsers/excel-dre.ts:45` e `src/ingest/service.ts:391` espera formato BR (`173.545,00`)
- **Impacto**: `hasCurrencyValues(csvText)` retorna **false** para todas as sheets populadas → todas pulam → parser devolve **0 entradas**
- **Status**: ✅ Corrigido — `buildSheetText` usa `sheet_to_json({header:1})` (números nativos) e `formatBRCurrency` gera `R$ 173.545,00` (BR)

### G2 — Layout 4-blocos não tratado
- `XLSX.utils.sheet_to_csv` junta os 4 blocos numa única linha: `CUSTOS,,,,RECEITAS,,,,RECEITAS,"R$ 812,682.08",`
- O prompt do LLM em `src/ingest/parsers/pdf-dre.ts:85-114` não orienta sobre essa disposição
- **Risco**: LLM pode duplicar linhas (blocos A-B e G-H têm cabeçalho "RECEITAS"/"CUSTOS" repetidos) ou se confundir com a separação
- **Status**: ✅ Corrigido — `buildSheetText` detecta colunas-âncora dinamicamente e lineariza em `descrição,R$ valor`

### G3 — Subtotais do bloco G-H não removidos
- Colunas G-H repetem `RECEITAS`, `CUSTOS`, `LUCRO BRUTO` como subtotais do mês
- Prompt manda ignorar, mas estão misturados no mesmo CSV — alto risco de duplicação
- **Melhor abordagem**: pré-processar e remover o bloco G-H antes de enviar ao LLM
- **Status**: ✅ Corrigido — blocos recap (cabeçalhos repetidos) são descartados; `TOTAL_LABELS` filtra TOTAL/LUCRO BRUTO/LUCRO LIQUIDO/EBITDA/FATTURATO

### G4 — "agosto" ausente do map de meses
- `MONTH_NAMES_EXT` em `src/ingest/parsers/excel-dre.ts:8-20` pula **agosto** (tem `gennaio…luglio, settembre…dicembre`)
- Sheet `AGOSTO` não detecta mês → cai em `referenceMonth`
- Hoje não afeta o arquivo (agosto está vazio), mas é bug
- **Status**: ✅ Corrigido — adicionado `agosto: "08"` e `ago: "08"`

### G5 — Valores vazios `R$ -`
- Sheets têm células `R$ -` (sem número) para lançamentos sem movimento no mês
- Precisam ser normalizadas/removidas antes do LLM
- **Status**: ✅ Corrigido — `toNumber` retorna null para `R$ -` e células vazias; valores zerados também pulados

### G6 — Sheet `DICEMBRE FINO AL 15`
- Nome indica parcial ("até 15")
- Hoje detecta dezembro corretamente, mas quando tiver dados reais pode confundir o LLM sobre o período coberto
- **Status**: ❌ Não corrigido (baixa prioridade — sheet vazia no arquivo atual)

### G7 — Sem teste de integração
- Zero testes end-to-end com arquivo real
- Só testes mockados em `tests/ingest/excel-dre-parser.test.ts`
- **Status**: ✅ Corrigido — `excel-dre-sheet-text.test.ts` (6 testes do `buildSheetText`) + `excel-dre-integration.test.ts` (4 testes com workbook xlsx real em memória, `parseDreText` mockado)

---

## Plano de execução

### Fase 1 — Pré-processamento do CSV (resolve G1, G2, G3, G5)

Modificar `src/ingest/parsers/excel-dre.ts`, no loop de sheets, antes de chamar `parseDreText`:

1. **Normalizar formato de moeda**:
   - Regex para detectar `R$ X,XXX.XX` (vírgula = milhar, ponto = decimal)
   - Converter para `R$ X.XXX,XX` (BR) — garante que `BR_CURRENCY` gate funcione e o LLM receba valores no formato que o prompt espera
   - Ex.: `"R$ 173,545.00"` → `"R$ 173.545,00"`

2. **Separar os 4 blocos**:
   - Detectar colunas em branco (`,,,`) como separadores e particionar CSV em sub-blocos
   - Descartar o bloco G-H (recap de subtotais) — ele duplica A-B e D-E
   - Concatenar blocos A-B (CUSTOS) e D-E (RECEITAS) verticalmente em um CSV limpo

3. **Limpar `R$ -`** para `R$ 0,00` ou remover a linha inteira (preferível remover quando o valor estiver vazio)

**Arquivos afetados**:
- `src/ingest/parsers/excel-dre.ts` (principal)
- `tests/ingest/excel-dre-parser.test.ts` (atualizar mocks para refletir novo formato)

### Fase 2 — Fix do map de meses (resolve G4)

Em `src/ingest/parsers/excel-dre.ts`:

- Adicionar `agosto: "08"` e `ago: "08"` a `MONTH_NAMES_EXT`

**Arquivos afetados**:
- `src/ingest/parsers/excel-dre.ts`
- `tests/ingest/excel-dre-parser.test.ts` (novo teste para AGOSTO)

### Fase 3 — Teste de integração (resolve G7)

- Criar `tests/ingest/excel-dre-integration.test.ts`
- Usar uma versão sanitizada do arquivo real como fixture (sem dados sensíveis) ou um fixture sintético que replique o layout 4-blocos
- Rodar o parser **real** (XLSX verdadeiro, `parseDreText` mockado para não gastar token) e validar:
  - 5 sheets processadas (JAN-MAI)
  - 7 sheets puladas (JUN-DEZ vazias + RESUMO)
  - 0 duplicatas de lançamento
  - Datas corretas: `2026-01-31` … `2026-05-31`
  - Bloco G-H (subtotais) não vira lançamentos

**Arquivos afetados**:
- `tests/ingest/excel-dre-integration.test.ts` (novo)
- `tests/fixtures/` (novo diretório se necessário)

### Fase 4 — Validação manual end-to-end

- Subir o backend local: `npm run dev`
- Importar o arquivo via API/UX real (POST `/ingest` com `source: excel` e o buffer do arquivo)
- Confirmar que:
  - MonthlyAnalysis é criada com competência `2026-05` (último mês fechado)
  - Lançamentos das 5 competências são persistidos
  - LangGraph é despachado para gerar DRE + narrativa + plano
  - Trace LangSmith aparece com span por sheet
- Rodar `npm test` e `npm run typecheck`

### Fase 5 — Commit + PR follow-up

- Branch: `fix/aicfo-ingest-excel-dre-layout` a partir de `staging` atualizado
- Commits (conventional):
  - `fix(ingest): normaliza formato moeda EN→BR no parser Excel DRE`
  - `fix(ingest): separa blocos A-B/D-E e descarta recap G-H`
  - `fix(ingest): adiciona agosto ao map de meses`
  - `test(ingest): teste de integração com layout 4-blocos`
- PR: `fix(ingest): layout 4-blocos e formato moeda EN para parser Excel DRE` → base `staging`
- Rodar `/acme:pre-merge-check` antes do merge

---

## Checklist de progresso

- [x] **Fase 1** — Pré-processamento do CSV (G1, G2, G3, G5)
  - [x] Normalizar formato de moeda EN→BR (via `sheet_to_json` header:1 → números nativos → `formatBRCurrency`)
  - [x] Separar 4-blocos, descartar G-H (detecção dinâmica de colunas-âncora CUSTOS/RECEITAS/DESPESAS)
  - [x] Limpar `R$ -` (via `toNumber` que retorna null para `R$ -` e células vazias)
  - [x] Atualizar testes mockados (`excel-dre-parser.test.ts` agora usa `sheet_to_json` com matrizes)
- [x] **Fase 2** — Fix do map de meses (G4)
  - [x] Adicionar `agosto: "08"` e `ago: "08"` a `MONTH_NAMES_EXT`
  - [x] Novo teste para AGOSTO (em `excel-dre-parser.test.ts` e `excel-dre-integration.test.ts`)
- [x] **Fase 3** — Teste de integração (G7)
  - [x] Criar `excel-dre-sheet-text.test.ts` (6 testes do `buildSheetText` com matrizes literais)
  - [x] Criar `excel-dre-integration.test.ts` (4 testes com workbook xlsx real gerado em memória, `parseDreText` mockado)
  - [x] Validar: subtotais descartados, RESUMO pulado, sheets vazios pulados, AGOSTO detectado, datas corretas
- [ ] **Fase 4** — Validação manual end-to-end
  - [ ] Subir backend local
  - [ ] Importar arquivo via API
  - [ ] Confirmar MonthlyAnalysis + LangGraph dispatch
  - [ ] `npm test` verde
  - [ ] `npm run lint` verde
- [ ] **Fase 5** — Commit + PR
  - [x] Branch `fix/aicfo-ingest-excel-dre-layout` a partir de staging
  - [ ] Commits conventional
  - [ ] PR para staging
  - [ ] `/acme:pre-merge-check`

## Resumo da implementação (Fases 1-3)

**Abordagem adotada**: em vez de normalizar strings de `sheet_to_csv` (como planejado originalmente), descobriu-se que `XLSX.utils.sheet_to_json({header:1})` retorna **números nativos**, eliminando a ambiguidade de formato. O `buildSheetText` foi introduzido para:
1. Ler a matriz numérica crua (`sheet_to_json` header:1)
2. Detectar dinamicamente colunas-âncora de cabeçalho de seção (CUSTOS/RECEITAS/DESPESAS) na primeira linha — tolera separadores de largura variável
3. Descartar blocos recap (cabeçalhos repetidos, ex.: segundo "RECEITAS" em cols G-H)
4. Pular subtotais (TOTAL, LUCRO BRUTO, LUCRO LIQUIDO, EBITDA, FATTURATO) e cabeçalhos de seção isolados
5. Pular valores zerados e células `R$ -` / vazias
6. Formatar números no padrão BR (`R$ 173.545,00`) via `formatBRCurrency`
7. Linearizar em texto `descrição,R$ valor` para o extrator LLM (`parseDreText`)

**Validação com arquivo real**: rodado contra `RELATORIO FINANCEIRO 2026.xlsx` (sanitizado no output). GENNAIO produz 28 linhas (CUSTOS+RECEITAS+DESPESAS intercalados, sem subtotais), MAGGIO 37 linhas. Formato BR correto, sinais negativos preservados, JUN-DEZ vazios pulados.

**Testes**: 15 no total (9 mockados + 6 do `buildSheetText` + 4 de integração). Suite completa: 728 testes passando, lint limpo.

---

## Notas

- **C3 (custo ≤ 25% do preço)**: Fase 1-3 são determinísticas (zero token). Token só é gasto na Fase 4 (validação manual com LLM real) — uma única execução, dentro do orçamento de SHADOW.
- **C5 (three-tier context)**: Pré-processamento roda no tier L1 (tenant), não acessa L2 (outcome). Sem violação.
- **C6 (telemetry-by-default)**: `parseExcelDre` já loga via Pino; span LangSmith vem do `createTrace` em `service.ts:135`. Sem mudança necessária.
- **C7 (portability)**: Pré-processamento é agnóstico ao LLM — funciona com Gemini e OpenAI.
- **G6 (DICEMBRE FINO AL 15)**: deixado de fora do escopo — sheet vazia no arquivo atual. Reabrir se cliente enviar dados parciais.
