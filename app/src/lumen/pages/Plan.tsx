import { useMemo, useState } from "react";
import {
  ThumbsUp,
  ThumbsDown,
  Inbox,
  Zap,
  Shield,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useActionItems, type ActionItem } from "../data/useActionItems";
import { useAnalyses } from "../data/useAnalyses.ts";
import { formatBRL } from "../data/analytics";
import { toast } from "sonner";

type Horizon = "short" | "medium" | "long";

const horizons: { id: Horizon; num: string; label: string; sub: string }[] = [
  { id: "short", num: "01", label: "Curto prazo", sub: "Até 3 meses" },
  { id: "medium", num: "02", label: "Médio prazo", sub: "3 a 12 meses" },
  { id: "long", num: "03", label: "Longo prazo", sub: "Acima de 1 ano" },
];

const effortChip: Record<string, string> = {
  low: "dark:bg-[#08382a] text-[#29c89b] border border-[#157d60]",
  medium: "dark:bg-[#493210] text-[#ffc66e] border border-[#9c7335]",
  high: "dark:bg-[#441616] text-[#ff9191] border border-[#a64c4c]",
};
const effortLabel: Record<string, string> = {
  low: "Esforço baixo",
  medium: "Esforço médio",
  high: "Esforço alto",
};

const riskChip: Record<string, string> = {
  low: "dark:bg-[#08382a] text-[#29c89b] border border-[#157d60]",
  medium: "dark:bg-[#493210] text-[#ffc66e] border border-[#9c7335]",
  high: "dark:bg-[#441616] text-[#ff9191] border border-[#a64c4c]",
};
const riskLabel: Record<string, string> = {
  low: "Risco baixo",
  medium: "Risco médio",
  high: "Risco alto",
};

