import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lumen/data/analytics";
import { useAnalyses } from "@/lumen/data/useAnalyses";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";

function formatPeriod(start: string, end: string) {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y.slice(2)}`;
  };
  return `${fmt(start)} → ${fmt(end)}`;
}

export default function AnalysesCard({ summaries }) {
  const {
    analyses,
    activeId,
    setActiveId,
    remove: removeAnalysis,
  } = useAnalyses();

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
    <>
      <div className="flex items-end justify-between mb-2">
        <h2 className="font-semibold mb-4">
          Todas as análises ({analyses.length})
        </h2>
      </div>
      <div className="-mx-6 overflow-hidden divide-y dark:divide-[#0b0918]/50">
        {analyses.map((a) => {
          const s = summaries[a.id] ?? {
            income: 0,
            expense: 0,
            count: 0,
          };
          const net = s.income - s.expense;
          const margin = s.income > 0 ? (net / s.income) * 100 : 0;
          const isActive = a.id === activeId;
          return (
            <div
              key={a.id}
              className={`flex flex-wrap justify-between items-start md:grid grid-cols-12 md:items-center gap-2 px-6 py-4 transition-colors ${
                isActive
                  ? "bg-cream dark:bg-[#15152f]"
                  : "hover:bg-[#15152f]/10 hover:dark:bg-[#15152f]/40"
              }`}
            >
              <button
                onClick={() => setActiveId(a.id)}
                className="hidden col-span-1 md:flex items-center justify-start  hover:"
                title={isActive ? "Análise ativa" : "Tornar ativa"}
              >
                {isActive ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#29c89b] ">
                    <Check className="h-3 w-3" /> Ativa
                  </span>
                ) : (
                  <span className="text-[11px]  underline underline-offset-2">
                    Selecionar
                  </span>
                )}
              </button>
              <div className="col-span-6 flex flex-col md:grid md:grid-cols-4 gap-0 md:gap-4">
                <div className=" text-[17px]  leading-tight">{a.name}</div>
                {a.period_start && a.period_end && (
                  <div className=" text-[11px]  mt-0.5">
                    {formatPeriod(a.period_start, a.period_end)}
                  </div>
                )}
                <div className="col-span-2  text-[12px] ">
                  {s.count} {s.count === 1 ? "lanç." : "lanç."}
                </div>
              </div>
              <div className="col-span-4 flex flex-col items-end md:grid md:grid-cols-4 gap-0 md:gap-4">
                <div className="col-span-2  text-[13px]  tabular">
                  {formatBRL(net)}
                </div>
                <div
                  className={`col-span-2  text-[13px] ${
                    margin >= 0 ? "text-[#29c89b]" : "text-[#ff9191]"
                  }`}
                >
                  {margin.toFixed(1)}%
                </div>
              </div>
              <div className="col-span-1 flex w-full md:w-auto justify-between md:justify-end">
                <button
                  onClick={() => handleDeleteAnalysis(a.id, a.name)}
                  className="p-1.5 rounded hover:text-[#ff9191] hover:bg-[#1f1f47]"
                  title="Excluir análise"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setActiveId(a.id)}
                  className="md:hidden col-span-1 flex items-center justify-start  hover:"
                  title={isActive ? "Análise ativa" : "Tornar ativa"}
                >
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#29c89b] ">
                      <Check className="h-3 w-3" /> ativa
                    </span>
                  ) : (
                    <span className="text-[11px]  underline underline-offset-2">
                      selecionar
                    </span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
