import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../auth/AuthContext";
import { useAnalyses } from "./useAnalyses";

export type ActionStatus = "pending" | "in_progress" | "done";
export type ActionPriority = "low" | "medium" | "high";

export interface ActionItem {
  id: string;
  user_id: string;
  analysis_id: string;
  title: string;
  description: string | null;
  status: ActionStatus;
  priority: ActionPriority;
  ai_generated: boolean;
  due_date: string | null;
  position: number;
  created_at: string;
  updated_at: string;
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
    const { data } = await supabase
      .from("action_items")
      .select("*")
      .eq("analysis_id", activeId)
      .order("position", { ascending: true });
    setItems((data ?? []) as ActionItem[]);
    setLoading(false);
  }, [user, activeId]);

  useEffect(() => { refresh(); }, [refresh]);

  const updateStatus = useCallback(async (id: string, status: ActionStatus) => {
    await supabase.from("action_items").update({ status }).eq("id", id);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("action_items").delete().eq("id", id);
    await refresh();
  }, [refresh]);

  return { items, loading, refresh, updateStatus, remove };
}