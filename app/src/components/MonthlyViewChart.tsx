import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Filler,
  Tooltip,
  LineController,
  BarController,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { formatBRL } from "@/lumen/data/analytics";
import type { TrendPoint } from "@/lib/api";
import { formatDate } from "date-fns";
import { ptBR } from "date-fns/locale";

ChartJS.register(
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  LineController,
  BarController,
  Filler
);

const getYear = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = {
    year: "2-digit",
  };
  return new Date(dateString).toLocaleDateString("pt-BR", options);
};

const twelveItems = new Array(12).fill({
  ebitda: 0,
  lucroLiquido: 0,
  margemBruta: 0,
  margemLiquida: 0,
  margemOperacional: 0,
  referenceMonth: "1970-01",
  receitaLiquida: 0,
});

const demoData: TrendPoint[] = [
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2025-06",
    receitaLiquida: 10000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2025-07",
    receitaLiquida: 20000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2025-08",
    receitaLiquida: 10000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2025-09",
    receitaLiquida: 5000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2025-10",
    receitaLiquida: 20000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2025-11",
    receitaLiquida: 30000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2025-12",
    receitaLiquida: 5000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2026-01",
    receitaLiquida: 20000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2026-02",
    receitaLiquida: 10000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2026-03",
    receitaLiquida: 30000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2026-04",
    receitaLiquida: 20000,
  },
  {
    ebitda: 0,
    lucroLiquido: 0,
    margemBruta: 0,
    margemLiquida: 0,
    margemOperacional: 0,
    referenceMonth: "2026-05",
    receitaLiquida: 5000,
  },
];

export const data = (dataset: TrendPoint[], amount: number) => {
  const color = amount > 0 ? "#29c89b" : "#ff9191";
  const labels = twelveItems.map((_, index) => index + 1);
  const itemData = dataset.map((item) => item?.receitaLiquida || 0);

  return {
    labels,
    datasets: [
      {
        label: "Margem",
        borderColor: color,
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        backgroundColor: (context) => {
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return;

          const gradient = ctx.createLinearGradient(
            0,
            chartArea.bottom,
            0,
            chartArea.top
          );
          gradient.addColorStop(0, `${color}00`);
          gradient.addColorStop(1, `${color}44`);
          return gradient;
        },
        pointRadius: 0,
        pointHoverRadius: 0,
        data: itemData,
      },
    ],
  };
};

const options = {
  scales: {
    x: {
      border: {
        display: false,
      },
      grid: {
        display: false,
      },
      ticks: {
        display: false,
      },
    },
    y: {
      border: {
        display: false,
      },
      grid: {
        display: false,
      },
      ticks: {
        display: false,
      },
    },
  },
  responsive: true,
  aspectRatio: 24,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: false,
    },
    filler: {
      propagate: true,
    },
  },
};

export default function MonthlyViewChart({
  chartData = demoData,
}: {
  chartData?: TrendPoint[];
}) {
  return (
    <article className="relative h-full grid grid-cols-12 mb-4 border-b-2 border-[#15152f]/10 dark:border-white/10">
      <div className="col-span-12">
        <div className="font-semibold mb-2">
          Receita mensal (
          {chartData.length <= 12
            ? chartData.length === 1
              ? `Último 1 mês`
              : `Últimos ${chartData.length} meses`
            : "Últimos 12 meses"}
          )
        </div>
        <div className="opacity-0 -left-[calc((100%*1)+(8px*1))]"></div>
        <div className="opacity-0 -left-[calc((100%*2)+(8px*2))]"></div>
        <div className="opacity-0 -left-[calc((100%*3)+(8px*3))]"></div>
        <div className="opacity-0 -left-[calc((100%*4)+(8px*4))]"></div>
        <div className="opacity-0 -left-[calc((100%*5)+(8px*5))]"></div>
        <div className="opacity-0 -left-[calc((100%*6)+(8px*6))]"></div>
        <div className="opacity-0 -left-[calc((100%*7)+(8px*7))]"></div>
        <div className="opacity-0 -left-[calc((100%*8)+(8px*8))]"></div>
        <div className="opacity-0 -left-[calc((100%*9)+(8px*9))]"></div>
        <div className="opacity-0 -left-[calc((100%*10)+(8px*10))]"></div>
        <div className="opacity-0 -left-[calc((100%*11)+(8px*11))]"></div>
        <div className="w-full overflow-y-auto">
          <div className="grid grid-cols-12 relative h-48 gap-2 min-w-[1400px] w-full">
            {twelveItems.map((item, index) => {
              const currentData = chartData[index] || item;
              return (
                currentData && (
                  <div
                    key={Math.random()}
                    className={`${chartData[index] ? "" : "hidden"} col-span-1 rounded-3xl py-6 overflow-hidden bg-white dark:bg-[#0b0918] border border-[#e5e5e5] shadow-card dark:shadow-none dark:border-[#171132] animate-fade-up delay-1`}
                  >
                    <div
                      className={`min-w-[1400px] md:min-w-[100vw] h-18 px-0 md:px-20 -ml-2 md:ml-[-88px] absolute inset-0 top-12 -left-[calc((100%*${index})+(8px*${index}))]`}
                    >
                      <Chart
                        type="line"
                        data={data(
                          [...chartData, ...twelveItems],
                          currentData.receitaLiquida
                        )}
                        options={options}
                      />
                    </div>
                    <div className="flex h-36 flex-col text-sm items-center justify-between gap-2">
                      <div className="font-semibold">
                        {formatBRL(currentData.receitaLiquida)}
                      </div>
                      <div>
                        {currentData.referenceMonth.split("-")[1] +
                          "/" +
                          getYear(currentData.referenceMonth)}
                      </div>
                    </div>
                  </div>
                )
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}
