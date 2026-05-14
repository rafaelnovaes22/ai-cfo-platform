export const company = {
  name: "Acme Marketing",
  type: "Agência de marketing digital",
  initials: "AM",
};

export const currentAnalysis = {
  period: "Setembro 2026",
  periodShort: "set/2026",
  generatedAt: "28 de outubro",
  netProfit: 15480,
  margin: 8.4,
  bottlenecks: 3,
};

export type Analysis = {
  id: string;
  date: string;
  period: string;
  profit: number;
  margin: number;
};

export const previousAnalyses: Analysis[] = [
  { id: "ago-2026", date: "29 set 2026", period: "Agosto 2026", profit: 19870, margin: 12.1 },
  { id: "jul-2026", date: "30 ago 2026", period: "Julho 2026", profit: 18420, margin: 11.4 },
  { id: "jun-2026", date: "28 jul 2026", period: "Junho 2026", profit: 22100, margin: 13.8 },
];

export type DRELine = {
  key: string;
  label: string;
  value: number;
  type: "income" | "cost" | "expense" | "subtotal" | "result";
  share: number; // share of revenue (0-1)
  vsLast?: number; // % vs last month
  children?: DRELine[];
};

const REVENUE = 184320;

export const dre: DRELine[] = [
  {
    key: "rev",
    label: "Receita Operacional Bruta",
    value: 184320,
    type: "income",
    share: 1,
    vsLast: 12.4,
    children: [
      { key: "rev-mrr", label: "MRR · Contratos recorrentes", value: 141926, type: "income", share: 141926 / REVENUE, vsLast: 8.2 },
      { key: "rev-proj", label: "Projetos pontuais", value: 38707, type: "income", share: 38707 / REVENUE, vsLast: 28.1 },
      { key: "rev-work", label: "Workshops e treinamentos", value: 3687, type: "income", share: 3687 / REVENUE, vsLast: -4.1 },
    ],
  },
  {
    key: "ded",
    label: "(−) Deduções e impostos",
    value: -22118,
    type: "cost",
    share: 22118 / REVENUE,
    vsLast: 9.8,
  },
  {
    key: "rl",
    label: "Receita Líquida",
    value: 162202,
    type: "subtotal",
    share: 162202 / REVENUE,
  },
  {
    key: "cv",
    label: "(−) Custos Variáveis",
    value: -62640,
    type: "cost",
    share: 62640 / REVENUE,
    vsLast: 31.2,
    children: [
      { key: "cv-ads", label: "Mídia paga (tráfego)", value: -41200, type: "cost", share: 41200 / REVENUE, vsLast: 47.0 },
      { key: "cv-tools", label: "Ferramentas e SaaS", value: -12840, type: "cost", share: 12840 / REVENUE, vsLast: 14.0 },
      { key: "cv-free", label: "Freelas e produção", value: -8600, type: "cost", share: 8600 / REVENUE, vsLast: 3.2 },
    ],
  },
  {
    key: "mc",
    label: "Margem de Contribuição",
    value: 99562,
    type: "subtotal",
    share: 99562 / REVENUE,
  },
  {
    key: "do",
    label: "(−) Despesas Operacionais",
    value: -106200,
    type: "expense",
    share: 106200 / REVENUE,
    vsLast: 4.1,
    children: [
      { key: "do-folha", label: "Folha de pagamento", value: -70042, type: "expense", share: 70042 / REVENUE, vsLast: 2.3 },
      { key: "do-pro", label: "Pró-labore sócios", value: -18000, type: "expense", share: 18000 / REVENUE, vsLast: 0 },
      { key: "do-alug", label: "Aluguel e infraestrutura", value: -7800, type: "expense", share: 7800 / REVENUE, vsLast: 5.1 },
      { key: "do-mkt", label: "Marketing institucional", value: -6358, type: "expense", share: 6358 / REVENUE, vsLast: 12.0 },
      { key: "do-adm", label: "Administrativo e contábil", value: -4000, type: "expense", share: 4000 / REVENUE, vsLast: 1.0 },
    ],
  },
  {
    key: "rop",
    label: "Resultado Operacional",
    value: -6638,
    type: "subtotal",
    share: 6638 / REVENUE,
  },
  {
    key: "fin",
    label: "(+) Resultado Financeiro",
    value: 22118,
    type: "income",
    share: 22118 / REVENUE,
    vsLast: 6.2,
  },
  {
    key: "lucro",
    label: "Lucro Líquido",
    value: 15480,
    type: "result",
    share: 15480 / REVENUE,
  },
];

export type Insight = {
  level: "critical" | "warning" | "healthy";
  tag: string;
  title: string;
  description: string;
};

export const insights: Insight[] = [
  {
    level: "critical",
    tag: "Gargalo crítico",
    title: "Tráfego pago cresceu 47% sem retorno proporcional",
    description: "ROAS caiu de 4,2 para 2,8 em três meses. Mídia paga consome 22% da receita — quase o dobro do mês anterior.",
  },
  {
    level: "warning",
    tag: "Atenção",
    title: "Folha consome 38% da receita",
    description: "Benchmark do setor para agências do mesmo porte fica entre 28% e 32%. Avaliar produtividade por colaborador.",
  },
  {
    level: "healthy",
    tag: "Saudável",
    title: "MRR representa 77% da receita",
    description: "Previsibilidade alta. Contratos recorrentes seguram o caixa e reduzem dependência de projetos pontuais.",
  },
];

export type Action = {
  num: string;
  type: "revenue" | "cost";
  area: string;
  title: string;
  description: string;
  deadline: string;
  effort: "Baixo" | "Médio" | "Alto";
  risk: "Baixo" | "Médio" | "Alto";
  impactValue: number;
  impactLabel: string;
};

