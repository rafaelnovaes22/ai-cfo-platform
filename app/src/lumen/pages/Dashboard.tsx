import { Link } from "react-router-dom";
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
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import CompositionCard from "@/components/CompositionCard.tsx";
import ActionListCard from "@/components/ActionListCard.tsx";
import { useActionItems, type ActionItem } from "../data/useActionItems.ts";
import CreateAnalysisCard from "@/components/CreateAnalysisCard.tsx";
import AnalysesCard from "@/components/AnalysesCard.tsx";
import DashboardCard from "@/components/DashboardCard.tsx";
import ResultChart from "@/components/ResultChart.tsx";
import AccountsCard from "@/components/AccountsCard.tsx";
import PaymentsCard from "@/components/PaymentsCard.tsx";
import KPIsCard from "@/components/KPIsCard.tsx";
import DemoRibbon from "@/components/DemoRibbon.tsx";

const inputMethods = [
  { id: "paste", icon: ClipboardPaste, label: "Colar planilha" },
  { id: "pdf", icon: FileText, label: "PDF do contador" },
  { id: "xls", icon: Sheet, label: "Excel / CSV" },
  { id: "manual", icon: PencilLine, label: "Lançamento manual" },
];

export default function Dashboard() {
  const { transactions, loading } = useTransactions();
  const { profile } = useAuth();
  const { analyses, activeId, activeAnalysis } = useAnalyses();
  const months = listMonthKeys(transactions);
  const currentKey = months[0];

  const current = currentKey ? summarizeMonth(transactions, currentKey) : null;
  const composition = currentKey
    ? compositionByType(transactions, currentKey)
    : null;

  const userName = profile?.name?.split(" ")[0] ?? "você";

  const { refresh } = useActionItems();

  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    if (!activeId) {
      toast.error("Selecione uma análise primeiro.");
      return;
    }
    if (transactions.length === 0) {
      toast.error("Adicione lançamentos primeiro para gerar o plano.");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-plan", {
        body: { analysis_id: activeId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Plano gerado com ${(data as any).count} ações`);
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao gerar plano");
    } finally {
      setGenerating(false);
    }
  }

  // Resumo agregado por análise (independente da análise ativa)
  const [summaries, setSummaries] = useState<
    Record<string, { income: number; expense: number; count: number }>
  >({});
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (analyses.length === 0) return;
      const ids = analyses.map((a) => a.id);
      const { data } = await supabase
        .from("transactions")
        .select("analysis_id, type, amount")
        .in("analysis_id", ids);
      if (cancelled || !data) return;
      const map: Record<
        string,
        { income: number; expense: number; count: number }
      > = {};
      for (const row of data as any[]) {
        const id = row.analysis_id as string;
        const cur = map[id] ?? { income: 0, expense: 0, count: 0 };
        if (row.type === "income") cur.income += Number(row.amount);
        else cur.expense += Number(row.amount);
        cur.count += 1;
        map[id] = cur;
      }
      setSummaries(map);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [analyses]);

  return (
    <div className="space-y-6">
      <header className="animate-fade-up flex items-end justify-between">
        <div>
          <h1 className="text-2xl tracking-tight  max-w-2xl">
            {activeAnalysis ? activeAnalysis.name : "Suas análises financeiras"}
          </h1>
          <p className=" mt-2 text-sm opacity-65">
            {analyses.length === 0
              ? loading
                ? "Carregando…"
                : "Crie sua primeira análise importando dados ou cadastrando lançamentos."
              : activeAnalysis?.description
              ? activeAnalysis.description
              : `${analyses.length} ${
                  analyses.length === 1 ? "análise" : "análises"
                } no total. Selecione uma abaixo para ver os detalhes.`}
          </p>
        </div>
        <div></div>
      </header>

      <div className="flex flex-wrap -mx-4 md:mx-0 gap-4">
        {analyses.length === 0 && !loading && (
          <EmptyState userName={userName} />
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
          <ActionListCard
            handleGenerate={handleGenerate}
            generating={generating}
            transactions={transactions}
          />
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
        Vamos começar, {userName}?
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
