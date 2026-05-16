// Categorias pré-definidas pelo sistema (BRL)
export const INCOME_CATEGORIES = [
  "Vendas",
  "Serviços prestados",
  "Receita recorrente",
  "Juros e rendimentos",
  "Outras receitas",
] as const;

export const EXPENSE_CATEGORIES = [
  "Folha e benefícios",
  "Pró-labore",
  "Marketing e mídia",
  "Ferramentas e SaaS",
  "Aluguel",
  "Contas e utilidades",
  "Impostos e taxas",
  "Fornecedores",
  "Serviços terceirizados",
  "Viagens",
  "Material de escritório",
  "Manutenção",
  "Tarifas bancárias",
  "Outras despesas",
] as const;

export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export function categoriesFor(type: "income" | "expense") {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}
