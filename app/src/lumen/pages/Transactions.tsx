import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { formatBRL } from "../data/categories.ts";
import {
  useTransactions,
  BACKEND_CATEGORIES,
  type ReviewStatus,
} from "../data/useTransactions.ts";
import { useAnalyses } from "../data/useAnalyses.ts";
import { toast } from "@/components/ui/sonner";

export default function Transactions() {
  const { transactions, loading, correct } = useTransactions();
  const { activeAnalysis } = useAnalyses();
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

  const handleCorrect = async (entryId: string, newCategory: string) => {
    try {
      await correct(entryId, newCategory);
      toast.success("Categoria atualizada.");
    } catch {
      toast.error("Erro ao corrigir categoria.");
    }
  };

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y.slice(2)}`;
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
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[220px]">
                Categoria
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[140px] text-right">
                Valor
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[110px] text-right">
                Status
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
                <td className="px-5 py-3.5">
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
                </td>
                <td
                  className={`px-5 py-3.5 font-semibold text-[13px] text-right ${
                    t.type === "income" ? "text-[#29c89b]" : "text-[#ff9191]"
                  }`}
                >
                  {t.type === "income" ? "+" : "−"}
                  {formatBRL(Number(t.amount))}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <StatusBadge
                    status={t.reviewStatus}
                    confidence={t.confidence}
                  />
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
}: {
  status: ReviewStatus;
  confidence: number | null;
}) {
  if (status === "needs_review") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
        Revisar
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
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      IA {confidence !== null ? `${(confidence * 100).toFixed(0)}%` : ""}
    </span>
  );
}
