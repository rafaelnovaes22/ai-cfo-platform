import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  ClipboardPaste,
  FileText,
  Sheet,
  PencilLine,
  Inbox,
} from "lucide-react";
import { useTransactions } from "../data/useTransactions.ts";
import {
  listMonthKeys,
  summarizeMonth,
  compositionByType,
} from "../data/analytics.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { useAnalyses } from "../data/useAnalyses.ts";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import CompositionCard from "@/components/CompositionCard.tsx";
import ActionListCard from "@/components/ActionListCard.tsx";
import ProcessingOverlay from "@/components/ProcessingOverlay.tsx";
import { useActionItems } from "../data/useActionItems.ts";
import CreateAnalysisCard from "@/components/CreateAnalysisCard.tsx";
import AnalysesCard from "@/components/AnalysesCard.tsx";
import DashboardCard from "@/components/DashboardCard.tsx";
import ResultChart from "@/components/ResultChart.tsx";
import AccountsCard from "@/components/AccountsCard.tsx";
import PaymentsCard from "@/components/PaymentsCard.tsx";
import KPIsCard from "@/components/KPIsCard.tsx";
import MonthlyViewChart from "@/components/MonthlyViewChart.tsx";

const inputMethods = [
  { id: "paste", icon: ClipboardPaste, label: "Colar planilha" },
  { id: "pdf", icon: FileText, label: "PDF do contador" },
  { id: "xls", icon: Sheet, label: "Excel / CSV" },
  { id: "manual", icon: PencilLine, label: "Lançamento manual" },
];

export default function Dashboard() {
  const { transactions, loading: transactionsLoading } = useTransactions();
  const { user } = useAuth();
  const {
    analyses,
    trend,
    anomaly,
    activeId,
    activeAnalysis,
    loading: analysesLoading,
    isProcessing,
  } = useAnalyses();
  const navigate = useNavigate();
  const location = useLocation();
  const months = listMonthKeys(transactions);
  const currentKey = months[0];

  // Force show overlay if we just came from an import
  const [isInitialGeneration, setIsInitialGeneration] = useState(
    location.state?.showAnalysisOverlay ?? false
  );

  useEffect(() => {
    if (isInitialGeneration && !isProcessing && analyses.length > 0) {
      // Once it's no longer processing (and we have analyses), we can hide it
      setIsInitialGeneration(false);
    }
  }, [isInitialGeneration, isProcessing, analyses]);

  const current = currentKey ? summarizeMonth(transactions, currentKey) : {};
  const composition = currentKey
    ? compositionByType(transactions, currentKey)
    : {};

  // const userName = user?.userId?.split("@")[0] ?? "você";
  const userName = "você";

  useActionItems();

  function handleGenerate() {
    toast.error("O plano é gerado automaticamente após importar os dados.");
  }

  const summaries: Record<
    string,
    { income: number; expense: number; count: number }
  > = {};

  if (analysesLoading && analyses.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-pulse text-[13px] dark:text-copper">
          Carregando…
        </div>
      </div>
    );
  }

  if ((isProcessing || isInitialGeneration) && !current) {
    return <ProcessingOverlay />;
  }

  return (
    <div className="space-y-6 relative">
      <header className="animate-fade-up">
        <p className="eyebrow mb-3">Visão geral</p>
        <h1 className="font-serif text-[32px] md:text-[40px] leading-[1.05] tracking-tight max-w-2xl">
          {activeAnalysis ? activeAnalysis.name : "Suas análises financeiras"}
        </h1>
        <p className="mt-3 text-[15px] opacity-65">
          {analyses.length === 0
            ? analysesLoading
              ? "Carregando…"
              : "Crie sua primeira análise importando dados ou cadastrando lançamentos."
            : `${analyses.length} ${
                analyses.length === 1 ? "análise" : "análises"
              } no total. Selecione uma abaixo para ver os detalhes.`}
        </p>
      </header>

      {analyses.length === 0 && !analysesLoading && (
        <div className="absolute top-[30vh] left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <div className="relative z-[1] animate-fade-up">
            <EmptyState userName={userName} />
          </div>
          <div className="absolute inset-0 bg-cream/80 dark:bg-night/80 -z-1 blur-2xl"></div>
        </div>
      )}
      <div
        className={`flex flex-wrap -mx-4 md:mx-0 gap-4 ${analyses.length === 0 && !analysesLoading ? "blur-md pointer-events-none max-h-[calc(100vh-300px)] md:max-h-[calc(100vh-370px)] overflow-hidden opacity-50" : ""}`}
      >
        {current && composition && (
          <div className="relative bg-ink text-cream overflow-hidden rounded-lg border-t-2 border-t-copper py-6 px-6 animate-fade-up delay-1 min-w-full md:min-w-[440px] grow grow-1">
            <CompositionCard
              current={current}
              composition={composition}
              monthLabel={currentKey?.split("-").reverse().join("/")}
            />
          </div>
        )}

        <DashboardCard className="md:min-w-[490px] grow-[2]">
          <p className="eyebrow mb-4">01 · Ações do plano</p>
          <ActionListCard current={current} transactions={transactions} />
        </DashboardCard>

        {current && trend?.length > 1 && (
          <div className="w-full">
            <p className="eyebrow mb-4">02 · Evolução</p>
            {/* trend já vem em reais (normalizado em api.analyses.trend). */}
            <MonthlyViewChart chartData={trend} />
          </div>
        )}

        {current && (
          <DashboardCard className="md:min-w-[490px] md:max-w-[700px] grow-[2]">
            <ResultChart />
          </DashboardCard>
        )}

        <DashboardCard className="md:min-w-[320px] grow-[1]">
          <CreateAnalysisCard current={current} inputMethods={inputMethods} />
        </DashboardCard>

        {current && (
          <DashboardCard className="md:min-w-[440px] grow-[1]">
            <AccountsCard />
          </DashboardCard>
        )}

        {current && (
          <DashboardCard className="md:min-w-[440px] grow-[1]">
            <PaymentsCard />
          </DashboardCard>
        )}

        {current && (
          <DashboardCard className="md:min-w-[440px] grow-[1]">
            <KPIsCard />
          </DashboardCard>
        )}

        {analyses.length > 0 && (
          <DashboardCard className="min-w-full">
            <AnalysesCard summaries={summaries} />
          </DashboardCard>
        )}
      </div>
    </div>
  );
}

function EmptyState({ userName }: { userName: string }) {
  return (
    <section className="animate-fade-up delay-1 w-full mx-auto rounded-lg p-12 text-center">
      <Inbox className="h-10 w-10 mx-auto  mb-4" strokeWidth={1.4} />
      <h2 className=" text-[28px] tracking-tight  mb-2">
        {/* Vamos começar, {userName}? */}
        Vamos começar?
      </h2>
      <p className="text-[14px]  max-w-md mx-auto mb-6">
        Importe um extrato, cole uma planilha ou adicione lançamentos manuais
        para gerar sua primeira análise.
      </p>
      <Link
        to="/importar"
        className="inline-flex items-center gap-2 bg-ink text-cream px-5 py-3 rounded-md text-[13.5px] hover:bg-ink/90 transition-colors"
      >
        Trazer meus números
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
