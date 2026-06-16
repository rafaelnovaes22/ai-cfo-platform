import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/index.js";
import { useAuth } from "../auth/AuthContext";
import { useAnalyses } from "./useAnalyses";

export type GranularityEnum = "daily" | "weekly" | "monthly" | "quarterly";

export interface CashFlow {
  period: {
    startDate: string;
    endDate: string;
    granularity: GranularityEnum;
  };
  summary: {
    openingBalanceCents: number | null;
    closingBalanceCents: number | null;
    totalCreditsCents: number;
    totalDebitsCents: number;
    creditCount: number;
    debitCount: number;
  };
  chart: any;
  table: any;
  requestId: any;
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
  const parameters: any = {
    startDate,
    endDate,
    granularity,
  };

  if (category) parameters.category = category;
  if (bankAccountId) parameters.bankAccountId = bankAccountId;

  const refresh = useCallback(
    async (filters?: any) => {
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
    [user, activeId]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { cashflow, loading, refresh };
}
