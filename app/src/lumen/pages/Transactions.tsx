import { useMemo, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { formatBRL } from "../data/categories.ts";
import {
  useTransactions,
  BACKEND_CATEGORIES,
  type ReviewStatus,
  type Source,
} from "../data/useTransactions.ts";
import { useAnalyses } from "../data/useAnalyses.ts";
import { toast } from "@/components/ui/sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

const LOW_CONFIDENCE_THRESHOLD = 70;

export default function Transactions() {
  const { transactions, loading, correct, classifying } = useTransactions();
  const { activeAnalysis } = useAnalyses();
  const pendingCount = useMemo(
    () => transactions.filter((t) => t.pending).length,
    [transactions]
  );
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.category))),
    [transactions]
  );

  const filtered = transactions.filter((t) => {
    if (q && !t.description.toLowerCase().includes(q.toLowerCase()))
      return false;
    if (type === "in" && t.type !== "income") return false;
    if (type === "out" && t.type !== "expense") return false;
    if (category !== "all" && t.category !== category) return false;
    return true;
  });

  const totals = filtered.reduce(
    (acc, t) => {
      if (t.type === "income") acc.in += Number(t.amount);
      else acc.out += Number(t.amount);
      return acc;
    },
    { in: 0, out: 0 }
  );
  const balance = totals.in - totals.out;

  const reset = () => {
    setQ("");
    setType("all");
    setCategory("all");
  };

  const handleCorrect = async (
    entryId: string,
    newCategory: string,
    source?: Source
  ) => {
    try {
      await correct(entryId, newCategory, source);
      toast.success("Categoria atualizada.");
    } catch {
      toast.error("Erro ao corrigir categoria.");
    }
  };

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y.slice(2)}`;
  };

  const handleLowConfidence = (confidence: number, status: ReviewStatus) => {
    const pct = confidence !== null ? Math.round(confidence * 100) : null;
    return (
      status === "needs_review" &&
      pct !== null &&
      pct < LOW_CONFIDENCE_THRESHOLD
    );
  };

  return (
    <div className="space-y-8">
      <header className="animate-fade-up flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="uppercase text-[11px] tracking-widest !opacity-30 mb-3">
            Lançamentos{activeAnalysis ? ` · ${activeAnalysis.name}` : ""}
          </div>
          <h1 className="text-2xl leading-[1.05] tracking-tight">
            Movimentações
          </h1>
          <p className="opacity-60 mt-2 text-[14px]">
            {loading
              ? "Carregando…"
              : `${transactions.length} ${transactions.length === 1 ? "registro" : "registros"} no total.`}
          </p>
          {classifying && !loading && (
            <p className="mt-2 inline-flex items-center gap-2 text-[12.5px] text-amber-400/90">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {pendingCount > 0
                ? `Classificando ${pendingCount} ${pendingCount === 1 ? "lançamento" : "lançamentos"}. A lista atualiza sozinha.`
                : "Finalizando a análise. Você já pode revisar as categorias."}
            </p>
          )}
        </div>
      </header>

      <div className="animate-fade-up delay-1 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar descrição..."
            className="w-full dark:bg-[#0b0918] border dark:border-[#171132] rounded-md pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:border-white/60"
          />
        </div>
        <Select
          value={type}
          onChange={setType}
          options={[
            { v: "all", l: "Todos os tipos" },
            { v: "in", l: "Receitas" },
            { v: "out", l: "Despesas" },
          ]}
        />
        <Select
          value={category}
          onChange={setCategory}
          options={[
            { v: "all", l: "Todas as categorias" },
            ...categories.map((c) => ({ v: c, l: c })),
          ]}
        />
        <button
          onClick={reset}
          className="flex items-center gap-1 px-3 py-2 text-[12.5px] opacity-60 hover:"
        >
          <X className="h-3 w-3" /> Limpar
        </button>
      </div>

      <section className="animate-fade-up delay-3 grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="Total de receitas"
          value={totals.in}
          tone="positive"
        />
        <SummaryCard
          label="Total de despesas"
          value={totals.out}
          tone="negative"
        />
        <SummaryCard label="Saldo do período" value={balance} tone="neutral" />
      </section>

      <section className="animate-fade-up delay-2 dark:bg-[#0b0918] border dark:border-[#171132] rounded-lg overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-200 dark:bg-[#15152f] border-b dark:border-[#171132]">
            <tr className="text-left">
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[110px]">
                Data
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal">
                Descrição
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[110px] text-right">
                Status
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[220px]">
                Categoria
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[140px] text-right">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className={`border-b dark:border-[#171132]/60 last:border-0 hover:bg-[#15152f]/10 transition-colors ${
                  t.reviewStatus === "needs_review"
                    ? "dark:bg-amber-950/20"
                    : "dark:bg-[#15152f]/40"
                }`}
              >
                <td className="px-5 py-3.5 text-[12px] opacity-60">
                  {formatDate(t.date)}
                </td>
                <td className="px-5 py-3.5">{t.description}</td>
                <td className="px-5 py-3.5 text-right">
                  <StatusBadge
                    status={t.reviewStatus}
                    confidence={t.confidence}
                    classifying={t.pending && classifying}
                  />
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <select
                      value={t.rawCategory}
                      onChange={(e) => handleCorrect(t.id, e.target.value)}
                      className="dark:bg-[#15152f] border dark:border-[#171132] rounded px-2 py-1 text-[11.5px] w-full focus:outline-none focus:border-[#96ff7e]"
                    >
                      {BACKEND_CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {handleLowConfidence(t.confidence, t.reviewStatus) && (
                      <ConfidenceCheckmark
                        confidence={t.confidence}
                        category={t.rawCategory}
                        onClick={(value: string, source?: Source) =>
                          handleCorrect(t.id, value, source)
                        }
                      />
                    )}
                  </div>
                </td>
                <td
                  className={`px-5 py-3.5 font-semibold text-[13px] text-right ${
                    t.type === "income" ? "text-[#29c89b]" : "text-[#ff9191]"
                  }`}
                >
                  {t.type === "income" ? "+" : "−"}
                  {formatBRL(Number(t.amount))}
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center opacity-60 text-[13px]"
                >
                  {transactions.length === 0
                    ? "Sem lançamentos. Importe dados para começar."
                    : "Nenhum lançamento com esses filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="dark:bg-[#0b0918] border dark:border-[#171132] rounded-md px-3 py-2 text-[12.5px] focus:outline-none focus:border-white/60"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
}) {
  const colors = {
    positive: "text-[#29c89b]",
    negative: "text-[#ff9191]",
    neutral: "",
  }[tone];
  return (
    <div className="dark:bg-[#0b0918] border dark:border-[#171132] rounded-lg p-5">
      <div className="uppercase text-[11px] tracking-widest !opacity-30 mb-3">
        {label}
      </div>
      <div
        className={`text-[28px] leading-none tracking-tight tabular ${colors}`}
      >
        {formatBRL(value)}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  confidence,
  classifying = false,
}: {
  status: ReviewStatus;
  confidence: number | null;
  classifying?: boolean;
}) {
  // Categoria ainda não devolvida — pipeline em andamento.
  if (classifying) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/30 animate-pulse">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Classificando…
      </span>
    );
  }
  if (status === "corrected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
        Corrigido
      </span>
    );
  }
  // O percentual de confiança ajuda o usuário a achar o que conferir: baixa
  // confiança (<70%) ou item marcado para revisão vira "Revisar · X%" em amber,
  // chamando atenção pros lançamentos que o sistema não classificou com segurança
  // (ex.: "Pagamento" genérico). Confiança alta fica discreta, só o percentual.
  const pct = confidence !== null ? Math.round(confidence * 100) : null;
  const low =
    status === "needs_review" ||
    (pct !== null && pct < LOW_CONFIDENCE_THRESHOLD);
  if (low) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 whitespace-nowrap">
            Revisar{pct !== null ? ` · ${pct}%` : ""}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          Selecione a categoria que mais representa esta transação
        </TooltipContent>
      </Tooltip>
    );
  }
  if (pct !== null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        {pct}%
      </span>
    );
  }
  return null;
}

function ConfidenceCheckmark({
  confidence,
  onClick,
  category,
}: {
  confidence: number | null;
  onClick: (v: string | null, s?: Source) => void;
  category: string;
}) {
  if (confidence === null) {
    return null;
  }
  return (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger>
          <button
            className="border border-[#ff9191] text-[#ff9191] rounded-l p-1 mr-[-1px]"
            onClick={() => onClick("nao_classificado", "needs_review")}
          >
            <X className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          Rejeitar sugestão
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger>
          <button
            className="border border-[#29c89b] text-[#29c89b] rounded-r p-1"
            onClick={() => onClick(category)}
          >
            <Check className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          Aceitar sugestão
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
