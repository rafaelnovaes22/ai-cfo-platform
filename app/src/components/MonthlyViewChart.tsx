import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  LineController,
  BarController,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import DashboardCard from "./DashboardCard";
import { formatBRL } from "@/lumen/data/analytics";

ChartJS.register(
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  LineController,
  BarController
);

const labels = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const dataset = [
  10000, 20000, 10000, 5000, 20000, 30000, 5000, 20000, 10000, 30000, 10000,
  20000,
];

export const data = {
  labels,
  datasets: [
    {
      type: "line" as const,
      label: "Margem",
      borderColor: "rgb(99, 213, 255)",
      borderWidth: 2,
      tension: 0.4,
      fill: false,
      pointRadius: 0,
      pointHoverRadius: 0,
      data: dataset,
    },
  ],
};

const options = {
  scales: {
    x: {
      border: {
        display: false, // Removes the main axis line
      },
      grid: {
        display: false, // Removes background grid lines
      },
      ticks: {
        display: false, // Removes labels (e.g., "Jan", "Feb")
      },
    },
    y: {
      border: {
        display: false, // Removes the main axis line
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
  aspectRatio: 24, // Width is twice the height
  maintainAspectRatio: true, // Required for the ratio to be enforced
  plugins: {
    legend: {
      display: false, // Hides the top dataset labels
    },
  },
};

export default function MonthlyViewChart() {
  return (
    <article className="relative h-full grid grid-cols-12 mb-4 border-b-2 border-[#15152f]/10 dark:border-white/10">
      <div className="col-span-12">
        <div className="font-semibold mb-2">Saldo mensal (Último ano)</div>
        <div className="-left-[calc((100%*1)+(8px*1))]"></div>
        <div className="-left-[calc((100%*2)+(8px*2))]"></div>
        <div className="-left-[calc((100%*3)+(8px*3))]"></div>
        <div className="-left-[calc((100%*4)+(8px*4))]"></div>
        <div className="-left-[calc((100%*5)+(8px*5))]"></div>
        <div className="-left-[calc((100%*6)+(8px*6))]"></div>
        <div className="-left-[calc((100%*7)+(8px*7))]"></div>
        <div className="-left-[calc((100%*8)+(8px*8))]"></div>
        <div className="-left-[calc((100%*9)+(8px*9))]"></div>
        <div className="-left-[calc((100%*10)+(8px*10))]"></div>
        <div className="-left-[calc((100%*11)+(8px*11))]"></div>
        <div className="w-full overflow-auto">
          <div className="grid grid-cols-12 relative h-44 gap-2 min-w-[1400px] w-full">
            {labels.map((label, index) => (
              <div className="col-span-1 rounded-3xl py-6 overflow-hidden bg-white dark:bg-[#0b0918] border border-[#e5e5e5] shadow-card dark:shadow-none dark:border-[#171132] animate-fade-up delay-1">
                <div
                  className={`min-w-[1400px] md:min-w-[100vw] h-24 px-0 md:px-20 -ml-2 md:ml-[-88px] absolute inset-0 top-12 -left-[calc((100%*${index})+(8px*${index}))]`}
                >
                  <Chart type="line" data={data} options={options} />
                </div>
                <div className="flex h-32 flex-col text-sm items-center justify-between gap-2">
                  <div className="font-semibold">
                    {formatBRL(dataset[index])}
                  </div>
                  <div>{label}/26</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
