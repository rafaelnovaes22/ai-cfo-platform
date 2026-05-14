import { formatBRL } from "@/lumen/data/analytics";

const kpis = [
  {
    id: 1,
    name: "Receita Mensal",
    description: "Total de receita gerada no mês",
    amount: 55000,
    targetAmount: 60000,
  },
  {
    id: 2,
    name: "Despesas Mensais",
    description: "Total de despesas no mês",
    amount: 35000,
    targetAmount: 40000,
  },
  {
    id: 3,
    name: "Lucro Líquido",
    description: "Lucro após deduzir despesas",
    amount: 20000,
    targetAmount: 30000,
  },
  {
    id: 4,
    name: "Margem de Lucro",
    description: "Lucro líquido como porcentagem da receita",
    amount: 36.36,
    targetAmount: 50,
  },
  {
    id: 5,
    name: "Crescimento de Receita",
    description: "Percentual de crescimento em relação ao mês anterior",
    amount: 10,
    targetAmount: 15,
  },
  {
    id: 6,
    name: "Diminuição de Despesas",
    description:
      "Percentual de diminuição das despesas em relação ao mês anterior",
    amount: 5,
    targetAmount: 50,
  },
];

const categoryChip: Record<string, string> = {
  critical: "dark:bg-[#441616] text-[#ff9191] border border-[#a64c4c]",
  alert:
    "dark:bg-[#493210] text-[#d19130] dark:text-[#ffc66e] border border-[#9c7335]",
  good: "dark:bg-[#143563] text-[#62a3ff] border border-[#376db9]",
  great: "dark:bg-[#08382a] text-[#29c89b] border border-[#157d60]",
};

const getPerformance = (amount: number, targetAmount: number) => {
  const performance = {
    category: "",
    color: "",
    percentage: targetAmount > 0 ? (amount / targetAmount) * 100 : 0,
  };

  if (amount >= targetAmount * 0.9) {
    performance.category = "ÓTIMO";
    performance.color = "great";
  } else if (amount >= targetAmount * 0.75) {
    performance.category = "BOM";
    performance.color = "good";
  } else if (amount >= targetAmount * 0.5) {
    performance.category = "ALERTA";
    performance.color = "alert";
  } else {
    performance.category = "CRÍTICO";
    performance.color = "critical";
  }

  return performance;
};

export default function KPIsCard() {
  return (
    <article className="relative h-full grid grid-cols-12 pb-12">
      <div className="col-span-12">
        <div className="font-semibold mb-8">Semáforo de KPIs</div>
      </div>
      <div className="col-span-12 grid grid-cols-12 gap-4">
        {kpis.map((kpi) => {
          const performance = getPerformance(kpi.amount, kpi.targetAmount);
          return (
            <div
              key={kpi.id}
              className="col-span-12 md:col-span-6 lg:col-span-4 p-4 rounded-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline px-2 py-1 align-middle text-[9px] font-semibold rounded-full ${
                    categoryChip[performance.color]
                  }`}
                >
                  {performance.category}
                </span>
                <div
                  className="font-semibold text-lg"
                  style={{
                    color: categoryChip[performance.color],
                  }}
                >
                  {performance.percentage.toFixed(1)}%
                </div>
              </div>
              <div className="flex flex-col mb-2">
                <div className="text-lg font-semibold">{kpi.name}</div>
                <div className="flex flex-col md:flex-row md:items-end gap-1">
                  <span className="whitespace-nowrap">
                    {formatBRL(kpi.amount)}
                  </span>
                  <span className="opacity-30 text-[13px] whitespace-nowrap">
                    {" "}
                    / {formatBRL(kpi.targetAmount)}
                  </span>
                </div>
              </div>
              <div className="text-sm opacity-30">{kpi.description}</div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
