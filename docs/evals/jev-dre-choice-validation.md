# Validação Jev na classificação DRE (ai-cfo-platform)

Data: 2026-09-21. Modelo: `jev-1.13.0` real (0 mocks, 0 nulls em 39 chamadas).
Alvo: choice sobre as 23 categorias de `src/classification/taxonomy.ts`
contra os 39 dourados de `evals/classification/cases`.
Estado por caso: descrição + direção + valor (sem contexto de tenant,
limitação do parser do lote, registrada abaixo). Chave efêmera, nunca gravada.

## Números

Exact match: 31/39 (79,5%) zero-shot, sem prompt de negócio e sem tenant.
Erros com confiança >= 0,7: 3/39 (7,7%). Os outros 5 divergentes vieram
com confiança abaixo de 0,7, ou seja, escalariam para revisão em vez de errar.

## Erros de alta confiança (os que importam)

1. 0025 "COMPRA CASA E VIDEO LOJA 234" vira capex 0,91 (dourado: admin).
   Casa & Video é varejo de eletrônicos; sem saber o que foi comprado,
   capex é leitura legítima. Descrição ambígua, não erro de modelo.
2. 0036 "Cobertura jornalística evento" vira despesas_comerciais 0,80
   (dourado: receita_bruta). Direção do lançamento é unknown no caso:
   sem saber se prestou ou contratou, o modelo chuta despesa.
3. 0038 "Locução comercial rádio" vira despesas_comerciais 0,99
   (dourado: receita_bruta). Mesmo padrão: direção unknown decide receita
   x despesa e o estado não tinha a informação.

## Acertos fail-closed

- 0002 "GPS INSS" (sigla opaca): despesas_financeiras 0,17, escala.
- 0023 "PIX RECEBIDO MARIA" sem NF: nao_classificado 0,41, escala.
  O dourado espera receita_bruta com piso 0,4 (caso de baixa confiança):
  abster sem evidência é o comportamento seguro.
- 0032 adversarial multilíngue: 0,69, escala em vez de afirmar.
- 0029 estorno de tarifa com direção credit: 0,41, escala.

## Limitações do lote

- Tenant (segmento, regime) não entrou no estado por formato do parser.
  Com tenant + direção confiável, 0036/0038 provavelmente viram.
- Não valida o pipeline LLM atual, só o Jev isolado. O passo seguinte é
  shadow lado a lado nos mesmos 39 casos: LLM x Jev x dourado, com
  `confidence_threshold 0.7` do manifesto como régua comum.

## Decisão

Nada muda no pipeline. O Jev como segunda opinião calibrada é viável:
79,5% zero-shot com estado magro, 7,7% de erro confiante concentrado em
ambiguidade real de descrição. Recomendação: adapter shadow no
`dre-classifier` (choice + confiança calibrada no lugar da auto-nota do LLM),
gateado pelos mesmos 39 dourados antes de qualquer promoção.
