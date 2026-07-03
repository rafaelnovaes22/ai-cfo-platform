# QA funcional do pipeline de análise — evidência Gate 0.1

**Data:** 2026-07-03 · **Ambiente:** staging (código idêntico a prod, release #289) · **Fonte:** planilha real de ano completo (`RELATORIO FINANCEIRO 2026.xlsx`, sheets mensais em italiano, dados jan-mai) · **Método:** gabarito determinístico calculado direto do xlsx (via `buildSheetText`, sem LLM) comparado com o banco e o `dreJson` do tenant de QA que importou a planilha.

## 1. Fidelidade da extração (LLM): 100%

Todos os meses bateram exatos em valor E contagem de lançamentos:

| Mês | Receitas (gabarito = banco) | Débitos (gabarito = banco) | Lançamentos |
|---|---|---|---|
| 2026-01 | 812.682,08 | 490.195,10 | 9 + 19 ✅ |
| 2026-02 | 1.221.391,46 | 688.471,72 | 9 + 19 ✅ |
| 2026-03 | 685.813,60 | 453.802,00 | 8 + 24 ✅ |
| 2026-04 | 641.726,01 | 410.625,00 | 9 + 23 ✅ |
| 2026-05 | 493.118,81 | 309.259,71 | 9 + 28 ✅ |

Nenhum lançamento perdido, duplicado ou com valor alterado na extração via LLM.

## 2. DRE de janeiro (validação do plano)

Contra o gabarito da sheet GENNAIO: receita 812.682,08 ✅ · custos 348.713,00 ✅ · despesas 141.482,10 ✅ (jurídicas 100.500 + pessoal 23.300 + comerciais 13.482,10 + adm 4.200) · lucro bruto 463.969,08 ✅ · lucro líquido 322.486,98 ✅.

## 3. DRE agregado do período

`receitaBruta` e `custosDiretos` exatos. Duas divergências vs. o gabarito ingênuo, ambas comportamento correto:

- **Deduções R$ 6.200**: 2 lançamentos "RIMBORSI CLIENTI" (reembolsos a clientes) classificados como `deducoes_receita` — tratamento contábil mais correto que somá-los a despesas.
- **`nao_classificado` R$ 7.449 (0,19% da receita)**: 2 lançamentos de rótulo críptico ("PARC", "IA") ficaram fora do lucro por design — o valor é rastreado na linha `naoClassificado` do DRE e dispara anomalia `unclassified_volume` a partir de 5% da receita ([financial-diagnosis.ts](../../src/monthly-analysis/agents/financial-diagnosis.ts)). Abaixo do limiar, imaterial.

## 4. Ano e meses futuros

- Ano inferido do filename (2026): todas as datas no banco são 2026 ✅.
- Sheets jun-dez sem valores → nenhum mês fantasma/zerado no banco (só 2026-01..05) ✅. Ressalva: a planilha não tinha sheet futura COM valores, então o guard `isFutureMonth` não foi exercitado com dado real nesta rodada (coberto por teste unitário do parser).

## Veredicto: PASSOU

Nenhum bug encontrado. O pipeline extrai com fidelidade total e o DRE diverge do somatório ingênuo apenas onde a contabilidade manda divergir. Gate 0.1 fechado; Gate 0 completo.
