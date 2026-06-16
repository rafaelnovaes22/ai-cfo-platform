// Taxonomia DRE padrão Aicfo — 23 categorias. Única fonte de verdade.
// Alterar aqui propaga para o prompt (C8 — sem hardcode por tenant).

export const DRE_TAXONOMY = {
  // Receitas
  receita_bruta:         "Receita Bruta de Vendas e Serviços (faturamento principal)",
  receita_financeira:    "Receitas Financeiras (juros recebidos, rendimentos de aplicações)",
  outras_receitas:       "Outras Receitas Operacionais (aluguéis, recuperação de despesas)",

  // Deduções
  deducoes_receita:      "Deduções da Receita (ICMS, ISS, PIS, COFINS, devoluções, descontos concedidos)",

  // Custos
  cpv_cmv:               "Custo dos Produtos / Mercadorias Vendidas (CPV/CMV) — insumos, matéria-prima",
  custo_servicos:        "Custo dos Serviços Prestados (CSP) — custo direto de entrega de serviço",

  // Despesas Operacionais
  despesas_pessoal:      "Despesas com Pessoal (salários CLT, encargos, benefícios, férias, 13°)",
  prolabore:             "Pró-labore e Retirada de Sócios",
  despesas_administrativas: "Despesas Administrativas (aluguel, condomínio, telefone, material de escritório, limpeza)",
  despesas_comerciais:   "Despesas Comerciais e de Marketing (publicidade, ads, comissões de vendas, eventos)",
  despesas_ti:           "Despesas com TI e Tecnologia (SaaS, cloud, hardware, domínios, licenças)",
  despesas_viagem:       "Despesas de Viagem e Representação (passagens, hospedagem, refeições de negócios)",
  despesas_juridicas:    "Despesas Jurídicas e Contábeis (honorários de advogado, contador, consultores)",
  despesas_financeiras:  "Despesas Financeiras (juros pagos, IOF, tarifas bancárias, maquininha)",

  // Impostos
  simples_nacional:      "Simples Nacional — guia DAS mensal",
  irpj_csll:             "IRPJ e CSLL (imposto de renda PJ e contribuição social)",

  // Investimentos e Dívidas
  capex:                 "Investimentos / CAPEX (aquisição de ativo imobilizado, equipamentos, reformas)",
  emprestimos_entrada:   "Entrada de Empréstimos e Financiamentos (não é receita — capital de terceiros)",
  amortizacao_dividas:   "Pagamento de Principal de Empréstimos e Financiamentos",

  // Operações não-P&L
  transferencia_interna: "Transferência Interna entre Contas Próprias (não impacta resultado)",
  depreciacao:           "Depreciação e Amortização de Ativos",
  outras_despesas:       "Outras Despesas Operacionais (não enquadradas nas categorias acima)",

  // Fallback
  nao_classificado:      "Não Classificado — confiança insuficiente; revisão humana necessária",
} as const;

export type DreCategory = keyof typeof DRE_TAXONOMY;
export const DRE_CATEGORIES = Object.keys(DRE_TAXONOMY) as DreCategory[];

// Natureza de fluxo de cada categoria: "credit" = dinheiro entra, "debit" = sai,
// null = sem natureza determinável (depende do lançamento). Usado para corrigir
// a direção de lançamentos com directionInferred=true após a classificação —
// nunca para sobrescrever direção que veio confiável do arquivo (extrato, sinal).
export const CATEGORY_NATURE: Record<DreCategory, "credit" | "debit" | null> = {
  receita_bruta:            "credit",
  receita_financeira:       "credit",
  outras_receitas:          "credit",
  deducoes_receita:         "debit",
  cpv_cmv:                  "debit",
  custo_servicos:           "debit",
  despesas_pessoal:         "debit",
  prolabore:                "debit",
  despesas_administrativas: "debit",
  despesas_comerciais:      "debit",
  despesas_ti:              "debit",
  despesas_viagem:          "debit",
  despesas_juridicas:       "debit",
  despesas_financeiras:     "debit",
  simples_nacional:         "debit",
  irpj_csll:                "debit",
  capex:                    "debit",
  emprestimos_entrada:      "credit",
  amortizacao_dividas:      "debit",
  // Transferência interna pode ser entrada ou saída da conta observada.
  transferencia_interna:    null,
  depreciacao:              "debit",
  outras_despesas:          "debit",
  nao_classificado:         null,
};

export function buildTaxonomyBlock(): string {
  return Object.entries(DRE_TAXONOMY)
    .map(([key, desc], i) => `${i + 1}. **${key}** — ${desc}`)
    .join("\n");
}
