import {
  ArrowBigDown,
  ArrowBigUp,
  CircleDollarSign,
  Wallet,
} from "lucide-react";
import { formatBRL } from "../data/analytics.ts";
import { useAnalyses } from "../data/useAnalyses.ts";
import DemoRibbon from "@/components/DemoRibbon.tsx";

const data = {
  "01": {
    initialBalance: 10000,
    entries: [
      { amount: 5000, category: "Outras receitas" },
      { amount: 2000, category: "Vendas" },
      { amount: 3000, category: "Estoque" },
    ],
    exits: [
      { amount: 1500, category: "Administração" },
      { amount: 800, category: "Diversas" },
      { amount: 1200, category: "Energia" },
      { amount: 2500, category: "Financiamento" },
      { amount: 1800, category: "Logística" },
      { amount: 2200, category: "Marketing" },
      { amount: 4000, category: "Pessoal" },
      { amount: 900, category: "Provisões" },
      { amount: 1600, category: "Serviços" },
      { amount: 1300, category: "Tecnologia" },
    ],
  },
  "02": {
    initialBalance: 12000,
    entries: [
      { amount: 6000, category: "Outras receitas" },
      { amount: 2500, category: "Vendas" },
      { amount: 3500, category: "Estoque" },
    ],
    exits: [
      { amount: 1800, category: "Administração" },
      { amount: 900, category: "Diversas" },
      { amount: 1300, category: "Energia" },
      { amount: 2700, category: "Financiamento" },
      { amount: 2000, category: "Logística" },
      { amount: 2400, category: "Marketing" },
      { amount: 4500, category: "Pessoal" },
      { amount: 1000, category: "Provisões" },
      { amount: 1800, category: "Serviços" },
      { amount: 1500, category: "Tecnologia" },
    ],
  },
  "03": {
    initialBalance: 15000,
    entries: [
      { amount: 7000, category: "Outras receitas" },
      { amount: 3000, category: "Vendas" },
      { amount: 4000, category: "Estoque" },
    ],
    exits: [
      { amount: 2000, category: "Administração" },
      { amount: 1000, category: "Diversas" },
      { amount: 1500, category: "Energia" },
      { amount: 3000, category: "Financiamento" },
      { amount: 2500, category: "Logística" },
      { amount: 2800, category: "Marketing" },
      { amount: 5000, category: "Pessoal" },
      { amount: 1200, category: "Provisões" },
      { amount: 2000, category: "Serviços" },
      { amount: 1700, category: "Tecnologia" },
    ],
  },
};

