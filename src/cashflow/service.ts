import { querySummary, queryChart, queryTable, queryOpeningBalance } from "./queries.js";
import { logger } from "@/observability/logger.js";
import type { Granularity, CashflowResponse, CashflowSummaryDay } from "./types.js";

export async function getCashflow(params: {
  tenantId: string;
  startDate: string;
  endDate: string;
  granularity: Granularity;
  category?: string;
  requestId: string;
}): Promise<CashflowResponse> {
  const { tenantId, startDate, endDate, granularity, category, requestId } = params;

  const start = new Date(startDate);
  const end = new Date(endDate);

  logger.info({ tenantId, requestId, startDate, endDate, granularity, category }, "cashflow.request.start");

  const [openingBalanceCents, summaryRaw, chart, table] = await Promise.all([
    queryOpeningBalance(tenantId, start),
    querySummary(tenantId, start, end, category),
    queryChart(tenantId, start, end, granularity, category),
    queryTable(tenantId, start, end, granularity, category),
  ]);

  logger.info(
    { tenantId, requestId, source: openingBalanceCents !== null ? "monthlyAnalysis" : "null", balanceCents: openingBalanceCents },
    "cashflow.opening.resolved"
  );

  const { totalCreditsCents, totalDebitsCents, creditCount, debitCount } = summaryRaw;

  const closingBalanceCents =
    openingBalanceCents !== null
      ? openingBalanceCents + totalCreditsCents - totalDebitsCents
      : null;

  logger.info(
    { tenantId, requestId, creditCount, debitCount, chartPoints: chart.length, tableRows: table.length },
    "cashflow.queries.done"
  );

  return {
    period: { startDate, endDate, granularity },
    summary: {
      openingBalanceCents,
      closingBalanceCents,
      totalCreditsCents,
      totalDebitsCents,
      creditCount,
      debitCount,
    },
    chart,
    table,
    requestId,
  };
}

export async function getCashflowSummaryDay(params: {
  tenantId: string;
  date: string;
  requestId: string;
}): Promise<CashflowSummaryDay> {
  const { tenantId, date, requestId } = params;

  const dayStart = new Date(date);
  const dayEnd = new Date(date);

  const [openingBalanceCents, summary] = await Promise.all([
    queryOpeningBalance(tenantId, dayStart),
    querySummary(tenantId, dayStart, dayEnd),
  ]);

  const { totalCreditsCents, totalDebitsCents } = summary;

  const balanceCents =
    openingBalanceCents !== null
      ? openingBalanceCents + totalCreditsCents - totalDebitsCents
      : null;

  logger.info({ tenantId, requestId, date, balanceCents }, "cashflow.summary.loaded");

  return { date, balanceCents, creditsCents: totalCreditsCents, debitsCents: totalDebitsCents, requestId };
}
