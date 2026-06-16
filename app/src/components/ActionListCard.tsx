import { useActionItems, type ActionItem } from "@/lumen/data/useActionItems";
import { useAnalyses } from "@/lumen/data/useAnalyses";
import {
  ArrowRight,
  Inbox,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ProcessingContent } from "./ProcessingOverlay";

type Horizon = "short" | "medium" | "long";

const horizons: { id: Horizon; label: string; sub: string }[] = [
  { id: "short", label: "Curto prazo", sub: "Até 3 meses" },
  { id: "medium", label: "Médio prazo", sub: "3 a 12 meses" },
  { id: "long", label: "Longo prazo", sub: "Acima de 1 ano" },
];

const effort = {
  low: {
    label: "Baixo",
    color:
      "dark:bg-[#08382a] text-[#08382a] dark:text-[#29c89b] border border-[#157d60]",
  },
  medium: {
    label: "Médio",
    color:
      "dark:bg-[#493210] text-[#493210] dark:text-[#ffc66e] border border-[#9c7335]",
  },
  high: {
    label: "Alto",
    color:
      "dark:bg-[#441616] text-[#441616] dark:text-[#ff9191] border border-[#a64c4c]",
  },
};

function ActionCard({
  item,
  onFeedback,
}: {
  item: ActionItem;
  onFeedback: (approved: boolean) => void;
}) {
  const approved = item.clientApproved;
  return (
    <article
      className={`border-b-2 dark:border-[#96ff7e]/5 -mx-6 md:mx-0 px-4 pt-3 pb-1 ${approved === false ? "opacity-60" : ""}`}
    >
      <h3 className="text-md tracking-tight leading-snug mb-2">{item.title}</h3>
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-[10px] opacity-50 capitalize ${effort[item.effortLevel].color} px-2 py-0.5 rounded-full`}
        >
          {effort[item.effortLevel].label || ""} esforço
        </span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => onFeedback(true)}
            title="Aprovar"
            className={`p-1.5 rounded-md transition-colors ${approved === true ? "text-[#29c89b]" : "opacity-40 hover:opacity-80"}`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onFeedback(false)}
            title="Rejeitar"
            className={`p-1.5 rounded-md transition-colors ${approved === false ? "text-[#ff9191]" : "opacity-40 hover:opacity-80"}`}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

export default function ActionListCard({ current, transactions }) {
  const { items, loading, error, status, retry, feedback } = useActionItems();
  const { uiState: globalUiState } = useAnalyses();
  const [horizon, setHorizon] = useState<Horizon>("short");

  // Derive local state from action-plan status
  const uiState =
    status === "failed"
      ? "FAILED"
      : status &&
          ["ready", "completed", "approved", "delivered"].includes(status)
        ? "READY"
        : globalUiState;

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

  if (current && items.length === 0) {
    if (uiState === "FAILED" || error) {
      return (
        <div className="space-y-6">
          <div className="font-semibold mb-4">Plano de Ação</div>
          <div className="text-center py-8">
            <div className="h-10 w-10 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="h-5 w-5" />
            </div>
            <p className="text-[13px] dark:text-[#96ff7e] mb-4">
              Por algum motivo não foi possível gerar o plano de ação. Tente
              novamente.
            </p>
            <button
              onClick={async () => {
                try {
                  await retry();
                  toast.success("Reiniciando geração do plano...");
                } catch (e) {
                  toast.error("Não foi possível reiniciar a análise.");
                }
              }}
              className="bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] flex items-center gap-2 mx-auto hover:bg-[#111164]/90 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    if (uiState === "READY" && !loading) {
      return (
        <div className="space-y-6">
          <div className="font-semibold mb-4">Plano de Ação</div>
          <div className="text-center py-8">
            <Inbox
              className="h-8 w-8 mx-auto dark:text-[#96ff7e] mb-3"
              strokeWidth={1.4}
            />
            <p className="text-[13px] dark:text-[#96ff7e] mb-4">
              Não encontramos dados suficientes para gerar recomendações
              precisas.
            </p>
            <Link
              to="/importar"
              className="inline-flex items-center gap-2 bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] hover:bg-[#111164]/90"
            >
              Importar mais dados
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="font-semibold mb-4">Plano de Ação</div>
        <div className="py-12">
          <ProcessingContent title="Gerando plano de ação" showDots={false} />
        </div>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="font-semibold mb-4">Plano de Ação</div>
        <div className="text-center py-8">
          <Inbox
            className="h-8 w-8 mx-auto dark:text-[#96ff7e] mb-3"
            strokeWidth={1.4}
          />
          <p className="text-[13px] dark:text-[#96ff7e]">
            {(transactions?.length ?? 0) === 0
              ? "Importe dados para gerar o plano."
              : "O plano é gerado automaticamente após importar dados."}
          </p>
          <Link
            to="/importar"
            className="inline-flex items-center gap-2 mt-4 bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] hover:bg-[#111164]/90"
          >
            Importar dados
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="relative h-full flex flex-col pb-12">
      <div className="font-semibold mb-4">Plano de Ação</div>
      <div className="flex -mx-6 md:mx-0 w-[calc(100%+48px)] md:w-full border-b dark:border-[#15152f]">
        {horizons.map((h) => {
          const active = horizon === h.id;
          const count = grouped[h.id].length;
          return (
            <button
              key={h.id}
              onClick={() => setHorizon(h.id)}
              className={`flex flex-col md:flex-row items-baseline px-2 md:px-4 pb-2 -mb-px border-b-2 transition-colors ${
                active ? "border-[#3D24A0] dark:!border-[#96ff7e]" : "hover:"
              }`}
            >
              <span className="text-sm leading-[1.2]">
                {h.label}{" "}
                {count > 0 && <span className="text-[10.5px]">({count})</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto">
        {actions.length === 0 ? (
          <p className="text-[13px] italic mt-4">
            Nenhuma ação neste horizonte.
          </p>
        ) : (
          actions.map((a) => (
            <ActionCard
              key={a.id}
              item={a}
              onFeedback={async (approved) => {
                try {
                  await feedback(a.id, approved);
                } catch {
                  toast.error("Erro ao registrar feedback.");
                }
              }}
            />
          ))
        )}
      </div>
      <div className="absolute bottom-0 left-0 w-full flex flex-wrap gap-3 mt-4">
        <Link
          to="/plano"
          className="group inline-flex items-center gap-2 text-lg transition-colors"
        >
          Ver Plano completo
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </article>
  );
}