export default function CashFlow() {
  const { activeAnalysis } = useAnalyses();

  const getTotalEntries = (month: string) => {
    return data[month].entries.reduce(
      (total, entry) => total + entry.amount,
      0
    );
  };

  const getTotalExits = (month: string) => {
    return data[month].exits.reduce((total, exit) => total + exit.amount, 0);
  };

  const getTrimesterData = (
    months: string[],
    func: (month: string) => number
  ) => {
    return months.reduce((total, month) => total + func(month), 0);
  };

  const getTotalBalance = (months: string[]) => {
    const totalEntries = getTrimesterData(months, getTotalEntries);
    const totalExits = getTrimesterData(months, getTotalExits);
    const initialBalance = data[months[0]].initialBalance;
    return initialBalance + totalEntries - totalExits;
  };

  const getCategoryTotal = (category: string, months: string[]) => {
    return months.reduce((total, month) => {
      const entriesTotal = data[month].entries
        .filter((e) => e.category === category)
        .reduce((sum, e) => sum + e.amount, 0);
      const exitsTotal = data[month].exits
        .filter((e) => e.category === category)
        .reduce((sum, e) => sum + e.amount, 0);
      return total + entriesTotal - exitsTotal;
    }, 0);
  };

  const getTotalByType = (type: "entries" | "exits", months: string[]) => {
    return months.reduce((total, month) => {
      return total + data[month][type].reduce((sum, e) => sum + e.amount, 0);
    }, 0);
  };

  const activeTrimester = ["01", "02", "03"];
  const entriesCategories = Array.from(
    new Set(
      activeTrimester.flatMap((month) =>
        data[month].entries.map((e) => e.category)
      )
    )
  );
  const exitsCategories = Array.from(
    new Set(
      activeTrimester.flatMap((month) =>
        data[month].exits.map((e) => e.category)
      )
    )
  );

  return (
    <div className="space-y-8 relative">
      <header className="animate-fade-up flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="uppercase text-[11px] tracking-widest !opacity-30 mb-3">
            {activeAnalysis ? `${activeAnalysis.name}` : ""}
          </div>
          <h1 className="text-2xl leading-[1.05] tracking-tight ">
            Fluxo de Caixa{" "}
            <span className="ml-4 tracking-wider rounded-full align-middle text-center px-2 py-0.5 text-[9px] font-semibold bg-[#75cf5a] dark:bg-[#0f2707] border border-[#74b64d] dark:border-[#235015] dark:text-[#74b64d]">
              EM BREVE
            </span>
          </h1>
        </div>
      </header>
      <div className="flex items-center gap-4 flex-wrap justify-between w-full">
        <div className="flex items-center gap-4 flex-wrap">
          <Select
            value={"trimestral"}
            onChange={(v) => ({})}
            options={[
              { v: "semanal", l: "Semanal" },
              { v: "mensal", l: "Mensal" },
              { v: "trimestral", l: "Trimestral" },
              { v: "semestral", l: "Semestral" },
              { v: "anual", l: "Anual" },
              { v: "personalizado", l: "Personalizado" },
            ]}
          />
          <div>01/01/26 - 31/03/26</div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
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
        </div>
      </div>
      <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4">
        <DataCard
          icon={CircleDollarSign}
          title="Saldo Inicial (01/01/2026)"
          amount={data[activeTrimester[0]].initialBalance}
        />
        <DataCard
          icon={ArrowBigDown}
          title={`Entradas (${getTrimesterData(
            activeTrimester,
            (month: string) => data[month].entries.length
          )})`}
          amount={getTrimesterData(activeTrimester, getTotalEntries)}
        />
        <DataCard
          icon={ArrowBigUp}
          title={`Saídas (${getTrimesterData(
            activeTrimester,
            (month: string) => data[month].exits.length
          )})`}
          amount={getTrimesterData(activeTrimester, getTotalExits) * -1}
        />
        <DataCard
          icon={Wallet}
          title="Saldo acumulado (30/01/2026)"
          amount={getTotalBalance(activeTrimester)}
        />
      </div>
      <section className="animate-fade-up delay-2 dark:bg-[#0b0918] border dark:border-[#171132] rounded-lg overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-gray-200 dark:bg-[#15152f] border-b dark:border-[#171132]">
            <tr>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal text-left">
                Categoria
              </th>
              <th className="uppercase text-[11px] bg-gray-300 dark:bg-[#0b0918] tracking-widest !opacity-60 px-5 py-3 font-normal text-right">
                Total no período
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal text-right">
                Jan/26
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal text-right">
                Fev/26
              </th>
              <th className="uppercase text-[11px] tracking-widest !opacity-30 px-5 py-3 font-normal text-right">
                Mar/26
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-base border-b dark:border-[#171132]/60 last:border-0 hover:bg-[#15152f]/10 dark:bg-[#15152f]/40 transition-colors">
              <td className="px-5 py-3.5 border-l-2 border-[#29c89b] text-[#29c89b]">
                Receitas
              </td>
              <td className="px-5 py-3.5 bg-gray-100 dark:bg-[#0b0918] text-right whitespace-nowrap font-semibold text-[#29c89b]">
                {formatBRL(getTotalByType("entries", activeTrimester))}
              </td>
              {activeTrimester.map((month) => (
                <td className="px-5 py-3.5 text-right whitespace-nowrap font-semibold text-[#29c89b]">
                  {formatBRL(
                    data[month].entries.reduce(
                      (total, e) => total + e.amount,
                      0
                    )
                  )}
                </td>
              ))}
            </tr>
            {entriesCategories.map((category) => (
              <Row
                category={category}
                activeTrimester={activeTrimester}
                getCategoryTotal={getCategoryTotal}
                list="entries"
                data={data}
              />
            ))}
            <tr className="text-base border-b dark:border-[#171132]/60 last:border-0 hover:bg-[#15152f]/10 dark:bg-[#15152f]/40 transition-colors">
              <td className="px-5 py-3.5 border-l-2 border-[#ff9191] text-[#ff9191]">
                Despesas
              </td>
              <td className="px-5 py-3.5 bg-gray-100 dark:bg-[#0b0918] text-right whitespace-nowrap font-semibold text-[#ff9191]">
                -{formatBRL(getTotalByType("exits", activeTrimester))}
              </td>
              {activeTrimester.map((month) => (
                <td className="px-5 py-3.5 text-right whitespace-nowrap font-semibold text-[#ff9191]">
                  -
                  {formatBRL(
                    data[month].exits.reduce((total, e) => total + e.amount, 0)
                  )}
                </td>
              ))}
            </tr>
            {exitsCategories.map((category) => (
              <Row
                category={category}
                activeTrimester={activeTrimester}
                getCategoryTotal={getCategoryTotal}
                list="exits"
                data={data}
              />
            ))}
          </tbody>
        </table>
      </section>
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
  category,
  activeTrimester,
  getCategoryTotal,
  data,
  list,
}: {
  category: string;
  activeTrimester: string[];
  getCategoryTotal: (category: string, months: string[]) => number;
  data: any;
  list: string;
}) {
  return (
    <tr className="border-b dark:border-[#171132]/60 last:border-b-0 hover:bg-[#15152f]/10 dark:bg-[#15152f]/40 transition-colors">
      <td
        className={`px-5 py-3.5 pl-12 border-l-2 ${
          list === "entries" ? "border-[#29c89b]" : "border-[#ff9191]"
        }`}
      >
        {category}
      </td>
      <td className="px-5 py-3.5 font-semibold bg-gray-100 dark:bg-[#0b0918] text-right">
        {formatBRL(getCategoryTotal(category, activeTrimester))}
      </td>
      {activeTrimester.map((month) => (
        <td className="px-5 py-3.5 text-right whitespace-nowrap">
          {list === "exits" && "-"}
          {formatBRL(
            data[month][list]
              .filter((e) => e.category === category)
              .reduce((total, e) => total + e.amount, 0)
          )}
        </td>
      ))}
    </tr>
  );
}
