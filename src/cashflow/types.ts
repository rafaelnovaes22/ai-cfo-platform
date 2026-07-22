export type Granularity = "daily" | "weekly" | "monthly" | "quarterly";

export interface CashflowPeriod {
  startDate: string;
  endDate: string;
  granularity: Granularity;
}

export interface CashflowSummary {
  openingBalanceCents: number | null;
  closingBalanceCents: number | null;
  totalCreditsCents: number;
  totalDebitsCents: number;
  creditCount: number;
  debitCount: number;
}

export interface ChartEntry {
  period: string;
  creditsCents: number;
  debitsCents: number;
}

export interface TableRow {
  category: string;
  parentCategory: string | null;
  totalCents: number;
  byPeriod: Array<{ period: string; amountCents: number }>;
}

export interface CashflowResponse {
  period: CashflowPeriod;
  summary: CashflowSummary;
  chart: ChartEntry[];
  table: TableRow[];
  requestId: string;
}

export interface CashflowSummaryDay {
  date: string;
  balanceCents: number | null;
  creditsCents: number;
  debitsCents: number;
  requestId: string;
}
