import { getPrisma } from "@/persistence/prisma.js";
import type { Granularity, ChartEntry, TableRow } from "./types.js";

// Mapeia granularity para a função date_trunc do Postgres
const granularityTrunc: Record<Granularity, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  quarterly: "quarter",
};

// Formata o período de saída conforme granularity
function formatPeriod(raw: Date, granularity: Granularity): string {
  const d = new Date(raw);
  if (granularity === "daily") return d.toISOString().slice(0, 10);
  if (granularity === "weekly") {
    // ISO week: YYYY-Www
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  if (granularity === "quarterly") {
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return `${d.getFullYear()}-Q${q}`;
  }
  // monthly
  return d.toISOString().slice(0, 7);
}

interface SummaryRow {
  direction: string;
  total: bigint;
  count: bigint;
}

export async function querySummary(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  category?: string
): Promise<{ totalCreditsCents: number; totalDebitsCents: number; creditCount: number; debitCount: number }> {
  const db = getPrisma();

  const rows = await db.$queryRaw<SummaryRow[]>`
    SELECT direction,
           SUM("amountCents")::bigint AS total,
           COUNT(*)::bigint           AS count
    FROM "LedgerEntry"
    WHERE "tenantId" = ${tenantId}
      AND date >= ${startDate}
      AND date <= ${endDate}
      ${category ? db.$queryRaw`AND ("confirmedCategory" = ${category} OR ("confirmedCategory" IS NULL AND "predictedCategory" = ${category}))` : db.$queryRaw``}
    GROUP BY direction
  `;

  let totalCreditsCents = 0;
  let totalDebitsCents = 0;
  let creditCount = 0;
  let debitCount = 0;

  for (const row of rows) {
    const amount = Number(row.total);
    const cnt = Number(row.count);
    if (row.direction === "credit") {
      totalCreditsCents = amount;
      creditCount = cnt;
    } else {
      totalDebitsCents = amount;
      debitCount = cnt;
    }
  }

  return { totalCreditsCents, totalDebitsCents, creditCount, debitCount };
}

interface ChartRawRow {
  period: Date;
  direction: string;
  amount: bigint;
}

export async function queryChart(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  granularity: Granularity,
  category?: string
): Promise<ChartEntry[]> {
  const db = getPrisma();
  const trunc = granularityTrunc[granularity];

  const rows = await db.$queryRaw<ChartRawRow[]>`
    SELECT date_trunc(${trunc}, date) AS period,
           direction,
           SUM("amountCents")::bigint AS amount
    FROM "LedgerEntry"
    WHERE "tenantId" = ${tenantId}
      AND date >= ${startDate}
      AND date <= ${endDate}
      ${category ? db.$queryRaw`AND COALESCE("confirmedCategory", "predictedCategory") = ${category}` : db.$queryRaw``}
    GROUP BY 1, 2
    ORDER BY 1 ASC
  `;

  // Agrupa em mapa period → { credits, debits }
  const map = new Map<string, { creditsCents: number; debitsCents: number }>();
  for (const row of rows) {
    const key = formatPeriod(row.period, granularity);
    const entry = map.get(key) ?? { creditsCents: 0, debitsCents: 0 };
    if (row.direction === "credit") entry.creditsCents = Number(row.amount);
    else entry.debitsCents = Number(row.amount);
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({ period, ...v }));
}

interface TableRawRow {
  category: string | null;
  period: Date;
  direction: string;
  amount: bigint;
}

export async function queryTable(
  tenantId: string,
  startDate: Date,
  endDate: Date,
  granularity: Granularity,
  category?: string
): Promise<TableRow[]> {
  const db = getPrisma();
  const trunc = granularityTrunc[granularity];

  const rows = await db.$queryRaw<TableRawRow[]>`
    SELECT COALESCE("confirmedCategory", "predictedCategory", 'Sem categoria') AS category,
           date_trunc(${trunc}, date) AS period,
           direction,
           SUM("amountCents")::bigint AS amount
    FROM "LedgerEntry"
    WHERE "tenantId" = ${tenantId}
      AND date >= ${startDate}
      AND date <= ${endDate}
      ${category ? db.$queryRaw`AND COALESCE("confirmedCategory", "predictedCategory") = ${category}` : db.$queryRaw``}
    GROUP BY 1, 2, 3
    ORDER BY 1, 2 ASC
  `;

  // Agrupa por categoria → { totalCents, byPeriod map }
  const catMap = new Map<string, { totalCents: number; periods: Map<string, number> }>();

  for (const row of rows) {
    const cat = row.category ?? "Sem categoria";
    const periodKey = formatPeriod(row.period, granularity);
    const sign = row.direction === "credit" ? 1 : -1;
    const amount = Number(row.amount) * sign;

    const entry = catMap.get(cat) ?? { totalCents: 0, periods: new Map() };
    entry.totalCents += amount;
    entry.periods.set(periodKey, (entry.periods.get(periodKey) ?? 0) + amount);
    catMap.set(cat, entry);
  }

  return Array.from(catMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, v]) => ({
      category: cat,
      parentCategory: null,
      totalCents: v.totalCents,
      byPeriod: Array.from(v.periods.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, amountCents]) => ({ period, amountCents })),
    }));
}

export async function queryOpeningBalance(
  tenantId: string,
  startDate: Date
): Promise<number | null> {
  const db = getPrisma();

  // Busca o openingBalanceCents da análise mensal imediatamente anterior ao startDate
  const refMonth = startDate.toISOString().slice(0, 7); // "YYYY-MM"
  const analysis = await db.monthlyAnalysis.findFirst({
    where: {
      tenantId,
      referenceMonth: { lt: refMonth },
      openingBalanceCents: { not: null },
    },
    orderBy: { referenceMonth: "desc" },
    select: { openingBalanceCents: true },
  });

  return analysis?.openingBalanceCents ?? null;
}
