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
      type: "line" as const,
      label: "Margem",
      borderColor: "rgb(99, 213, 255)",
      borderWidth: 2,
      tension: 0.4,
      fill: false,
      data: labels.map(() => Math.floor(Math.random() * 1000)),
    },
    {
      type: "bar" as const,
      label: "Lucro líquido",
      backgroundColor: "rgb(97, 75, 192)",
      data: labels.map(() => Math.floor(Math.random() * 1000)),
      borderColor: "transparent",
      borderRadius: 8,
      borderWidth: 2,
    },
  ],
};

export default function ResultChart() {
  return (
    <article className="relative h-full grid grid-cols-12 pb-12">
      <div className="col-span-12 -mx-6">
        <div className="font-semibold mb-8 ml-6">
          Resultado acumulado (Último ano)
        </div>
        <Chart type="bar" data={data} />
      </div>
    </article>
  );
}
