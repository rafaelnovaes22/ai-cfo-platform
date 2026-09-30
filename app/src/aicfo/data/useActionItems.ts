import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  createElement,
} from "react";
import { api } from "@/lib/api/index.js";
import { useAuth } from "../auth/AuthContext";
import { useAnalyses } from "./useAnalyses";
import { toast } from "sonner";

export interface ActionItem {
  id: string;
  horizon: "short" | "medium" | "long";
  title: string;
  description: string;
  effortLevel: "low" | "medium" | "high";
  riskLevel: "low" | "medium" | "high";
  impactCents: number;
  deadlineDays: number | null;
  doneWhen: string | null;
  clientApproved: boolean | null;
  clientComment: string | null;
}

interface ActionPlanCtx {
  items: ActionItem[];
  loading: boolean;
  error: Error | null;
  status: string | null;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  retry: () => Promise<void>;
  feedback: (
    itemId: string,
    approved: boolean,
    comment?: string
  ) => Promise<void>;
}

const ActionPlanContext = createContext<ActionPlanCtx | null>(null);

export function ActionPlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeId } = useAnalyses();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!user || !activeId) {
        setItems([]);
        setLoading(false);
        return;
      }
      if (!options?.silent) setLoading(true);
      setError(null);
      try {
        const { items: raw, analysisStatus } =
          await api.actionPlan.get(activeId);
        setItems(raw);
        setStatus(analysisStatus);
      } catch (e) {
        setError(
          e instanceof Error ? e : new Error("Erro ao carregar itens do plano")
        );
        setItems([]);
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [user, activeId]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Localized polling for action items
  const isTerminal =
    status != null &&
    ["ready", "completed", "failed", "approved", "delivered"].includes(status);

  useEffect(() => {
    if (!user || !activeId || isTerminal) return;

    const interval = setInterval(() => {
      refresh({ silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [user, activeId, isTerminal, refresh]);

  const retry = useCallback(async () => {
    if (!activeId) return;
    try {
      setError(null);
      setStatus("generating");
      await api.analyses.retry(activeId);
      await refresh();
    } catch (e) {
      toast.error("Erro ao reiniciar análise.");
    }
  }, [activeId, refresh]);

  const feedback = useCallback(
    async (itemId: string, approved: boolean, comment?: string) => {
      if (!activeId) return;
      await api.actionPlan.feedback(activeId, itemId, { approved, comment });
      await refresh({ silent: true });
    },
    [activeId, refresh]
  );

  const value = useMemo(
    () => ({
      items,
      loading,
      error,
      status,
      refresh,
      retry,
      feedback,
    }),
    [items, loading, error, status, refresh, retry, feedback]
  );

  return createElement(ActionPlanContext.Provider, { value }, children);
}

export function useActionItems() {
  const ctx = useContext(ActionPlanContext);
  if (!ctx) {
    throw new Error("useActionItems must be used within an ActionPlanProvider");
  }
  return ctx;
}
