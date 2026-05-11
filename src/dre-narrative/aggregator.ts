// Agregação determinística — sem LLM. Soma lançamentos classificados em estrutura DRE.

export interface DreLines {
  // Receitas
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  // Custos
  custosDiretos: number;
  lucroBruto: number;
  margemBruta: number; // %
  // Despesas operacionais
  despesasPessoal: number;
  prolabore: number;
  despesasAdm: number;
  despesasComerciais: number;
  despesasTi: number;
  despesasViagem: number;
  despesasJuridicas: number;
  despesasFinanceiras: number;
  outrasDespesas: number;
  totalDespesasOp: number;
  // Resultados
  ebitda: number;
  margemEbitda: number; // %
  depreciacao: number;
  ebit: number;
  receitaFinanceira: number;
  resultadoFinanceiro: number;
  resultadoAntesImpostos: number;
  impostos: number;
  lucroLiquido: number;
  margemLiquida: number; // %
  // Não-P&L (fora do resultado, mas no extrato)
  emprestimosEntrada: number;
  amortizacaoDividas: number;
  capex: number;
  transferenciaInterna: number;
  naoClassificado: number;
}

interface EntryRow {
  amountCents: number;
  direction: string;
  predictedCategory: string | null;
  confirmedCategory: string | null;
}

function effectiveCategory(e: EntryRow): string {
  return e.confirmedCategory ?? e.predictedCategory ?? "nao_classificado";
}

function sumBy(entries: EntryRow[], ...categories: string[]): number {
  return entries
    .filter((e) => categories.includes(effectiveCategory(e)))
    .reduce((acc, e) => acc + e.amountCents, 0);
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // 2 casas decimais
}

export function aggregateDre(entries: EntryRow[]): DreLines {
  const receitaBruta    = sumBy(entries, "receita_bruta");
  const deducoes        = sumBy(entries, "deducoes_receita");
  const receitaLiquida  = receitaBruta - deducoes;

  const custosDiretos   = sumBy(entries, "cpv_cmv", "custo_servicos");
  const lucroBruto      = receitaLiquida - custosDiretos;

  const despesasPessoal    = sumBy(entries, "despesas_pessoal");
  const prolabore          = sumBy(entries, "prolabore");
  const despesasAdm        = sumBy(entries, "despesas_administrativas");
  const despesasComerciais = sumBy(entries, "despesas_comerciais");
  const despesasTi         = sumBy(entries, "despesas_ti");
  const despesasViagem     = sumBy(entries, "despesas_viagem");
  const despesasJuridicas  = sumBy(entries, "despesas_juridicas");
  const despesasFinanceiras = sumBy(entries, "despesas_financeiras");
  const outrasDespesas     = sumBy(entries, "outras_despesas", "outras_receitas");

  const totalDespesasOp = despesasPessoal + prolabore + despesasAdm + despesasComerciais +
    despesasTi + despesasViagem + despesasJuridicas + despesasFinanceiras + outrasDespesas;

  const ebitda     = lucroBruto - totalDespesasOp;
  const depreciacao = sumBy(entries, "depreciacao");
  const ebit       = ebitda - depreciacao;

  const receitaFinanceira   = sumBy(entries, "receita_financeira");
  const resultadoFinanceiro = receitaFinanceira - despesasFinanceiras;

  const resultadoAntesImpostos = ebit + resultadoFinanceiro;
  const impostos   = sumBy(entries, "simples_nacional", "irpj_csll");
  const lucroLiquido = resultadoAntesImpostos - impostos;

  return {
    receitaBruta, deducoes, receitaLiquida,
    custosDiretos, lucroBruto, margemBruta: pct(lucroBruto, receitaLiquida),
    despesasPessoal, prolabore, despesasAdm, despesasComerciais,
    despesasTi, despesasViagem, despesasJuridicas, despesasFinanceiras, outrasDespesas,
    totalDespesasOp,
    ebitda, margemEbitda: pct(ebitda, receitaLiquida),
    depreciacao, ebit,
    receitaFinanceira, resultadoFinanceiro,
    resultadoAntesImpostos, impostos,
    lucroLiquido, margemLiquida: pct(lucroLiquido, receitaLiquida),
    // Não-P&L
    emprestimosEntrada: sumBy(entries, "emprestimos_entrada"),
    amortizacaoDividas: sumBy(entries, "amortizacao_dividas"),
    capex:              sumBy(entries, "capex"),
    transferenciaInterna: sumBy(entries, "transferencia_interna"),
    naoClassificado:    sumBy(entries, "nao_classificado"),
  };
}

export function formatDreForPrompt(dre: DreLines, referenceMonth: string): string {
  const brl = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  return `DRE FACILITADO — ${referenceMonth}

RECEITAS
  Receita Bruta:          ${brl(dre.receitaBruta)}
  (-) Deduções:           ${brl(dre.deducoes)}
  = Receita Líquida:      ${brl(dre.receitaLiquida)}

CUSTOS
  (-) Custos Diretos:     ${brl(dre.custosDiretos)}
  = Lucro Bruto:          ${brl(dre.lucroBruto)} (margem ${dre.margemBruta}%)

DESPESAS OPERACIONAIS
  Pessoal (CLT):          ${brl(dre.despesasPessoal)}
  Pró-labore:             ${brl(dre.prolabore)}
  Administrativas:        ${brl(dre.despesasAdm)}
  Comerciais/Marketing:   ${brl(dre.despesasComerciais)}
  TI e Tecnologia:        ${brl(dre.despesasTi)}
  Viagem:                 ${brl(dre.despesasViagem)}
  Jurídicas/Contábeis:    ${brl(dre.despesasJuridicas)}
  Financeiras:            ${brl(dre.despesasFinanceiras)}
  Outras:                 ${brl(dre.outrasDespesas)}
  TOTAL Despesas Op.:     ${brl(dre.totalDespesasOp)}

RESULTADOS
  = EBITDA:               ${brl(dre.ebitda)} (margem ${dre.margemEbitda}%)
  (-) Depreciação:        ${brl(dre.depreciacao)}
  = EBIT:                 ${brl(dre.ebit)}
  Resultado Financeiro:   ${brl(dre.resultadoFinanceiro)}
  = Antes de Impostos:    ${brl(dre.resultadoAntesImpostos)}
  (-) Impostos:           ${brl(dre.impostos)}
  = LUCRO LÍQUIDO:        ${brl(dre.lucroLiquido)} (margem ${dre.margemLiquida}%)

NÃO-P&L (não impactam resultado)
  Entradas de Empréstimos: ${brl(dre.emprestimosEntrada)}
  Amortização de Dívidas:  ${brl(dre.amortizacaoDividas)}
  CAPEX:                   ${brl(dre.capex)}
  Transferências Internas: ${brl(dre.transferenciaInterna)}
  Não Classificados:       ${brl(dre.naoClassificado)}`;
}
