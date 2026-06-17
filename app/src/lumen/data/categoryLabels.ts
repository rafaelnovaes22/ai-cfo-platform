// Mapa canônico chave DRE → label legível, compartilhado por Lançamentos e Caixa.
// Centralizado para as páginas não exibirem o nome de campo cru (ex: "custo_servicos",
// "outras_receitas") quando uma categoria não estava no mapa local de cada tela.
export const CATEGORY_LABELS: Record<string, string> = {
  receita_bruta: "Receita Bruta",
  receita_financeira: "Receita Financeira",
  outras_receitas: "Outras Receitas",
  deducoes_receita: "Deduções de Receita",
  cpv_cmv: "CPV / CMV",
  custo_servicos: "Custo de Serviços",
  despesas_pessoal: "Pessoal e Benefícios",
  prolabore: "Pró-labore",
  despesas_administrativas: "Despesas Administrativas",
  despesas_comerciais: "Comercial e Marketing",
  despesas_ti: "TI e Ferramentas",
  despesas_viagem: "Viagens",
  despesas_juridicas: "Jurídico e Contábil",
  despesas_financeiras: "Despesas Financeiras",
  simples_nacional: "Simples Nacional",
  irpj_csll: "IRPJ / CSLL",
  capex: "Investimento (CAPEX)",
  emprestimos_entrada: "Empréstimos (entrada)",
  amortizacao_dividas: "Amortização de Dívidas",
  transferencia_interna: "Transferência Interna",
  depreciacao: "Depreciação",
  outras_despesas: "Outras Despesas",
  nao_classificado: "Não Classificado",
};

/**
 * Label legível de uma categoria. Humaniza o fallback (snake_case → "Snake Case")
 * para nunca exibir o nome de campo cru caso surja uma chave nova fora do mapa.
 */
export function categoryLabel(key: string | null | undefined): string {
  if (!key) return CATEGORY_LABELS.nao_classificado!;
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key]!;
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
