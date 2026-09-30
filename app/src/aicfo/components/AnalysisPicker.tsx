import { useAnalyses } from "../data/useAnalyses.ts";
import { ChevronDown } from "lucide-react";

/**
 * Seletor compacto da análise ativa, usado no topo de DRE, Plano e Lançamentos.
 */
export function AnalysisPicker({ label = "Análise" }: { label?: string }) {
  const { analyses, activeId, setActiveId } = useAnalyses();

  if (analyses.length === 0) return null;

  return (
    <div className="inline-flex items-center gap-2">
      <span className="uppercase text-[11px] tracking-widest !opacity-30">
        {label}
      </span>
      <div className="relative">
        <select
          value={activeId ?? ""}
          onChange={(e) => setActiveId(e.target.value)}
          className="appearance-none dark:bg-[#0b0918] border border-[#151132] rounded-md pl-3 pr-8 py-2 text-[13px]  hover:border-[#96ff7e] transition-colors focus:outline-none focus:border-[#96ff7e] cursor-pointer"
        >
          {analyses.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 dark:text-[#96ff7e] pointer-events-none" />
      </div>
    </div>
  );
}
