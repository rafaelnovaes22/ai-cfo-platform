import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api/index.js";
import { useAuth } from "../auth/AuthContext";
import { useAnalyses } from "./useAnalyses";

export type GranularityEnum = "daily" | "weekly" | "monthly" | "quarterly";

export interface CashFlowPeriod {
  startDate: string;
  endDate: string;
  granularity: GranularityEnum;
}

export interface CashFlowSummary {
  openingBalanceCents: number | null;
  closingBalanceCents: number | null;
  totalCreditsCents: number;
  totalDebitsCents: number;
  creditCount: number;
  debitCount: number;
}

export interface CashFlowChartEntry {
  period: string;
  creditsCents: number;
  debitsCents: number;
}

export interface CashFlowTableRow {
  category: string;
  parentCategory: string | null;
  totalCents: number;
  byPeriod: Array<{ period: string; amountCents: number }>;
}

export interface CashFlow {
  period: CashFlowPeriod;
  summary: CashFlowSummary;
  chart: CashFlowChartEntry[];
  table: CashFlowTableRow[];
  requestId: string | null;
}

const emptyCashFlow: CashFlow = {
  period: {
    startDate: "",
    endDate: "",
    granularity: "monthly",
  },
  summary: {
    openingBalanceCents: null,
    closingBalanceCents: null,
    totalCreditsCents: 0,
    totalDebitsCents: 0,
    creditCount: 0,
    debitCount: 0,
  },
  chart: null,
  table: null,
  requestId: null,
};

export function useCashFlow({
  startDate,
  endDate,
  granularity,
  category,
  bankAccountId,
}: {
  startDate: string;
  endDate: string;
  granularity: GranularityEnum;
  category?: string;
  bankAccountId?: string;
}) {
  const { user } = useAuth();
  const { activeId } = useAnalyses();
  const [cashflow, setCashflow] = useState<CashFlow>(emptyCashFlow);
  const [loading, setLoading] = useState(true);
  const parameters = useMemo(
    () => ({
      startDate,
      endDate,
      granularity,
      ...(category ? { category } : {}),
      ...(bankAccountId ? { bankAccountId } : {}),
    }),
    [startDate, endDate, granularity, category, bankAccountId]
  );

  const refresh = useCallback(
    async (filters?: typeof parameters) => {
      if (!user || !activeId) {
        setCashflow(emptyCashFlow);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const raw = await api.cashflow.list(filters || parameters);
        setCashflow(raw);
      } catch {
        setCashflow(emptyCashFlow);
      } finally {
        setLoading(false);
      }
    },
    [user, activeId, parameters]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { cashflow, loading, refresh };
}
