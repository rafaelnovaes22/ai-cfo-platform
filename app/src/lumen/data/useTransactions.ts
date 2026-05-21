import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/index.js";
import { useAuth } from "../auth/AuthContext.tsx";
import { useAnalyses } from "./useAnalyses.ts";

export type TransactionType = "income" | "expense";
export type TransactionSource = "manual" | "spreadsheet" | "pdf" | "pasted" | "ai";

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

const CATEGORY_LABELS: Record<string, string> = {
  receita_bruta: "Receita Bruta",
  receita_financeira: "Receita Financeira",
  outras_receitas: "Outras Receitas",
  deducoes_receita: "Deduções de Receita",
  cpv_cmv: "CPV / CMV",
  custo_servicos: "Custo de Serviços",
  despesas_pessoal: "Pessoal e Benefícios",
  prolabore: "Pró-labore",
  despesas_administrativas: "Despesas Administrativas",
  despesas_comerciais: "Comercial e Marketing",
  despesas_ti: "TI e Ferramentas",
  despesas_viagem: "Viagens",
  despesas_juridicas: "Jurídico",
  despesas_financeiras: "Despesas Financeiras",
  simples_nacional: "Simples Nacional",
  irpj_csll: "IRPJ / CSLL",
  capex: "Investimento (CAPEX)",
  emprestimos_entrada: "Empréstimos (entrada)",
  amortizacao_dividas: "Amortização de Dívidas",
  transferencia_interna: "Transferência Interna",
  depreciacao: "Depreciação",
  outras_despesas: "Outras Despesas",
  nao_classificado: "Não Classificado",
};

export const BACKEND_CATEGORIES = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
  key,
  label,
  type: ["receita_bruta", "receita_financeira", "outras_receitas", "emprestimos_entrada"].includes(key)
    ? "income" as const
    : "expense" as const,
}));

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
  const rawCategory = entry.confirmedCategory ?? entry.predictedCategory ?? "nao_classificado";
  const type: TransactionType = entry.direction === "in" || entry.direction === "credit" ? "income" : "expense";
  const reviewStatus: ReviewStatus =
    entry.correctionSource === "needs_review" ? "needs_review"
    : entry.correctionSource === "rafael" || entry.correctionSource === "client" ? "corrected"
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
  };
}

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
    try {
      const { data } = await api.classification.review(activeId);
      setTransactions(data.map((e) => mapEntry(e, activeId)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar lançamentos");
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [user, activeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const correct = useCallback(
    async (entryId: string, category: string) => {
      await api.classification.correct(entryId, {
        category: category as Parameters<typeof api.classification.correct>[1]["category"],
      });
      await refresh();
    },
    [refresh]
  );

  return { transactions, loading, error, refresh, correct };
}
