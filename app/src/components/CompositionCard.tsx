import { formatBRL } from "@/lumen/data/categories";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function CompositionCard({ current, composition }) {
  return (
    <article className="relative text-white z-10 h-full animate-fade-up delay-1 grid grid-cols-12 gap-6  pb-16 overflow-hidden">
      <div className="col-span-12 px-10 pl-0">
        <div className="font-semibold  mb-4">Lucro líquido</div>
        <div className="text-5xl font-semibold leading-none -tracking-[3px]  tabular font-sans">
          {formatBRL(current.netProfit)}
        </div>
        <div className="mt-8 pl-4 border-l-2 flex flex-col items-start gap-0 text-[13px]">
          <span className="font-semibold">Margem</span>
          <span
            className={`whitespace-nowrap font-medium text-lg md:text-xl ${
              current.margin >= 0 ? "text-[#29c89b]" : "text-[#ff9191]"
            }`}
          >
            {current.margin}%
          </span>
        </div>
        <div className="flex gap-6">
          <div className="mt-4 pl-4 border-l-2 border-[#29c89b] flex flex-col items-start gap-0 text-[13px]">
            <span className="font-semibold text-[#29c89b]">Receitas</span>
            <span className="whitespace-nowrap font-medium text-lg md:text-xl text-[#29c89b]">
              {formatBRL(composition.income)}
            </span>
          </div>
          <div className="mt-4 pl-4 border-l-2 border-[#ff9191] flex flex-col items-start gap-0 text-[13px]">
            <span className="font-semibold text-[#ff9191]">Despesas</span>
            <span className="whitespace-nowrap font-medium text-lg md:text-xl text-[#ff9191]">
              -{formatBRL(composition.expense)}
            </span>
          </div>
        </div>

        <div className="absolute bottom-0">
          <Link
            to="/dre"
            className="group inline-flex items-center gap-2 text-lg transition-colors"
          >
            Ver DRE completo
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </article>
  );
}
