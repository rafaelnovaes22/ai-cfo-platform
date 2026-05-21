import { formatBRL } from "@/lumen/data/analytics";
import { useAnalyses } from "@/lumen/data/useAnalyses";
import { Check } from "lucide-react";

export default function AnalysesCard({ summaries }: { summaries: Record<string, { income: number; expense: number; count: number }> }) {
  const { analyses, activeId, setActiveId } = useAnalyses();

  return (
    <>
      <div className="flex items-end justify-between mb-2">
        <h2 className="font-semibold mb-4">Todas as análises ({analyses.length})</h2>
      </div>
      <div className="-mx-6 overflow-hidden divide-y dark:divide-[#0b0918]/50">
        {analyses.map((a) => {
          const s = summaries[a.id] ?? { income: 0, expense: 0, count: 0 };
          const net = s.income - s.expense;
          const margin = s.income > 0 ? (net / s.income) * 100 : 0;
          const isActive = a.id === activeId;
          return (
            <div
              key={a.id}
              className={`flex flex-wrap justify-between items-start md:grid grid-cols-12 md:items-center gap-2 px-6 py-4 transition-colors ${
                isActive ? "bg-cream dark:bg-[#15152f]" : "hover:bg-[#15152f]/10 hover:dark:bg-[#15152f]/40"
              }`}
            >
              <button
                onClick={() => setActiveId(a.id)}
                className="hidden col-span-1 md:flex items-center justify-start hover:"
                title={isActive ? "Análise ativa" : "Tornar ativa"}
              >
                {isActive ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#29c89b]">
                    <Check className="h-3 w-3" /> Ativa
                  </span>
                ) : (
                  <span className="text-[11px] underline underline-offset-2">Selecionar</span>
                )}
              </button>
              <div className="col-span-6 flex flex-col md:grid md:grid-cols-4 gap-0 md:gap-4">
                <div className="text-[17px] leading-tight">{a.name}</div>
                <div className="text-[11px] mt-0.5">{a.referenceMonth}</div>
                <div className="col-span-2 text-[12px]">{s.count} {s.count === 1 ? "lanç." : "lanç."}</div>
              </div>
              <div className="col-span-4 flex flex-col items-end md:grid md:grid-cols-4 gap-0 md:gap-4">
                <div className="col-span-2 text-[13px] tabular">{formatBRL(net)}</div>
                <div className={`col-span-2 text-[13px] ${margin >= 0 ? "text-[#29c89b]" : "text-[#ff9191]"}`}>
                  {margin.toFixed(1)}%
                </div>
              </div>
              <div className="col-span-1 flex w-full md:w-auto justify-between md:justify-end">
                <button
                  onClick={() => setActiveId(a.id)}
                  className="md:hidden col-span-1 flex items-center justify-start hover:"
                  title={isActive ? "Análise ativa" : "Tornar ativa"}
                >
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#29c89b]">
                      <Check className="h-3 w-3" /> ativa
                    </span>
                  ) : (
                    <span className="text-[11px] underline underline-offset-2">selecionar</span>
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
