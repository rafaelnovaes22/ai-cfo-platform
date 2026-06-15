import {
  ArrowBigDown,
  ArrowBigUp,
  CircleDollarSign,
  Wallet,
} from "lucide-react";
import { formatBRL } from "../data/analytics.ts";
import { categoryLabel } from "../data/categoryLabels.ts";
import { useAnalyses } from "../data/useAnalyses.ts";
import DemoRibbon from "@/components/DemoRibbon.tsx";
import IncomeOutcomeChart from "@/components/IncomeOutcomeChart.tsx";
import { useCashFlow } from "../data/useCashFlow.ts";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type CashFlowItem = {
  amount: number;
  category: string;
};

type MonthKey = "01" | "02" | "03";

type CashFlowMonth = {
  initialBalance: number;
  entries: CashFlowItem[];
  exits: CashFlowItem[];
};

type CashFlowData = Record<MonthKey, CashFlowMonth>;

// "2026-04-01" → "01/04/2026" (sem new Date, evita shift de timezone).
const fmtDateBR = (iso?: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

export const getDateByGranularity = (period: string, granularity: string) => {
  if (granularity === "daily") {
    return new Date(period).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }
  if (granularity === "mothly") {
    const [year, month] = period.split("-");
    return `${month}/${year}`;
  }
  return period;
};

// A janela do caixa é derivada da granularidade + mês selecionado (activeAnalysis):
// diário/semanal → o mês; mensal/trimestral → o ano do mês. Aproveita as 4 visões
// em vez de um período fixo de 12 meses que ignorava o seletor.
function periodForGranularity(
  refMonth: string | undefined,
  granularity: string,
): { startDate: string; endDate: string } {
  const base = refMonth ?? new Date().toISOString().slice(0, 7);
  const [y, m] = base.split("-").map(Number);
  const year = y ?? new Date().getFullYear();
  if (granularity === "daily" || granularity === "weekly") {
    const month = m ?? 1;
    const lastDay = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, "0");
    return { startDate: `${year}-${mm}-01`, endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
  }
  // mensal / trimestral → ano inteiro do mês selecionado
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}

export default function CashFlow() {
  const { activeAnalysis } = useAnalyses();
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState("daily");
  const refMonth = activeAnalysis?.referenceMonth;

  const filters = useMemo(() => {
    const { startDate, endDate } = periodForGranularity(refMonth, granularity);
    return { startDate, endDate, granularity };
  }, [refMonth, granularity]);

  const { cashflow, refresh } = useCashFlow(filters);
  const { summary, chart, table, period } = cashflow;

  useEffect(() => {
    if (!loading) {
      refresh(filters);
    }
  }, [filters, refresh]);

  useEffect(() => {
    if (cashflow) {
      setLoading(false);
    }
  }, [cashflow]);

  const getTableData = (tableData: any) => {
    const entriesTable = tableData.filter((item: any) => item.totalCents >= 0);
    const exitsTable = tableData.filter((item: any) => item.totalCents < 0);
    return { entries: entriesTable, exits: exitsTable };
  };

  const handlePeriodChange = (newGranularity: string) => {
    setGranularity(newGranularity);
  };

  const getColumns = () => {
    // get the biggest array of byPeriod in table to know how many columns we need to render
    const biggestByPeriod = table.reduce(
      (biggest: any, item: any) =>
        item.byPeriod.length > biggest.byPeriod.length ? item : biggest,
      { byPeriod: [] }
    );
    return biggestByPeriod.byPeriod.map((item: any) =>
      getDateByGranularity(item.period, filters.granularity)
    );
  };

  return (
    <div className="space-y-8 relative">
      <header className="animate-fade-up flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="uppercase text-[11px] tracking-widest !opacity-30 mb-3">
            {activeAnalysis ? `${activeAnalysis.name}` : ""}
          </div>
          <h1 className="text-2xl leading-[1.05] tracking-tight ">
            Fluxo de Caixa
          </h1>
        </div>
      </header>
      {!cashflow.requestId ? (
        <div className="animate-fade-up flex flex-col gap-4 items-start py-6 w-full mx-auto rounded-lg text-left opacity-50 text-[14px]">
          Sem lançamentos. Importe dados para começar.
          <Link
            to="/importar"
            className="inline-flex items-center gap-2 mt-4 bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] hover:bg-[#111164]/90"
          >
            Importar dados
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 flex-wrap justify-between w-full">
            <div className="flex items-center gap-4 flex-wrap">
              <Select
                value={filters.granularity}
                onChange={(v) => handlePeriodChange(v)}
                options={[
                  { v: "daily", l: "Diário" },
                  { v: "weekly", l: "Semanal" },
                  { v: "monthly", l: "Mensal" },
                  { v: "quarterly", l: "Trimestral" },
                ]}
              />
              <div>
                {period.startDate} - {period.endDate}
              </div>
            </div>
            {/* <div className="flex items-center gap-4 flex-wrap">
          <Select
            value={""}
            onChange={(v) => ({})}
            options={[
              { v: "", l: "Conta Bancária" },
              { v: "itau", l: "Itaú" },
              { v: "nubank", l: "Nubank" },
              { v: "bradesco", l: "Bradesco" },
              { v: "bb", l: "Banco do Brasil" },
            ]}
          />
          <Select
            value={""}
            onChange={(v) => ({})}
            options={[{ v: "", l: "Categoria" }]}
          />
          <Select
            value={""}
            onChange={(v) => ({})}
            options={[{ v: "", l: "Agrupadores" }]}
          />
          <Select
            value={""}
            onChange={(v) => ({})}
            options={[{ v: "", l: "Fornecedor" }]}
          />
          <Select
            value={""}
            onChange={(v) => ({})}
            options={[{ v: "", l: "Nota Fiscal" }]}
          />
        </div> */}
          </div>
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <DataCard
                icon={CircleDollarSign}
                title={`Saldo inicial${period?.startDate ? ` (${fmtDateBR(period.startDate)})` : ""}`}
                amount={(summary.openingBalanceCents ?? 0) / 100}
              />
              <DataCard
                icon={Wallet}
                title={`Saldo acumulado${period?.endDate ? ` (${fmtDateBR(period.endDate)})` : ""}`}
                amount={(summary.closingBalanceCents ?? 0) / 100}
              />
              <DataCard
                icon={ArrowBigDown}
                title={`Entradas (${summary.creditCount})`}
                amount={summary.totalCreditsCents / 100}
              />
              <DataCard
                icon={ArrowBigUp}
                title={`Saídas (${summary.debitCount})`}
                amount={(summary.totalDebitsCents * -1) / 100}
              />
            </div>
            <div className="col-span-1 border dark:border-[#15152f] rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-4">
              <IncomeOutcomeChart
                data={chart}
                granularity={filters.granularity}
              />
            </div>
          </div>
          <section className="animate-fade-up delay-2 dark:bg-[#0b0918] border dark:border-[#171132] rounded-lg overflow-x-auto">
            {table && (
              <table className="w-full text-[13px]">
                <thead className="bg-gray-200 dark:bg-[#15152f] border-b dark:border-[#171132]">
                  <tr>
                    <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal text-left">
                      Categoria
                    </th>
                    <th className="uppercase text-[11px] bg-gray-300 dark:bg-[#0b0918] tracking-widest !opacity-60 px-5 py-3 font-normal text-right">
                      Total no período
                    </th>
                    {getColumns().map((item, index) => (
                      <th
                        key={index}
                        className="uppercase text-[11px] tracking-widest !opacity-60 px-5 py-3 font-normal text-right"
                      >
                        {item}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-base border-b dark:border-[#171132]/60 last:border-0 hover:bg-[#15152f]/10 dark:bg-[#15152f]/40 transition-colors">
                    <td className="px-5 py-3.5 border-l-2 border-[#29c89b] text-[#29c89b]">
                      Receitas
                    </td>
                  </tr>
                  {getTableData(table).entries.map((item, index) => (
                    <Row
                      key={index}
                      data={item}
                      list="entries"
                      cols={getColumns().length}
                    />
                  ))}
                  <tr className="text-base border-b dark:border-[#171132]/60 last:border-0 hover:bg-[#15152f]/10 dark:bg-[#15152f]/40 transition-colors">
                    <td className="px-5 py-3.5 border-l-2 border-[#ff9191] text-[#ff9191]">
                      Despesas
                    </td>
                  </tr>

                  {getTableData(table).exits.map((item, index) => (
                    <Row
                      key={index}
                      data={item}
                      list="exits"
                      cols={getColumns().length}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function DataCard({
  title,
  amount,
  icon: Icon,
}: {
  title: string;
  amount: number;
  icon: React.ElementType;
}) {
  return (
    <div className="border dark:border-[#15152f] rounded-xl p-6 flex flex-col md:flex-row md:items-center gap-4">
      <Icon
        className={`h-10 w-10 ${
          amount >= 0 ? "text-[#29c89b]" : "text-[#ff9191]"
        }`}
        strokeWidth={1}
      />
      <div className="flex flex-col-reverse md:flex-col gap-1">
        <div className="text-sm font-semibold">{title}</div>
        <div
          className={`font-semibold text-lg ${
            amount >= 0 ? "text-[#29c89b]" : "text-[#ff9191]"
          }`}
        >
          {formatBRL(amount)}
        </div>
      </div>
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
      className="font-semibold bg-gray-100 dark:bg-[#0b0918] border dark:border-[#171132] rounded-md px-3 py-2 text-[12.5px]  focus:outline-none focus:border-white/60"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}

function Row({
  data,
  list,
  cols,
}: {
  data: any;
  list: "entries" | "exits";
  cols: number;
}) {
  const emptyByPeriod = Array.from({ length: cols }, () => ({
    amountCents: 0,
  }));
  const byPeriod = [...data.byPeriod, ...emptyByPeriod].slice(0, cols);
  return (
    <tr className="group text-base border-b dark:border-[#171132]/60 last:border-0 dark:bg-[#15152f]/40 transition-colors">
      <td
        className={`px-5 py-3.5 pl-12 border-l-2 group-hover:bg-[#15152f]/10 ${
          list === "entries" ? "border-[#29c89b]" : "border-[#ff9191]"
        }`}
      >
        {" "}
        {categoryLabel(data.category)}
      </td>
      <td
        className={`px-5 py-3.5 font-semibold bg-gray-100 dark:bg-[#0b0918] group-hover:bg-[#15152f]/5 text-right ${data.totalCents < 0 ? "text-[#ff9191]" : "text-[#29c89b]"}`}
      >
        {formatBRL(data.totalCents / 100)}
      </td>
      {byPeriod.map((p, index) => (
        <td
          key={index}
          className={`px-5 py-3.5 text-right whitespace-nowrap group-hover:bg-[#15152f]/10 ${p.amountCents < 0 ? "text-[#ff9191]" : "text-[#29c89b]"}`}
        >
          {p.amountCents === 0 ? "-" : formatBRL(p.amountCents / 100)}
        </td>
      ))}
    </tr>
  );
}
