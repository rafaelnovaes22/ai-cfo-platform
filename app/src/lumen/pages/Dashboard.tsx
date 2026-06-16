import { Link, useNavigate } from "react-router-dom";
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
import { useActionItems } from "../data/useActionItems.ts";
import CreateAnalysisCard from "@/components/CreateAnalysisCard.tsx";
import AnalysesCard from "@/components/AnalysesCard.tsx";
import DashboardCard from "@/components/DashboardCard.tsx";
import ResultChart from "@/components/ResultChart.tsx";
import AccountsCard from "@/components/AccountsCard.tsx";
import PaymentsCard from "@/components/PaymentsCard.tsx";
import KPIsCard from "@/components/KPIsCard.tsx";
import DemoRibbon from "@/components/DemoRibbon.tsx";
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
  } = useAnalyses();
  const navigate = useNavigate();
  const months = listMonthKeys(transactions);
  const currentKey = months[0];

  // console.log("trend/anomaly", trend, anomaly);

  const current = currentKey ? summarizeMonth(transactions, currentKey) : null;
  const composition = currentKey
    ? compositionByType(transactions, currentKey)
    : null;

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
        <div className="animate-pulse text-[13px] dark:text-[#96ff7e]">
          Carregando…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex items-end justify-between">
        <div>
          <h1 className="text-2xl tracking-tight  max-w-2xl">
            {activeAnalysis ? activeAnalysis.name : "Suas análises financeiras"}
          </h1>
          <p className=" mt-2 text-sm opacity-65">
            {analyses.length === 0
              ? analysesLoading
                ? "Carregando…"
                : "Crie sua primeira análise importando dados ou cadastrando lançamentos."
              : `${analyses.length} ${
                  analyses.length === 1 ? "análise" : "análises"
                } no total. Selecione uma abaixo para ver os detalhes.`}
          </p>
        </div>
        <div></div>
      </header>

      <div className="flex flex-wrap -mx-4 md:mx-0 gap-4">
        {analyses.length === 0 && !analysesLoading && (
          <EmptyState userName={userName} />
        )}

        {current && trend?.length > 1 && (
          <div className="w-full">
            {/* trend já vem em reais (normalizado em api.analyses.trend). */}
            <MonthlyViewChart chartData={trend} />
          </div>
        )}

        {current && composition && (
          <div className="relative bg-gradient-to-br from-[#7a21ff] via-[#9900ff] to-[#140f73] overflow-hidden rounded-3xl py-6 px-6 animate-fade-up delay-1 min-w-full md:min-w-[440px] grow grow-1">
            <CompositionCard current={current} composition={composition} />
            <div className="absolute top-0 left-0 w-full h-full -z-1 rotate-180 md:rotate-0 md:scale-150 bg-[url('https://images.unsplash.com/photo-1635776063043-ab23b4c226f6?fm=jpg&q=60&w=1000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')] bg-cover"></div>
          </div>
        )}

        {current && (
          <DashboardCard className="md:min-w-[490px] md:max-w-[700px] grow-[2]">
            <DemoRibbon />
            <ResultChart />
          </DashboardCard>
        )}

        <DashboardCard className="md:min-w-[490px] grow-[2]">
          <ActionListCard current={current} transactions={transactions} />
        </DashboardCard>

        <DashboardCard className="md:min-w-[320px] grow-[1]">
          <CreateAnalysisCard current={current} inputMethods={inputMethods} />
        </DashboardCard>

        {current && (
          <DashboardCard className="md:min-w-[440px] grow-[1]">
            <DemoRibbon />
            <AccountsCard />
          </DashboardCard>
        )}

        {current && (
          <DashboardCard className="md:min-w-[440px] grow-[1]">
            <DemoRibbon />
            <PaymentsCard />
          </DashboardCard>
        )}

        {current && (
          <DashboardCard className="md:min-w-[440px] grow-[1]">
            <DemoRibbon />
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
        className="inline-flex items-center gap-2 bg-[#111164] text-cream px-5 py-3 rounded-md text-[13.5px] hover:bg-[#111164]/90 transition-colors"
      >
        Trazer meus números
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
