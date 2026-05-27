import { formatBRL } from "@/lumen/data/categories";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function DebitsCard() {
  const demoData = {
    totalAmount: 24000,
    approvedAmount: -160000,
    totalDebts: 13,
  };
  return (
    <article className="relative dark:text-white z-10 h-full animate-fade-up delay-1 grid grid-cols-12 gap-6  pb-16 overflow-hidden">
      <div className="col-span-12 px-10 pl-0">
        <div className="font-semibold  mb-4">Economia com dívidas</div>
        <div className="text-5xl font-semibold leading-none -tracking-[3px]  tabular font-sans">
          {formatBRL(demoData.totalAmount)}
        </div>
        <div className="mt-8 pl-4 border-l-2 flex flex-col items-start gap-0 text-[13px]">
          <span className="font-semibold">Valor total das dívidas</span>
          <span
            className={`whitespace-nowrap font-medium text-lg md:text-xl ${
              demoData.approvedAmount >= 0 ? "text-[#29c89b]" : "text-[#ff9191]"
            }`}
          >
            {formatBRL(demoData.approvedAmount)}
          </span>
        </div>
        <div className="mt-8 pl-4 border-l-2 flex flex-col items-start gap-0 text-[13px]">
          <span className="font-semibold">Total de dívidas cambiáveis</span>
          <span
            className={`whitespace-nowrap font-medium text-lg md:text-xl ${
              demoData.totalDebts >= 0 ? "text-[#29c89b]" : "text-[#ff9191]"
            }`}
          >
            {demoData.totalDebts}
          </span>
        </div>

        <div className="absolute bottom-0">
          <Link
            to="/dre"
            className="group inline-flex items-center gap-2 text-lg transition-colors"
          >
            Trocar dívidas
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </article>
  );
}
