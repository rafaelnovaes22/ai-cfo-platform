import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api/index.js";
import { useAuth } from "../auth/AuthContext.tsx";
import { useAnalyses } from "./useAnalyses.ts";
import { CATEGORY_LABELS } from "./categoryLabels.ts";

export type TransactionType = "income" | "expense";
export type TransactionSource =
  | "manual"
  | "spreadsheet"
  | "pdf"
  | "pasted"
  | "ai";

export type ReviewStatus = "needs_review" | "confirmed" | "corrected";

export interface Transaction {
  id: string;
  analysis_id: string;
  date: string;
  description: string;
  category: string;
  account: string;
  amount: number;
  type: TransactionType;
  source: TransactionSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
  rawCategory: string;
  confidence: number | null;
  reviewStatus: ReviewStatus;
  // true = a IA ainda não classificou este lançamento (sem categoria prevista
  // nem confirmada) — usado para o selo "Classificando…" durante o pipeline
  pending: boolean;
}

// Kept for TransactionModal compatibility (ManualEntry in Import.tsx)
export type NewTransaction = {
  date: string;
  description: string;
  category: string;
  account: string;
  amount: number;
  type: TransactionType;
  source?: TransactionSource;
  notes?: string | null;
  analysis_id?: string;
};

export type Source = Parameters<typeof api.classification.correct>[1]["source"];

export const BACKEND_CATEGORIES = Object.entries(CATEGORY_LABELS).map(
  ([key, label]) => ({
    key,
    label,
    type: [
      "receita_bruta",
      "receita_financeira",
      "outras_receitas",
      "emprestimos_entrada",
    ].includes(key)
      ? ("income" as const)
      : ("expense" as const),
  })
);

function mapEntry(
  entry: {
    id: string;
    date: string;
    description: string;
    amountCents: number;
    direction: string;
    predictedCategory: string | null;
    confirmedCategory: string | null;
    classificationConfidence: number | null;
    correctionSource: string | null;
  },
  analysisId: string
): Transaction {
  const rawCategory =
    entry.confirmedCategory ?? entry.predictedCategory ?? "nao_classificado";
  const type: TransactionType =
    entry.direction === "in" || entry.direction === "credit"
      ? "income"
      : "expense";
  const reviewStatus: ReviewStatus =
    entry.correctionSource === "needs_review"
      ? "needs_review"
      : entry.correctionSource === "operator" ||
          entry.correctionSource === "client"
        ? "corrected"
        : "confirmed";
  return {
    id: entry.id,
    analysis_id: analysisId,
    date: entry.date,
    description: entry.description,
    category: CATEGORY_LABELS[rawCategory] ?? rawCategory,
    account: "",
    amount: entry.amountCents / 100,
    type,
    source: "ai",
    notes: null,
    created_at: entry.date,
    updated_at: entry.date,
    rawCategory,
    confidence: entry.classificationConfidence,
    reviewStatus,
    pending:
      entry.predictedCategory === null && entry.confirmedCategory === null,
  };
}

export function useTransactions() {
  const { user } = useAuth();
  const { activeId, activeAnalysis } = useAnalyses();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A análise ativa ainda está no pipeline de IA (status não-terminal).
  const classifying = activeAnalysis?.status === "generating";

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user || !activeId) {
        setTransactions([]);
        setLoading(false);
        return;
      }
      // silent: atualização de fundo durante a classificação — sem flash de spinner
      if (!opts?.silent) setLoading(true);
      try {
        const { data } = await api.classification.review(activeId);
        setTransactions(data.map((e) => mapEntry(e, activeId)));
        setError(null);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Erro ao carregar lançamentos"
        );
        if (!opts?.silent) setTransactions([]);
      } finally {
        setLoading(false);
      }
    },
    [user, activeId]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Enquanto a IA classifica, a lista atualiza sozinha: o usuário vê as
  // categorias chegando em vez de uma tela estática de "Não Classificado".
  useEffect(() => {
    if (!classifying) return;
    const id = setInterval(() => {
      void refresh({ silent: true });
    }, 4000);
    return () => clearInterval(id);
  }, [classifying, refresh]);

  // Refresh final quando a análise sai do pipeline (pega as últimas categorias).
  const wasClassifying = useRef(false);
  useEffect(() => {
    if (wasClassifying.current && !classifying) void refresh({ silent: true });
    wasClassifying.current = classifying;
  }, [classifying, refresh]);

  const correct = useCallback(
    async (entryId: string, category: string, source?: Source) => {
      await api.classification.correct(entryId, {
        category: category as Parameters<
          typeof api.classification.correct
        >[1]["category"],
        source: source ?? "client",
      });
      await refresh();
    },
    [refresh]
  );

  return { transactions, loading, error, refresh, correct, classifying };
}