export default function Plan() {
  const { items, loading, feedback } = useActionItems();
  const { activeAnalysis } = useAnalyses();
  const [horizon, setHorizon] = useState<Horizon>("short");

  const grouped = useMemo(() => {
    const map: Record<Horizon, ActionItem[]> = {
      short: [],
      medium: [],
      long: [],
    };
    items.forEach((i) => map[i.horizon].push(i));
    return map;
  }, [items]);

  const actions = grouped[horizon];

  if (!loading && items.length === 0) {
    return (
      <div className="space-y-10">
        <header className="animate-fade-up">
          <div className="uppercase text-[11px] tracking-widest !opacity-30 mb-3">
            Plano de ação{activeAnalysis ? ` · ${activeAnalysis.name}` : ""}
          </div>
          <h1 className="text-3xl leading-[1.05] tracking-tight">
            Próximos passos para a sua empresa
          </h1>
        </header>
        <section className="dark:bg-[#15152f] border dark:border-[#15152f]/50 rounded-lg p-12 text-center">
          <Inbox
            className="h-10 w-10 mx-auto dark:text-[#96ff7e] mb-4"
            strokeWidth={1.4}
          />
          <h2 className="text-[26px] tracking-tight mb-2">
            Nenhum plano ainda
          </h2>
          <p className="text-[14px] dark:text-[#96ff7e] max-w-md mx-auto mb-6">
            O plano de ação é gerado automaticamente após a importação dos seus
            dados.
          </p>
          <Link
            to="/importar"
            className="inline-flex items-center gap-2 bg-[#111164] text-cream px-5 py-3 rounded-md text-[13.5px] hover:bg-[#111164]/90"
          >
            Importar dados
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <header className="animate-fade-up flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="uppercase text-[11px] tracking-widest mb-3 !opacity-30">
            Plano de ação{activeAnalysis ? ` · ${activeAnalysis.name}` : ""}
          </div>
          <h1 className="text-2xl leading-[1.05] tracking-tight">
            Próximos passos para a sua empresa
          </h1>
        </div>
      </header>

      <div className="animate-fade-up delay-1 flex border-b dark:border-[#15152f]">
        {horizons.map((h) => {
          const active = horizon === h.id;
          const count = grouped[h.id].length;
          return (
            <button
              key={h.id}
              onClick={() => setHorizon(h.id)}
              className={`flex !text-left flex-col items-start px-2 md:px-5 pb-3 -mb-px border-b-2 transition-colors ${
                active
                  ? "border-[#3D24A0] dark:border-[#96ff7e]"
                  : "border-transparent opacity-50 hover:"
              }`}
            >
              <span className="md:text-[18px]">
                {h.label}{" "}
                {count > 0 && <span className="text-[10.5px]">({count})</span>}
              </span>
              <span className="text-[11.5px] text-[#3D24A0] dark:text-[#96ff7e]">
                {h.sub}
              </span>
            </button>
          );
        })}
      </div>

      {actions.length === 0 ? (
        <p className="text-[13px] text-[#3D24A0] dark:text-[#96ff7e] italic">
          Nenhuma ação neste horizonte.
        </p>
      ) : (
        <section className="space-y-4">
          {actions.map((a, i) => (
            <ActionCard
              key={a.id}
              num={String(i + 1).padStart(2, "0")}
              item={a}
              onFeedback={async (approved) => {
                try {
                  await feedback(a.id, approved);
                  toast.success(
                    approved ? "Ação aprovada." : "Ação rejeitada."
                  );
                } catch {
                  toast.error("Erro ao registrar feedback.");
                }
              }}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function ActionCard({
  num,
  item,
  onFeedback,
}: {
  num: string;
  item: ActionItem;
  onFeedback: (approved: boolean) => void;
}) {
  const approved = item.clientApproved;
  return (
    <article
      className={`dark:bg-[#0b0918] border dark:border-[#171132] rounded-lg shadow-soft overflow-hidden grid grid-cols-12 ${
        approved === false ? "opacity-60" : ""
      }`}
    >
      <div className="col-span-12 lg:col-span-9 p-7 relative">
        <div className="grid grid-cols-12 gap-6">
          <div className="-z-1 absolute top-7 right-7 md:static col-span-2">
            <div className="italic text-[64px] leading-none text-[#3D24A0] dark:text-[#96ff7e]/40 select-none">
              {num}
            </div>
          </div>
          <div className="col-span-10 relative z-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${effortChip[item.effortLevel]}`}
              >
                <Zap className="h-3 w-3" />
                {effortLabel[item.effortLevel]}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${riskChip[item.riskLevel]}`}
              >
                <Shield className="h-3 w-3" />
                {riskLabel[item.riskLevel]}
              </span>
              {item.impactCents > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium dark:bg-[#08382a] text-[#29c89b] border border-[#157d60]">
                  <TrendingUp className="h-3 w-3" />
                  {formatBRL(item.impactCents / 100)}
                </span>
              )}
            </div>
            <h3 className="text-[22px] tracking-tight leading-snug mb-2">
              {item.title}
            </h3>
            <p className="text-[13.5px] opacity-60 leading-relaxed">
              {item.description}
            </p>
          </div>
        </div>
      </div>
      <div className="col-span-12 lg:col-span-3 p-6 lg:border-l border-t lg:border-t-0 dark:border-[#2b2b40] bg-gray-200 dark:bg-[#15152f] flex flex-col gap-3">
        <div className="uppercase text-[11px] tracking-widest mb-1 !opacity-30">
          Feedback
        </div>
        <button
          onClick={() => onFeedback(true)}
          className={`flex items-center gap-2 text-[12px] px-2 py-1.5 rounded-md transition-colors ${
            approved === true
              ? "bg-[#29c89b]/20 text-[#29c89b]"
              : "dark:text-[#96ff7e] hover:bg-cream-deep"
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          Aprovar
        </button>
        <button
          onClick={() => onFeedback(false)}
          className={`flex items-center gap-2 text-[12px] px-2 py-1.5 rounded-md transition-colors ${
            approved === false
              ? "bg-[#ff9191]/20 text-[#ff9191]"
              : "dark:text-[#96ff7e] hover:bg-cream-deep"
          }`}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          Rejeitar
        </button>
        {item.doneWhen && (
          <p className="text-[11px] opacity-50 mt-auto leading-relaxed">
            {item.doneWhen}
          </p>
        )}
      </div>
    </article>
  );
}
