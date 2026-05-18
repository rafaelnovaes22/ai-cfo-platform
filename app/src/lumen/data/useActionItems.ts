import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api/index.js";
import { useAuth } from "../auth/AuthContext";
import { useAnalyses } from "./useAnalyses";

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

export function useActionItems() {
  const { user } = useAuth();
  const { activeId } = useAnalyses();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !activeId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { items: raw } = await api.actionPlan.get(activeId);
      setItems(raw);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user, activeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const feedback = useCallback(
    async (itemId: string, approved: boolean, comment?: string) => {
      if (!activeId) return;
      await api.actionPlan.feedback(activeId, itemId, { approved, comment });
      await refresh();
    },
    [activeId, refresh]
  );

  return { items, loading, refresh, feedback };
}
