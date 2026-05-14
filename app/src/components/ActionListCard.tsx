import { AnalysisPicker } from "@/lumen/components/AnalysisPicker";
import { useActionItems, type ActionItem } from "@/lumen/data/useActionItems";
import {
  ArrowRight,
  CheckCheck,
  Inbox,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

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
const priorityLabel: Record<string, string> = {
  high: "Alta prioridade",
  medium: "Média prioridade",
  low: "Baixa prioridade",
};
const priorityChip: Record<string, string> = {
  high: "dark:bg-[#441616] text-[#ff9191] border border-[#a64c4c]",
  medium:
    "dark:bg-[#493210] text-[#d19130] dark:text-[#ffc66e] border border-[#9c7335]",
  low: "dark:bg-[#08382a] text-[#29c89b] border border-[#157d60]",
};

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
      className={`flex items-center gap-1 text-[12px] dark:text-[#96ff7e] px-2 py-1.5 rounded-md transition-colors ${
        active
          ? "bg-[#3D24A0] dark:bg-[#96ff7e] !text-white dark:!text-[#09080f]"
          : "hover:text-white hover:dark:text-[#09080f] hover:bg-[#3D24A0] hover:dark:bg-[#96ff7e]"
      }`}
      title={label}
    >
      {icon}
    </button>
  );
}

function ActionCard({
  item,
  onStatus,
  onRemove,
}: {
  num: number;
  actionsLength: number;
  item: ActionItem;
  onStatus: (s: "pending" | "in_progress" | "done") => void;
  onRemove: () => void;
}) {
  const done = item.status === "done";
  return (
    <article
      className={`border-[#3D24A0]/5 dark:border-[#96ff7e]/5 grid grid-cols-12 hover:bg-[#15152f]/10 dark:bg-[#15152f]/40 -mx-6 md:mx-0 px-4 pt-3 pb-1 border-b-2 ${
        done ? "opacity-60" : ""
      }`}
    >
      <div className="col-span-12 px-2">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12">
            <h3
              className={`text-md tracking-tight leading-snug mb-2 ${
                done ? "line-through" : ""
              }`}
              title={cleanDescription(item.description)}
            >
              {item.title}
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium ${
                  priorityChip[item.priority]
                }`}
              >
                {priorityLabel[item.priority]}
              </span>
              {item.ai_generated && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-medium dark:bg-[#2d0b30] text-[#b752cd] border border-[#763086]">
                  <Sparkles className="h-3 w-3" />{" "}
                  <span className="hidden md:inline">Gerado por</span> IA
                </span>
              )}
              <div className="h-8 ml-auto flex gap-1">
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
                <StatusBtn
                  active={false}
                  onClick={onRemove}
                  icon={<X className="h-3.5 w-3.5" />}
                  label="Remover ação"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ActionListCard({
  handleGenerate,
  generating,
  transactions,
}) {
  const { items, loading, updateStatus, remove, refresh } = useActionItems();

  const [horizon, setHorizon] = useState<Horizon>("short");
  const grouped = useMemo(() => {
    const map: Record<Horizon, ActionItem[]> = { short: [], mid: [], long: [] };
    items.forEach((i) => map[horizonOf(i)].push(i));
    return map;
  }, [items]);

  const actions = grouped[horizon];

  if (!loading && items.length === 0) {
    return (
      <div className="space-y-10">
        <div className="font-semibold mb-8">Plano de Ação</div>
        <section className="dark:bg-[#0b0918] border dark:border-[#171532] rounded-lg p-12 text-center">
          <Inbox
            className="h-10 w-10 mx-auto dark:text-[#96ff7e] mb-4"
            strokeWidth={1.4}
          />
          <h2 className=" text-[26px] tracking-tight mb-2">
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
    <article className="relative h-full grid grid-cols-12 pb-12">
      <div className="col-span-12">
        <div className="font-semibold mb-8">Plano de Ação</div>
        <div className="flex -mx-6 md:mx-0 w-[calc(100%+48px)] md:w-full border-b dark:border-[#15152f]">
          {horizons.map((h) => {
            const active = horizon === h.id;
            const count = grouped[h.id].length;
            return (
              <button
                key={h.id}
                onClick={() => setHorizon(h.id)}
                className={`flex flex-col md:flex-row items-baseline px-2 md:px-4 pb-2 -mb-px border-b-2 dark:border-[#15152f] transition-colors ${
                  active
                    ? "border-[#3D24A0] dark:!border-[#96ff7e] "
                    : " hover:"
                }`}
              >
                <span className="text-sm md:text-base leading-[1.2] md:-mb-1">
                  {h.label}{" "}
                  {count > 0 && (
                    <span className="text-[10.5px] ">({count})</span>
                  )}
                </span>
                <span className="hidden md:flextext-[11.5px] opacity-30 ">
                  {h.sub}
                </span>
              </button>
            );
          })}
        </div>

        {actions.length === 0 ? (
          <p className="text-[13px]  italic">
            Nenhuma ação neste horizonte. Gere um novo plano para atualizar.
          </p>
        ) : (
          <section className="flex flex-col">
            {actions.map((a, i) => (
              <ActionCard
                key={a.id}
                num={i}
                item={a}
                actionsLength={actions.length}
                onStatus={(s) => updateStatus(a.id, s)}
                onRemove={() => remove(a.id)}
              />
            ))}
          </section>
        )}
      </div>
      <div className="absolute bottom-0 left-0 col-span-12 w-full flex flex-wrap gap-3 mt-4">
        <Link
          to="/plano"
          className="group inline-flex items-center gap-2 text-lg transition-colors"
        >
          Ver Plano de Ação completo
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </article>
  );
}
