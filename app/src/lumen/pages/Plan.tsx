import { useMemo, useState } from "react";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  Circle,
  CircleDot,
  Trash2,
  Inbox,
  Pause,
  Play,
  CheckCheck,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActionItems, type ActionItem } from "../data/useActionItems";
import { useTransactions } from "../data/useTransactions";
import { useAnalyses } from "../data/useAnalyses.ts";
import { AnalysisPicker } from "../components/AnalysisPicker.tsx";
import { toast } from "sonner";

type Horizon = "short" | "mid" | "long";

const horizons: {
  id: Horizon;
  num: string;
  label: string;
  sub: string;
  tag: string;
}[] = [
  {
    id: "short",
    num: "01",
    label: "Curto prazo",
    sub: "Até 3 meses",
    tag: "[Curto prazo]",
  },
  {
    id: "mid",
    num: "02",
    label: "Médio prazo",
    sub: "3 a 12 meses",
    tag: "[Médio prazo]",
  },
  {
    id: "long",
    num: "03",
    label: "Longo prazo",
    sub: "Acima de 1 ano",
    tag: "[Longo prazo]",
  },
];

function horizonOf(item: ActionItem): Horizon {
  const desc = item.description ?? "";
  if (desc.startsWith("[Curto prazo]")) return "short";
  if (desc.startsWith("[Médio prazo]")) return "mid";
  if (desc.startsWith("[Longo prazo]")) return "long";
  // fallback by position
  if (item.position >= 200) return "long";
  if (item.position >= 100) return "mid";
  return "short";
}

function cleanDescription(desc: string | null): string {
  if (!desc) return "";
  return desc.replace(/^\[(Curto|Médio|Longo) prazo\]\s*/, "");
}

const priorityChip: Record<string, string> = {
  high: "dark:bg-[#441616] text-[#ff9191] border border-[#a64c4c]",
  medium:
    "dark:bg-[#493210] text-[#d19130] dark:text-[#ffc66e] border border-[#9c7335]",
  low: "dark:bg-[#08382a] text-[#29c89b] border border-[#157d60]",
};
const priorityLabel: Record<string, string> = {
  high: "Alta prioridade",
  medium: "Média prioridade",
  low: "Baixa prioridade",
};

