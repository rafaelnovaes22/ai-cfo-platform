import { Transaction } from "./useTransactions";

// ===== Helpers =====
export const formatBRL = (n: number) => {
  const abs = Math.abs(n);
  const fmt = abs.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${n < 0 ? "−" : ""}R$ ${fmt}`;
};

export const formatPct = (n: number, withSign = false) => {
  const v = (n * 100).toFixed(1).replace(".", ",");
  return `${withSign && n > 0 ? "+" : ""}${v}%`;
};

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

export type MonthKey = string; // "YYYY-MM"

export function monthKey(dateStr: string): MonthKey {
  return dateStr.slice(0, 7);
}

export function monthLabel(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function monthShortLabel(key: MonthKey): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]}/${y}`;
}

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

// ===== Period summary =====
export interface PeriodSummary {
  monthKey: MonthKey;
  period: string;
  periodShort: string;
  income: number;
  expense: number;
  netProfit: number;
  margin: number; // 0-100
  count: number;
  generatedAt: string;
}

export function summarizeMonth(txs: Transaction[], key: MonthKey): PeriodSummary {
  const monthTx = txs.filter((t) => monthKey(t.date) === key);
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netProfit = income - expense;
  const margin = income > 0 ? (netProfit / income) * 100 : 0;
  const lastUpdated = monthTx
    .map((t) => t.updated_at)
    .sort()
    .at(-1);
  return {
    monthKey: key,
    period: monthLabel(key),
    periodShort: monthShortLabel(key),
    income,
    expense,
    netProfit,
    margin: Math.round(margin * 10) / 10,
    count: monthTx.length,
    generatedAt: lastUpdated ? formatDateBR(lastUpdated) : "—",
  };
}

export function listMonthKeys(txs: Transaction[]): MonthKey[] {
  const set = new Set<string>();
  txs.forEach((t) => set.add(monthKey(t.date)));
  return Array.from(set).sort().reverse(); // newest first
}

// ===== DRE =====
export type DRELine = {
  key: string;
  label: string;
  value: number;
  type: "income" | "cost" | "expense" | "subtotal" | "result";
  share: number;
  vsLast?: number;
  children?: DRELine[];
};

function buildCategoryChildren(
  txs: Transaction[],
  type: "income" | "expense",
  prevTxs: Transaction[],
  revenue: number,
  parentKey: string,
  rowType: DRELine["type"]
): DRELine[] {
  const byCat = new Map<string, number>();
  txs.filter((t) => t.type === type).forEach((t) => {
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  });
  const prevByCat = new Map<string, number>();
  prevTxs.filter((t) => t.type === type).forEach((t) => {
    prevByCat.set(t.category, (prevByCat.get(t.category) ?? 0) + t.amount);
  });
  return Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => {
      const prev = prevByCat.get(cat);
      const signed = type === "expense" ? -val : val;
      const vsLast = prev && prev > 0 ? ((val - prev) / prev) * 100 : undefined;
      return {
        key: `${parentKey}-${cat}`,
        label: cat,
        value: signed,
        type: rowType,
        share: revenue > 0 ? val / revenue : 0,
        vsLast,
      };
    });
}

export function buildDRE(txs: Transaction[], key: MonthKey, prevKey?: MonthKey): DRELine[] {
  const monthTx = txs.filter((t) => monthKey(t.date) === key);
  const prevTx = prevKey ? txs.filter((t) => monthKey(t.date) === prevKey) : [];

  const revenue = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenseTotal = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const prevRevenue = prevTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const prevExpense = prevTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const incomeChildren = buildCategoryChildren(monthTx, "income", prevTx, revenue, "rev", "income");
  const expenseChildren = buildCategoryChildren(monthTx, "expense", prevTx, revenue, "exp", "expense");

  const netProfit = revenue - expenseTotal;
  const prevNet = prevRevenue - prevExpense;

  const lines: DRELine[] = [
    {
      key: "rev",
      label: "Receita Operacional Bruta",
      value: revenue,
      type: "income",
      share: 1,
      vsLast: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : undefined,
      children: incomeChildren,
    },
    {
      key: "exp",
      label: "(−) Despesas Totais",
      value: -expenseTotal,
      type: "expense",
      share: revenue > 0 ? expenseTotal / revenue : 0,
      vsLast: prevExpense > 0 ? ((expenseTotal - prevExpense) / prevExpense) * 100 : undefined,
      children: expenseChildren,
    },
    {
      key: "lucro",
      label: "Lucro Líquido",
      value: netProfit,
      type: "result",
      share: revenue > 0 ? netProfit / revenue : 0,
      vsLast: prevNet !== 0 ? ((netProfit - prevNet) / Math.abs(prevNet)) * 100 : undefined,
    },
  ];

  return lines;
}