export const shortTermActions: Action[] = [
  {
    num: "01",
    type: "cost",
    area: "Marketing",
    title: "Cortar campanhas com ROAS abaixo de 2,5",
    description: "Pausar imediatamente os 4 conjuntos de anúncios com pior performance no Meta e Google. Realocar 30% do budget para os criativos com ROAS acima de 4.",
    deadline: "15 dias",
    effort: "Baixo",
    risk: "Baixo",
    impactValue: 6200,
    impactLabel: "Economia mensal",
  },
  {
    num: "02",
    type: "cost",
    area: "Operações",
    title: "Revisar stack de SaaS e ferramentas",
    description: "Mapear todas as 23 assinaturas ativas, consolidar duplicidades e renegociar planos anuais. Cancelar 6 ferramentas com uso abaixo de 20%.",
    deadline: "30 dias",
    effort: "Médio",
    risk: "Baixo",
    impactValue: 2800,
    impactLabel: "Economia mensal",
  },
  {
    num: "03",
    type: "revenue",
    area: "Comercial",
    title: "Reajustar contratos antigos com IPCA acumulado",
    description: "12 contratos recorrentes não sofrem reajuste há mais de 18 meses. Aplicar IPCA acumulado de 9,2% com comunicação consultiva — risco baixo de churn.",
    deadline: "60 dias",
    effort: "Médio",
    risk: "Médio",
    impactValue: 2400,
    impactLabel: "Receita extra mensal",
  },
];

export const midTermActions: Action[] = [
  {
    num: "01",
    type: "revenue",
    area: "Comercial",
    title: "Estruturar oferta de retainer premium",
    description: "Pacote de R$ 18-25k/mês com SLA, dashboard dedicado e estrategista sênior. Meta: 4 contas convertidas em 6 meses.",
    deadline: "4 meses",
    effort: "Alto",
    risk: "Médio",
    impactValue: 18000,
    impactLabel: "Receita extra mensal",
  },
  {
    num: "02",
    type: "cost",
    area: "Operações",
    title: "Automatizar relatórios e onboarding",
    description: "Reduzir 40h/mês de operação manual via Looker Studio + n8n. Libera capacidade para 2 contas adicionais sem nova contratação.",
    deadline: "5 meses",
    effort: "Alto",
    risk: "Baixo",
    impactValue: 9500,
    impactLabel: "Economia mensal",
  },
];

export const longTermActions: Action[] = [
  {
    num: "01",
    type: "revenue",
    area: "Produto",
    title: "Lançar SaaS proprietário de relatórios",
    description: "Transformar a operação interna de reporting em produto white-label para outras agências. Modelo SaaS com receita previsível e margem alta.",
    deadline: "12-18 meses",
    effort: "Alto",
    risk: "Alto",
    impactValue: 45000,
    impactLabel: "Receita extra mensal",
  },
];

export type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  account: string;
  value: number;
};

export const transactions: Transaction[] = [
  { id: "t1", date: "30/09/2026", description: "Cliente · Construtora Vértice — MRR setembro", category: "MRR", account: "Itaú PJ", value: 14200 },
  { id: "t2", date: "29/09/2026", description: "Meta Ads · Conta principal", category: "Mídia paga", account: "Cartão Inter PJ", value: -22840 },
  { id: "t3", date: "28/09/2026", description: "Folha · Setembro/26", category: "Folha", account: "Itaú PJ", value: -70042 },
  { id: "t4", date: "27/09/2026", description: "Cliente · Loja Hábito — Projeto Q4", category: "Projetos", account: "Itaú PJ", value: 28500 },
  { id: "t5", date: "25/09/2026", description: "Google Workspace · 18 licenças", category: "Ferramentas", account: "Cartão Inter PJ", value: -1620 },
  { id: "t6", date: "24/09/2026", description: "Pró-labore sócios", category: "Pró-labore", account: "Itaú PJ", value: -18000 },
  { id: "t7", date: "22/09/2026", description: "Cliente · Banca Norte — MRR setembro", category: "MRR", account: "Itaú PJ", value: 9800 },
  { id: "t8", date: "20/09/2026", description: "Aluguel escritório · Pinheiros", category: "Infraestrutura", account: "Itaú PJ", value: -7800 },
  { id: "t9", date: "18/09/2026", description: "Freela · Edição vídeo campanha Q3", category: "Produção", account: "Itaú PJ", value: -3400 },
  { id: "t10", date: "15/09/2026", description: "Cliente · Pet Quartzo — Workshop", category: "Workshops", account: "Itaú PJ", value: 3687 },
  { id: "t11", date: "12/09/2026", description: "Notion · Plano Business anual", category: "Ferramentas", account: "Cartão Inter PJ", value: -2840 },
  { id: "t12", date: "10/09/2026", description: "Cliente · Edu Lince — MRR setembro", category: "MRR", account: "Itaú PJ", value: 11200 },
  { id: "t13", date: "08/09/2026", description: "Google Ads · Campanhas search", category: "Mídia paga", account: "Cartão Inter PJ", value: -18360 },
  { id: "t14", date: "05/09/2026", description: "Contabilidade · Setembro/26", category: "Administrativo", account: "Itaú PJ", value: -2400 },
  { id: "t15", date: "03/09/2026", description: "Cliente · Casa Manutto — MRR setembro", category: "MRR", account: "Itaú PJ", value: 8400 },
];

export const formatBRL = (n: number) => {
  const abs = Math.abs(n);
  const fmt = abs.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${n < 0 ? "−" : ""}R$ ${fmt}`;
};

export const formatPct = (n: number, withSign = false) => {
  const v = (n * 100).toFixed(1).replace(".", ",");
  return `${withSign && n > 0 ? "+" : ""}${v}%`;
};