export default function Plan() {
  const { items, loading, updateStatus, remove, refresh } = useActionItems();
  const { transactions } = useTransactions();
  const { activeId, activeAnalysis } = useAnalyses();
  const [horizon, setHorizon] = useState<Horizon>("short");
  const [generating, setGenerating] = useState(false);

  const grouped = useMemo(() => {
    const map: Record<Horizon, ActionItem[]> = { short: [], mid: [], long: [] };
    items.forEach((i) => map[horizonOf(i)].push(i));
    return map;
  }, [items]);

  const actions = grouped[horizon];

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

  if (!loading && items.length === 0) {
    return (
      <div className="space-y-10">
        <header className="animate-fade-up">
          <div className="uppercase text-[11px] tracking-widest !opacity-30 mb-3">
            Plano de ação{activeAnalysis ? ` · ${activeAnalysis.name}` : ""}
          </div>
          <h1 className=" text-3xl leading-[1.05] tracking-tight ">
            Próximos passos para a sua empresa
          </h1>
          <div className="mt-4">
            <AnalysisPicker />
          </div>
        </header>
        <section className="dark:bg-[#15152f] border dark:border-[#15152f]/50 rounded-lg p-12 text-center">
          <Inbox
            className="h-10 w-10 mx-auto dark:text-[#96ff7e] mb-4"
            strokeWidth={1.4}
          />
          <h2 className=" text-[26px] tracking-tight  mb-2">
            {transactions.length === 0
              ? "Sem dados ainda"
              : "Gere seu primeiro plano"}
          </h2>
          <p className="text-[14px] dark:text-[#96ff7e] max-w-md mx-auto mb-6">
            {transactions.length === 0
              ? "O plano é construído a partir dos seus lançamentos. Importe ou cadastre transações primeiro."
              : "A IA analisa seus lançamentos e propõe ações práticas para curto, médio e longo prazo."}
          </p>
          {transactions.length === 0 ? (
            <Link
              to="/importar"
              className="inline-flex items-center gap-2 bg-[#111164] text-cream px-5 py-3 rounded-md text-[13.5px] hover:bg-[#111164]/90"
            >
              Importar dados
            </Link>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-[#111164] text-cream px-5 py-3 rounded-md text-[13.5px] hover:bg-[#111164]/90 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Gerando…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Gerar plano com IA
                </>
              )}
            </button>
          )}
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
          <h1 className=" text-2xl leading-[1.05] tracking-tight ">
            Próximos passos para a sua empresa
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AnalysisPicker />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 border dark:border-[#96ff7e]  px-4 py-2.5 rounded-md text-[13px] hover:bg-[#111164] hover:text-cream transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> Regenerar com IA
              </>
            )}
          </button>
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
                  ? "border-[#3D24A0] dark:border-[#96ff7e] "
                  : "border-transparent opacity-50 hover:"
              }`}
            >
              <span className=" md:text-[18px]">
                {h.label}{" "}
                {count > 0 && <span className=" text-[10.5px]">({count})</span>}
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
          Nenhuma ação neste horizonte. Gere um novo plano para atualizar.
        </p>
      ) : (
        <section className="space-y-4">
          {actions.map((a, i) => (
            <ActionCard
              key={a.id}
              num={String(i + 1).padStart(2, "0")}
              item={a}
              onStatus={(s) => updateStatus(a.id, s)}
              onRemove={() => remove(a.id)}
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
  onStatus,
  onRemove,
}: {
  num: string;
  item: ActionItem;
  onStatus: (s: "pending" | "in_progress" | "done") => void;
  onRemove: () => void;
}) {
  const done = item.status === "done";
  return (
    <article
      className={`dark:bg-[#0b0918] border dark:border-[#171132] rounded-lg shadow-soft overflow-hidden grid grid-cols-12 ${
        done ? "opacity-60" : ""
      }`}
    >
      <div className="col-span-12 lg:col-span-9 p-7  relative">
        <div className="grid grid-cols-12 gap-6">
          <div className="-z-1 absolute top-7 right-7 md:static col-span-2">
            <div className="italic text-[64px] leading-none text-[#3D24A0] dark:text-[#96ff7e]/40 select-none">
              {num}
            </div>
          </div>
          <div className="col-span-10 relative z-1">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                  priorityChip[item.priority]
                }`}
              >
                {priorityLabel[item.priority]}
              </span>
              {item.ai_generated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium dark:bg-[#2d0b30] text-[#b752cd] border border-[#763086]">
                  <Sparkles className="h-3 w-3" /> Gerado por IA
                </span>
              )}
            </div>
            <h3
              className={` text-[22px] tracking-tight  leading-snug mb-2 ${
                done ? "line-through" : ""
              }`}
            >
              {item.title}
            </h3>
            <p className="text-[13.5px] opacity-60 leading-relaxed">
              {cleanDescription(item.description)}
            </p>
          </div>
        </div>
      </div>
      <div className="col-span-12 lg:col-span-3 p-6 lg:border-l border-t lg:border-t-0 dark:border-[#2b2b40] bg-gray-200 dark:bg-[#15152f] flex flex-col gap-2">
        <div className="uppercase text-[11px] tracking-widest mb-1 !opacity-30">
          Status
        </div>
        <StatusBtn
          active={item.status === "pending"}
          onClick={() => onStatus("pending")}
          icon={<Pause className="h-3.5 w-3.5" />}
          label="Pendente"
        />
        <StatusBtn
          active={item.status === "in_progress"}
          onClick={() => onStatus("in_progress")}
          icon={<Play className="h-3.5 w-3.5" />}
          label="Em andamento"
        />
        <StatusBtn
          active={item.status === "done"}
          onClick={() => onStatus("done")}
          icon={<CheckCheck className="h-3.5 w-3.5" />}
          label="Concluída"
        />
        <button
          onClick={onRemove}
          className="mt-2 inline-flex items-center gap-1.5 pl-2 text-[11.5px] dark:text-[#96ff7e] hover:text-negative"
        >
          <X className="h-3.5 w-3.5" /> Remover
        </button>
      </div>
    </article>
  );
}

function StatusBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 text-[12px] px-2 py-1.5 rounded-md transition-colors ${
        active
          ? "bg-gray-300 dark:bg-[#0b0918] dark:text-cream"
          : "dark:text-[#96ff7e] hover:bg-cream-deep"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
