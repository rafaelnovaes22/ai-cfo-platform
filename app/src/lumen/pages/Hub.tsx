import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardPaste,
  FileText,
  Sheet,
  PencilLine,
  Inbox,
  Check,
  Trash2,
} from "lucide-react";
import { useTransactions } from "../data/useTransactions";
import {
  listMonthKeys,
  summarizeMonth,
  compositionByType,
  formatBRL,
} from "../data/analytics";
import { useAuth } from "../auth/AuthContext";
import { useAnalyses } from "../data/useAnalyses.ts";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const inputMethods = [
  { id: "paste", icon: ClipboardPaste, label: "Colar planilha" },
  { id: "pdf", icon: FileText, label: "PDF do contador" },
  { id: "xls", icon: Sheet, label: "Excel / CSV" },
  { id: "manual", icon: PencilLine, label: "Lançamento manual" },
];

function formatPeriod(start: string, end: string) {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y.slice(2)}`;
  };
  return `${fmt(start)} → ${fmt(end)}`;
}

export default function Hub() {
  const { transactions, loading } = useTransactions();
  const { profile } = useAuth();
  const {
    analyses,
    activeId,
    activeAnalysis,
    setActiveId,
    remove: removeAnalysis,
  } = useAnalyses();
  const months = listMonthKeys(transactions);
  const currentKey = months[0];

  const current = currentKey ? summarizeMonth(transactions, currentKey) : null;
  const composition = currentKey
    ? compositionByType(transactions, currentKey)
    : null;

  const userName = profile?.name?.split(" ")[0] ?? "você";

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

  const otherAnalyses = analyses.filter((a) => a.id !== activeId);

  async function handleDeleteAnalysis(id: string, name: string) {
    if (
      !confirm(
        `Excluir a análise "${name}"? Todos os lançamentos e ações desta análise serão removidos.`
      )
    )
      return;
    try {
      // limpa dependentes primeiro (sem ON DELETE CASCADE)
      await supabase.from("transactions").delete().eq("analysis_id", id);
      await supabase.from("action_items").delete().eq("analysis_id", id);
      await removeAnalysis(id);
      toast.success("Análise removida.");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover análise");
    }
  }

  return (
    <div className="space-y-12">
      <header className="animate-fade-up">
        <div className="uppercase text-[11px] tracking-widest mb-4">
          Hub de análises · {profile?.name ?? "Sua empresa"}
        </div>
        <h1 className=" text-[44px] leading-[1.05] tracking-tight  max-w-2xl">
          {activeAnalysis ? activeAnalysis.name : "Suas análises financeiras"}
        </h1>
        <p className="text-[#96ff7e] mt-3 text-[15px]">
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
      </header>

      {analyses.length === 0 && !loading && <EmptyState userName={userName} />}

      {current && composition && (
        <section className="animate-fade-up delay-1 grid grid-cols-12 gap-6">
          <article className="col-span-12 bg-card border border-border rounded-lg shadow-card overflow-hidden">
            <div className="grid grid-cols-12">
              <div className="col-span-12 lg:col-span-8 p-10 border-b lg:border-b-0 lg:border-r border-border">
                <div className="flex items-center gap-2 mb-8">
                  <span className="uppercase text-[11px] tracking-widest">
                    Período analisado
                  </span>
                  <span className="h-px w-10 bg-border" />
                  <span className=" text-[11px] text-[#96ff7e]">
                    REF · {current.periodShort}
                  </span>
                </div>
                <div className=" italic text-[18px] text-[#96ff7e] mb-4">
                  {current.period}
                </div>
                <div className="text-[88px] leading-none tracking-tight  tabular font-sans">
                  {formatBRL(current.netProfit)}
                </div>
                <div className="mt-5 flex items-center gap-3 text-[13px]">
                  <span className="text-[#96ff7e]">Lucro líquido · margem</span>
                  <span
                    className={` font-medium ${
                      current.margin >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {current.margin}%
                  </span>
                </div>

                <div className="flex flex-wrap gap-3 mt-10">
                  <Link
                    to="/dre"
                    className="group inline-flex items-center gap-2 bg-[#111164] text-cream px-5 py-3 rounded-md text-[13.5px] hover:bg-[#111164]/90 transition-colors"
                  >
                    Ver DRE completo
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <Link
                    to="/plano"
                    className="group inline-flex items-center gap-2 border border-[#96ff7e]  px-5 py-3 rounded-md text-[13.5px] hover:bg-[#111164] hover:text-cream transition-colors"
                  >
                    Ver plano de ação
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
              <aside className="col-span-12 lg:col-span-4 p-10 bg-cream-deep/50 flex flex-col justify-between">
                <div>
                  <div className="uppercase text-[11px] tracking-widest mb-4">
                    Composição do mês
                  </div>
                  <ul className="space-y-4 text-[13px]">
                    <li className="flex justify-between items-baseline">
                      <span className="text-[#96ff7e]">Receita</span>
                      <span className=" text-positive">
                        {formatBRL(composition.income)}
                      </span>
                    </li>
                    <li className="flex justify-between items-baseline">
                      <span className="text-[#96ff7e]">Despesas</span>
                      <span className=" text-negative">
                        {formatBRL(-composition.expense)}
                      </span>
                    </li>
                    <li className="flex justify-between items-baseline pt-4 border-t border-border">
                      <span className="">Lucro líquido</span>
                      <span className="  font-medium">
                        {formatBRL(composition.net)}
                      </span>
                    </li>
                  </ul>
                </div>
                <p className="text-[12px] text-[#96ff7e] mt-8 leading-relaxed">
                  Análise gerada a partir de {current.count} lançamentos.
                </p>
              </aside>
            </div>
          </article>
        </section>
      )}

      {analyses.length > 0 && (
        <section className="animate-fade-up delay-2">
          <div className="flex items-end justify-between mb-5">
            <h2 className=" text-[26px] tracking-tight ">Todas as análises</h2>
            <span className="text-[12px] text-[#96ff7e]">
              {analyses.length} {analyses.length === 1 ? "análise" : "análises"}
            </span>
          </div>
          <div className="border border-border rounded-lg bg-card overflow-hidden divide-y divide-border">
            {analyses.map((a) => {
              const s = summaries[a.id] ?? { income: 0, expense: 0, count: 0 };
              const net = s.income - s.expense;
              const margin = s.income > 0 ? (net / s.income) * 100 : 0;
              const isActive = a.id === activeId;
              return (
                <div
                  key={a.id}
                  className={`grid grid-cols-12 items-center gap-2 px-6 py-4 transition-colors ${
                    isActive ? "bg-cream-deep/60" : "hover:bg-cream-deep/40"
                  }`}
                >
                  <button
                    onClick={() => setActiveId(a.id)}
                    className="col-span-1 flex items-center justify-start text-[#96ff7e] hover:"
                    title={isActive ? "Análise ativa" : "Tornar ativa"}
                  >
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-positive ">
                        <Check className="h-3 w-3" /> ativa
                      </span>
                    ) : (
                      <span className="text-[11px]  underline underline-offset-2">
                        selecionar
                      </span>
                    )}
                  </button>
                  <div className="col-span-4">
                    <div className=" text-[17px]  leading-tight">{a.name}</div>
                    {a.period_start && a.period_end && (
                      <div className=" text-[11px] text-[#96ff7e] mt-0.5">
                        {formatPeriod(a.period_start, a.period_end)}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2  text-[12px] text-[#96ff7e]">
                    {s.count} {s.count === 1 ? "lanç." : "lanç."}
                  </div>
                  <div className="col-span-2  text-[13px]  tabular">
                    {formatBRL(net)}
                  </div>
                  <div
                    className={`col-span-2  text-[13px] ${
                      margin >= 0 ? "text-positive" : "text-negative"
                    }`}
                  >
                    {margin.toFixed(1)}%
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => handleDeleteAnalysis(a.id, a.name)}
                      className="p-1.5 rounded text-[#96ff7e] hover:text-negative hover:bg-cream-deep"
                      title="Excluir análise"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="animate-fade-up delay-3">
        <div className="border border-border rounded-lg bg-card p-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className=" text-[24px] tracking-tight ">
                {current ? "Criar nova análise" : "Iniciar primeira análise"}
              </h2>
              <p className="text-[13px] text-[#96ff7e] mt-1">
                Escolha o formato dos dados e leve cerca de 2 minutos.
              </p>
            </div>
            <Link
              to="/importar"
              className="text-[12.5px]  underline underline-offset-4 decoration-border hover:decoration-[#111164]"
            >
              Ver todos os métodos
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {inputMethods.map((m) => (
              <Link
                key={m.id}
                to={`/importar?method=${m.id}`}
                className="group flex items-center gap-3 p-4 rounded-md border border-border hover:border-[#96ff7e] hover:bg-cream-deep/40 transition-all"
              >
                <m.icon
                  className="h-4 w-4 text-[#96ff7e] group-hover:"
                  strokeWidth={1.6}
                />
                <span className="text-[13px] ">{m.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ userName }: { userName: string }) {
  return (
    <section className="animate-fade-up delay-1 bg-card border border-border rounded-lg p-12 text-center">
      <Inbox
        className="h-10 w-10 mx-auto text-[#96ff7e] mb-4"
        strokeWidth={1.4}
      />
      <h2 className=" text-[28px] tracking-tight  mb-2">
        Vamos começar, {userName}?
      </h2>
      <p className="text-[14px] text-[#96ff7e] max-w-md mx-auto mb-6">
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
