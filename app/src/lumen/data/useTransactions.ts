import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../auth/AuthContext.tsx";
import { useAnalyses } from "./useAnalyses.ts";

export type TransactionType = "income" | "expense";
export type TransactionSource = "manual" | "spreadsheet" | "pdf" | "pasted" | "ai";

export interface Transaction {
  id: string;
  user_id: string;
  analysis_id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: string;
  account: string;
  amount: number; // always positive in DB; sign derived from `type`
  type: TransactionType;
  source: TransactionSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type NewTransaction = Omit<Transaction, "id" | "user_id" | "analysis_id" | "created_at" | "updated_at"> & {
  source?: TransactionSource;
  analysis_id?: string; // opcional: usa a análise ativa se não informada
};

export function useTransactions() {
  const { user } = useAuth();
  const { activeId } = useAnalyses();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !activeId) {
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("analysis_id", activeId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else {
      setTransactions((data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[]);
      setError(null);
    }
    setLoading(false);
  }, [user, activeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (tx: NewTransaction) => {
      if (!user) throw new Error("Não autenticado");
      const analysisId = tx.analysis_id ?? activeId;
      if (!analysisId) throw new Error("Selecione uma análise antes de criar lançamentos");
      const { error } = await supabase.from("transactions").insert({
        ...tx,
        analysis_id: analysisId,
        user_id: user.id,
      });
      if (error) throw error;
      await refresh();
    },
    [user, refresh, activeId]
  );

  const createMany = useCallback(
    async (txs: NewTransaction[]) => {
      if (!user) throw new Error("Não autenticado");
      if (txs.length === 0) return;
      const { error } = await supabase
        .from("transactions")
        .insert(
          txs.map((t) => {
            const analysisId = t.analysis_id ?? activeId;
            if (!analysisId) throw new Error("Selecione uma análise antes de importar");
            return { ...t, analysis_id: analysisId, user_id: user.id };
          })
        );
      if (error) throw error;
      await refresh();
    },
    [user, refresh, activeId]
  );

  const update = useCallback(
    async (id: string, patch: Partial<NewTransaction>) => {
      const { error } = await supabase.from("transactions").update(patch).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh]
  );

  return { transactions, loading, error, refresh, create, createMany, update, remove };
}
