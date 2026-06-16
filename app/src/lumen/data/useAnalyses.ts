import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createElement } from "react";
import {
  api,
  type AnomalyTimelinePoint,
  type TrendPoint,
} from "@/lib/api/index.js";
import { useAuth } from "../auth/AuthContext.tsx";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function deriveName(referenceMonth: string): string {
  const [year, month] = referenceMonth.split("-");
  return `${MONTHS[Number(month) - 1] ?? month} ${year}`;
}

export interface Analysis {
  id: string;
  referenceMonth: string;
  name: string;
  status: string;
  mode: string;
  deliveredAt: string | null;
  approvedAt: string | null;
  costCents: number | null;
  totalImpactCents: number | null;
  // Optional legacy fields (not populated by API — kept for exportDRE.ts compat)
  description?: string | null;
  period_start?: string | null;
  period_end?: string | null;
}

export type AnalysisUIState = "PROCESSING" | "FAILED" | "READY" | "INSUFFICIENT_DATA";

function deriveAnalysisUIState(analysis: Analysis, hasData?: boolean): AnalysisUIState {
  if (analysis.status === "failed") return "FAILED";
  if (TERMINAL_STATUSES.has(analysis.status)) {
    if (analysis.status === "ready" && hasData === false) return "INSUFFICIENT_DATA";
    return "READY";
  }
  return "PROCESSING";
}

const STORAGE_KEY = "lumen.activeAnalysisId";

const TERMINAL_STATUSES = new Set([
  "pending",
  "completed",
  "ready",
  "delivered",
  "approved",
  "failed",
]);

interface Ctx {
  analyses: Analysis[];
  loading: boolean;
  activeId: string | null;
  activeAnalysis: Analysis | null;
  isProcessing: boolean;
  uiState: AnalysisUIState | null;
  trend: TrendPoint[] | null;
  anomaly: AnomalyTimelinePoint[] | null;
  setActiveId: (id: string | null) => void;
  refresh: () => Promise<void>;
}

const AnalysisContext = createContext<Ctx | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [anomaly, setAnomaly] = useState<AnomalyTimelinePoint[]>([]);
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

  const refresh = useCallback(async (options?: { silent?: boolean; onlyList?: boolean }) => {
    const silent = options?.silent ?? false;
    const onlyList = options?.onlyList ?? false;

    if (!silent) setLoading(true);
    let list: Analysis[] = [];
    try {
      const { analyses: raw } = await api.analyses.list();
      list = raw.map((a) => ({
        ...a,
        name: deriveName(a.referenceMonth),
      }));
      setAnalyses(list);
    } catch {
      setAnalyses([]);
    } finally {
      if (!silent) setLoading(false);
    }

    if (onlyList) return;

    // Se a análise ativa (ou a primeira da lista) estiver gerando, 
    // não adianta buscar trend/anomaly pois o backend ainda não processou.
    const currentActiveId = activeId || (list.length > 0 ? list[0].id : null);
    const currentActive = list.find(a => a.id === currentActiveId);
    if (currentActive?.status === "generating") {
      setAnomaly([]);
      setTrend([]);
      return;
    }

    try {
      const { timeline: anomalyRaw } = await api.analyses.anomalyTimeline();
      setAnomaly(anomalyRaw);
    } catch {
      setAnomaly([]);
    }

    try {
      const { trend: trendRaw } = await api.analyses.trend();
      setTrend(trendRaw);
    } catch {
      setTrend([]);
    }
  }, [activeId]);

  useEffect(() => {
    if (!user) {
      setAnalyses([]);
      setTrend([]);
      setAnomaly([]);
      setLoading(false);
      return;
    }
    refresh();
  }, [user, refresh]);

  useEffect(() => {
    if (
      analyses.length > 0 &&
      (!activeId || !analyses.some((a) => a.id === activeId))
    ) {
      setActiveId(analyses[0].id);
    } else if (analyses.length === 0 && activeId) {
      setActiveId(null);
    }
  }, [analyses, activeId, setActiveId]);

  const needsPolling =
    user != null && analyses.some((a) => !TERMINAL_STATUSES.has(a.status));
  useEffect(() => {
    if (!needsPolling) return;
    // When polling for status, only refresh the list to avoid heavy dashboard updates
    const id = setInterval(() => refresh({ silent: true, onlyList: true }), 4000);
    return () => clearInterval(id);
  }, [needsPolling, refresh]);

  const activeAnalysis = useMemo(
    () => analyses.find((a) => a.id === activeId) ?? null,
    [analyses, activeId]
  );

  const isProcessing = useMemo(
    () => activeAnalysis != null && !TERMINAL_STATUSES.has(activeAnalysis.status),
    [activeAnalysis]
  );

  const uiState = useMemo(() => {
    if (!activeAnalysis) return null;
    return deriveAnalysisUIState(activeAnalysis);
  }, [activeAnalysis]);

  const value: Ctx = {
    analyses,
    trend,
    anomaly,
    loading,
    activeId,
    activeAnalysis,
    isProcessing,
    uiState,
    setActiveId,
    refresh,
  };

  return createElement(AnalysisContext.Provider, { value }, children);
}

export function useAnalyses() {
  const ctx = useContext(AnalysisContext);
  if (!ctx)
    throw new Error("useAnalyses precisa estar dentro de <AnalysisProvider>");
  return ctx;
}
