import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createElement } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../auth/AuthContext.tsx";

export interface Analysis {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  updated_at: string;
}

export type NewAnalysis = {
  name: string;
  description?: string | null;
  period_start?: string | null;
  period_end?: string | null;
};

const STORAGE_KEY = "lumen.activeAnalysisId";

interface Ctx {
  analyses: Analysis[];
  loading: boolean;
  activeId: string | null;
  activeAnalysis: Analysis | null;
  setActiveId: (id: string | null) => void;
  refresh: () => Promise<void>;
  create: (input: NewAnalysis) => Promise<Analysis>;
  update: (id: string, patch: Partial<NewAnalysis>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const AnalysisContext = createContext<Ctx | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setAnalyses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("analyses")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Analysis[];
    setAnalyses(list);
    // garantir que activeId é válido
    if (list.length > 0 && (!activeId || !list.some((a) => a.id === activeId))) {
      setActiveId(list[0].id);
    } else if (list.length === 0 && activeId) {
      setActiveId(null);
    }
    setLoading(false);
  }, [user, activeId, setActiveId]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const create = useCallback(
    async (input: NewAnalysis): Promise<Analysis> => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("analyses")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      const created = data as Analysis;
      setAnalyses((prev) => [created, ...prev]);
      setActiveId(created.id);
      return created;
    },
    [user, setActiveId]
  );

  const update = useCallback(
    async (id: string, patch: Partial<NewAnalysis>) => {
      const { error } = await supabase.from("analyses").update(patch).eq("id", id);
      if (error) throw error;
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("analyses").delete().eq("id", id);
      if (error) throw error;
      if (activeId === id) setActiveId(null);
      await refresh();
    },
    [refresh, activeId, setActiveId]
  );

  const activeAnalysis = useMemo(
    () => analyses.find((a) => a.id === activeId) ?? null,
    [analyses, activeId]
  );

  const value: Ctx = {
    analyses,
    loading,
    activeId,
    activeAnalysis,
    setActiveId,
    refresh,
    create,
    update,
    remove,
  };

  return createElement(AnalysisContext.Provider, { value }, children);
}

export function useAnalyses() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalyses precisa estar dentro de <AnalysisProvider>");
  return ctx;
}