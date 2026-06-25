// Agregação determinística — sem LLM. Soma lançamentos classificados em estrutura DRE.

export interface DreLines {
  // Receitas
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  // Custos
  custosDiretos: number;
  lucroBruto: number;
  margemBruta: number; // porcentagem 0–100
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
  outrasReceitasOp: number;
  totalDespesasOp: number;
  // Resultados
  ebitda: number;
  margemEbitda: number; // porcentagem 0–100
  depreciacao: number;
  amortizacao: number;
  ebit: number;
  margemOperacional: number; // porcentagem 0–100
  receitaFinanceira: number;
  resultadoFinanceiro: number;
  resultadoAntesImpostos: number;
  impostos: number;
  lucroLiquido: number;
  margemLiquida: number; // porcentagem 0–100
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

// EntryRow + competência (YYYY-MM) — base do run-rate mensal por categoria.
export interface DatedEntryRow extends EntryRow {
  month: string;
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
  return Math.round((numerator / denominator) * 10000) / 100;
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
  const outrasReceitasOp   = sumBy(entries, "outras_receitas_operacionais");

  // despesasFinanceiras pertence ao resultado financeiro, não ao operacional
  const totalDespesasOp = despesasPessoal + prolabore + despesasAdm + despesasComerciais +
    despesasTi + despesasViagem + despesasJuridicas + outrasDespesas - outrasReceitasOp;

  const ebitda      = lucroBruto - totalDespesasOp;
  const depreciacao = sumBy(entries, "depreciacao");
  const amortizacao = sumBy(entries, "amortizacao_ativos");
  const ebit        = ebitda - depreciacao - amortizacao;

  const receitaFinanceira   = sumBy(entries, "receita_financeira");
  const resultadoFinanceiro = receitaFinanceira - despesasFinanceiras;

  const resultadoAntesImpostos = ebit + resultadoFinanceiro;
  const impostos   = sumBy(entries, "simples_nacional", "irpj_csll");
  const lucroLiquido = resultadoAntesImpostos - impostos;

  return {
    receitaBruta, deducoes, receitaLiquida,
    custosDiretos, lucroBruto, margemBruta: pct(lucroBruto, receitaLiquida),
    despesasPessoal, prolabore, despesasAdm, despesasComerciais,
    despesasTi, despesasViagem, despesasJuridicas, despesasFinanceiras,
    outrasDespesas, outrasReceitasOp, totalDespesasOp,
    ebitda, margemEbitda: pct(ebitda, receitaLiquida),
    depreciacao, amortizacao, ebit, margemOperacional: pct(ebit, receitaLiquida),
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

/**
 * DRE de um "mês típico" em run-rate por categoria: cada categoria é dividida pelos
 * meses DISTINTOS em que ela ocorre (não pelo período inteiro), depois re-agregada.
 * Necessário porque a análise consolida o extrato de N meses, mas narrativa/plano
 * raciocinam em termos mensais — sem isto, o LLM lê o total do período como mensal
 * (ex.: pró-labore presente em 2 meses, R$ 36k, virava "R$ 30k mensal" no plano; o
 * recorrente real é R$ 18k/mês). Dividir por categoria (e não pelo nº de meses do
 * período) evita diluir uma categoria recorrente com meses em que ela não aparece.
 */
export function aggregateMonthlyRunRateDre(rows: DatedEntryRow[]): DreLines {
  const byCategory = new Map<string, { total: number; months: Set<string>; sample: EntryRow }>();
  for (const r of rows) {
    const cat = effectiveCategory(r);
    const g = byCategory.get(cat) ?? { total: 0, months: new Set<string>(), sample: r };
    g.total += r.amountCents;
    g.months.add(r.month);
    byCategory.set(cat, g);
  }
  // 1 linha sintética por categoria com o valor mensal recorrente; re-agrega para
  // um DRE coerente (lucro/EBITDA/margens recalculados sobre os valores mensais).
  const monthlyRows: EntryRow[] = [...byCategory.values()].map(({ total, months, sample }) => ({
    amountCents: Math.round(total / Math.max(1, months.size)),
    direction: sample.direction,
    predictedCategory: sample.predictedCategory,
    confirmedCategory: sample.confirmedCategory,
  }));
  return aggregateDre(monthlyRows);
}

/**
 * DRE fechada por competência, em ordem crescente de mês. Com a análise consolidada
 * (todo o histórico do tenant numa só análise), o sinal mês-a-mês não vem mais de
 * análises separadas — é derivado aqui, dos próprios lançamentos classificados.
 */
export function aggregatePerMonthDre(rows: DatedEntryRow[]): { month: string; dre: DreLines }[] {
  const byMonth = new Map<string, DatedEntryRow[]>();
  for (const r of rows) {
    const bucket = byMonth.get(r.month) ?? [];
    bucket.push(r);
    byMonth.set(r.month, bucket);
  }
  return [...byMonth.keys()]
    .sort()
    .map((month) => ({ month, dre: aggregateDre(byMonth.get(month)!) }));
}

export function formatDreForPrompt(dre: DreLines, referenceMonth: string): string {
  const brl = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const pctFmt = (f: number) => f.toFixed(2);

  // Quando não há receita, margens são indefinidas — não exibir para evitar
  // que o modelo as cite como 0% (valores sem significado econômico).
  const hasRevenue = dre.receitaLiquida !== 0;
  const margem = (pct: number) => hasRevenue ? ` (margem ${pctFmt(pct)}%)` : "";

  return `DRE FACILITADO — ${referenceMonth}

RECEITAS
  Receita Bruta:          ${brl(dre.receitaBruta)}
  (-) Deduções:           ${brl(dre.deducoes)}
  = Receita Líquida:      ${brl(dre.receitaLiquida)}

CUSTOS
  (-) Custos Diretos:     ${brl(dre.custosDiretos)}
  = Lucro Bruto:          ${brl(dre.lucroBruto)}${margem(dre.margemBruta)}

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
  Outras Receitas Op.:    (${brl(dre.outrasReceitasOp)})
  TOTAL Despesas Op.:     ${brl(dre.totalDespesasOp)}

RESULTADOS
  = EBITDA:               ${brl(dre.ebitda)}${margem(dre.margemEbitda)}
  (-) Depreciação:        ${brl(dre.depreciacao)}
  (-) Amortização:        ${brl(dre.amortizacao)}
  = EBIT (Lucro Op.):     ${brl(dre.ebit)}${margem(dre.margemOperacional)}
  Resultado Financeiro:   ${brl(dre.resultadoFinanceiro)}
  = Antes de Impostos:    ${brl(dre.resultadoAntesImpostos)}
  (-) Impostos:           ${brl(dre.impostos)}
  = LUCRO LÍQUIDO:        ${brl(dre.lucroLiquido)}${margem(dre.margemLiquida)}

NÃO-P&L (não impactam resultado)
  Entradas de Empréstimos: ${brl(dre.emprestimosEntrada)}
  Amortização de Dívidas:  ${brl(dre.amortizacaoDividas)}
  CAPEX:                   ${brl(dre.capex)}
  Transferências Internas: ${brl(dre.transferenciaInterna)}
  Não Classificados:       ${brl(dre.naoClassificado)}`;
}
