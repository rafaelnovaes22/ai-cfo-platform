import { getDateByGranularity } from "@/lumen/pages/CashFlow";
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

export const getData = (data, granularity) => ({
  labels: data.map((item) => getDateByGranularity(item.period, granularity)),
  datasets: [
    {
      type: "bar" as const,
      label: "Receita",
      backgroundColor: "#29c89b",
      data: data.map((item) => item.creditsCents / 100),
      borderColor: "transparent",
      borderRadius: 8,
      borderWidth: 2,
    },
    {
      type: "bar" as const,
      label: "Despesa",
      backgroundColor: "#ff9191",
      data: data.map((item) => item.debitsCents / 100),
      borderColor: "transparent",
      borderRadius: 8,
      borderWidth: 2,
    },
  ],
});

const options = {
  responsive: true,
};

export default function IncomeOutcomeChart({
  data,
  granularity,
}: {
  data: any;
  granularity: string;
}) {
  if (!data) return null;
  const chartData: any = getData(data, granularity);

  return (
    <article className="relative w-full max-h-[320px] grid grid-cols-12 pb-12">
      <div className="col-span-12 -mx-6">
        <div className="font-semibold mb-8 ml-6">
          Receita X Despesa (Últimos 12 meses)
        </div>
        <div className="w-full h-full max-h-[280px]">
          <Chart type="bar" height={100} data={chartData} options={options} />
        </div>
      </div>
    </article>
  );
}