// ===== Insights (heurísticas locais, sem IA) =====
export type Insight = {
  level: "critical" | "warning" | "healthy";
  tag: string;
  title: string;
  description: string;
};

export function buildInsights(txs: Transaction[], key: MonthKey, prevKey?: MonthKey): Insight[] {
  const monthTx = txs.filter((t) => monthKey(t.date) === key);
  const prevTx = prevKey ? txs.filter((t) => monthKey(t.date) === prevKey) : [];
  const revenue = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const insights: Insight[] = [];

  if (revenue === 0) return insights;

  // Maior categoria de despesa
  const expByCat = new Map<string, number>();
  monthTx.filter((t) => t.type === "expense").forEach((t) => {
    expByCat.set(t.category, (expByCat.get(t.category) ?? 0) + t.amount);
  });
  const topExp = Array.from(expByCat.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topExp) {
    const share = topExp[1] / revenue;
    if (share > 0.35) {
      insights.push({
        level: "critical",
        tag: "Gargalo crítico",
        title: `${topExp[0]} consome ${(share * 100).toFixed(0)}% da receita`,
        description: `Esta categoria representa a maior fatia das despesas (${formatBRL(topExp[1])}). Avalie redução ou renegociação.`,
      });
    } else if (share > 0.2) {
      insights.push({
        level: "warning",
        tag: "Atenção",
        title: `${topExp[0]} representa ${(share * 100).toFixed(0)}% da receita`,
        description: `Despesa relevante de ${formatBRL(topExp[1])}. Vale acompanhar de perto nos próximos meses.`,
      });
    }
  }

  // Margem
  const margin = (revenue - expense) / revenue;
  if (margin < 0) {
    insights.push({
      level: "critical",
      tag: "Prejuízo no período",
      title: `Resultado negativo de ${formatBRL(revenue - expense)}`,
      description: `As despesas superaram a receita em ${(Math.abs(margin) * 100).toFixed(1)}%. Priorize ações de corte ou aumento imediato.`,
    });
  } else if (margin > 0.15) {
    insights.push({
      level: "healthy",
      tag: "Saudável",
      title: `Margem líquida de ${(margin * 100).toFixed(1)}%`,
      description: `Resultado positivo consistente. Há espaço para reinvestir em crescimento.`,
    });
  } else {
    insights.push({
      level: "warning",
      tag: "Margem apertada",
      title: `Margem de apenas ${(margin * 100).toFixed(1)}%`,
      description: `Resultado positivo mas baixo. Pequenas variações podem virar prejuízo.`,
    });
  }

  // Crescimento vs mês anterior
  if (prevTx.length > 0) {
    const prevRev = prevTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    if (prevRev > 0) {
      const growth = (revenue - prevRev) / prevRev;
      if (growth > 0.1) {
        insights.push({
          level: "healthy",
          tag: "Crescimento",
          title: `Receita cresceu ${(growth * 100).toFixed(1)}% vs mês anterior`,
          description: `Aumento de ${formatBRL(revenue - prevRev)} em relação ao período passado.`,
        });
      } else if (growth < -0.1) {
        insights.push({
          level: "critical",
          tag: "Queda",
          title: `Receita caiu ${(Math.abs(growth) * 100).toFixed(1)}% vs mês anterior`,
          description: `Perda de ${formatBRL(prevRev - revenue)} em relação ao período passado.`,
        });
      }
    }
  }

  return insights.slice(0, 3);
}

// ===== Hub composition =====
export function compositionByType(txs: Transaction[], key: MonthKey) {
  const monthTx = txs.filter((t) => monthKey(t.date) === key);
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense, net: income - expense };
}