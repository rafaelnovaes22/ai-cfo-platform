import { useMemo, useState } from "react";
import { Search, X, Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { formatBRL } from "../data/categories.ts";
import { useTransactions, type Transaction } from "../data/useTransactions.ts";
import { TransactionModal } from "../components/TransactionModal.tsx";
import { AnalysisPicker } from "../components/AnalysisPicker.tsx";
import { useAnalyses } from "../data/useAnalyses.ts";
import { toast } from "@/components/ui/sonner";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  spreadsheet: "Planilha",
  pdf: "PDF",
  pasted: "Colado",
  ai: "IA",
};

export default function Transactions() {
  const { transactions, loading, create, update, remove } = useTransactions();
  const { activeAnalysis } = useAnalyses();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | undefined>();

  const accounts = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.account))),
    [transactions]
  );
  const categories = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.category))),
    [transactions]
  );

  const filtered = transactions.filter((t) => {
    if (q && !t.description.toLowerCase().includes(q.toLowerCase()))
      return false;
    if (type === "in" && t.type !== "income") return false;
    if (type === "out" && t.type !== "expense") return false;
    if (account !== "all" && t.account !== account) return false;
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
    setAccount("all");
    setCategory("all");
  };

  const handleDelete = async (t: Transaction) => {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    try {
      await remove(t.id);
      toast.success("Lançamento excluído.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
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
          <h1 className="text-2xl leading-[1.05] tracking-tight ">
            Movimentações
          </h1>
          <p className="opacity-60 mt-2 text-[14px]">
            {loading
              ? "Carregando…"
              : `${transactions.length} ${
                  transactions.length === 1 ? "registro" : "registros"
                } no total.`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AnalysisPicker />
          <button
            onClick={() => {
              setEditing(undefined);
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 h-9 rounded-md bg-[#15152f] text-cream text-[13px] font-medium hover:bg-[#111164]/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo lançamento
          </button>
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
          value={account}
          onChange={setAccount}
          options={[
            { v: "all", l: "Todas as contas" },
            ...accounts.map((a) => ({ v: a, l: a })),
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
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[180px]">
                Categoria
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[140px]">
                Conta
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[140px] text-right">
                Valor
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal w-[100px]">
                Origem
              </th>
              <th className="w-[80px]"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr
                key={t.id}
                className="border-b dark:border-[#171132]/60 last:border-0 hover:bg-[#15152f]/10 dark:bg-[#15152f]/40 transition-colors"
              >
                <td className="px-5 py-3.5  text-[12px] opacity-60">
                  {formatDate(t.date)}
                </td>
                <td className="px-5 py-3.5 ">{t.description}</td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex px-2 py-0.5 rounded-full dark:bg-[#15152f] opacity-60 text-[11px] border border-[#171132]">
                    {t.category}
                  </span>
                </td>
                <td className="px-5 py-3.5  text-[12px] opacity-60">
                  {t.account}
                </td>
                <td
                  className={`px-5 py-3.5 font-semibold text-[13px] text-right ${
                    t.type === "income" ? "text-[#29c89b]" : "text-[#ff9191]"
                  }`}
                >
                  {t.type === "income" ? "+" : "−"}
                  {formatBRL(Number(t.amount))}
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1 text-[11px] opacity-60">
                    {t.source === "ai" && <Sparkles className="h-3 w-3" />}
                    {SOURCE_LABEL[t.source] ?? t.source}
                  </span>
                </td>
                <td className="px-3">
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => {
                        setEditing(t);
                        setModalOpen(true);
                      }}
                      className="p-1.5 rounded hover:bg-[#15152f] opacity-60 hover:"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(t)}
                      className="p-1.5 rounded hover:bg-[#15152f] opacity-60 hover:text-[#ff9191]"
                      title="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center opacity-60 text-[13px]"
                >
                  {transactions.length === 0
                    ? "Você ainda não tem lançamentos. Crie o primeiro ou importe seus dados."
                    : "Nenhum lançamento encontrado com esses filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (tx) => {
          if (editing) await update(editing.id, tx);
          else await create(tx);
        }}
        initial={editing}
      />
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
      className="dark:bg-[#0b0918] border dark:border-[#171132] rounded-md px-3 py-2 text-[12.5px]  focus:outline-none focus:border-white/60"
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
        className={` text-[28px] leading-none tracking-tight tabular ${colors}`}
      >
        {formatBRL(value)}
      </div>
    </div>
  );
}
