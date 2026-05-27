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

const labels = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho"];

export const data = {
  labels,
  datasets: [
    {
      type: "bar" as const,
      label: "Receita",
      backgroundColor: "#29c89b",
      data: labels.map(() => Math.floor(Math.random() * 1000)),
      borderColor: "transparent",
      borderRadius: 8,
      borderWidth: 2,
    },
    {
      type: "bar" as const,
      label: "Despesa",
      backgroundColor: "#ff9191",
      data: labels.map(() => Math.floor(Math.random() * 1000)),
      borderColor: "transparent",
      borderRadius: 8,
      borderWidth: 2,
    },
  ],
};

const options = {
  responsive: true,
};

export default function IncomeOutcomeChart() {
  return (
    <article className="relative w-full max-h-[320px] grid grid-cols-12 pb-12">
      <div className="col-span-12 -mx-6">
        <div className="font-semibold mb-8 ml-6">
          Receita X Despesa (Últimos 12 meses)
        </div>
        <div className="w-full h-full max-h-[280px]">
          <Chart type="bar" height={100} data={data} options={options} />
        </div>
      </div>
    </article>
  );
}
