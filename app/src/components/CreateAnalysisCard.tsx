import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function CreateAnalysisCard({ current, inputMethods }) {
  return (
    <section className="relative h-full w-full pb-12">
      <div className="">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="font-semibold  mb-4">
              {current ? "Criar nova análise" : "Iniciar primeira análise"}
            </h2>
            <p className="text-[13px] dark:text-[#96ff7e] mt-1">
              Escolha o formato dos dados e leve cerca de 2 minutos.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {inputMethods.map((m) => (
            <Link
              key={m.id}
              to={`/importar?method=${m.id}`}
              className="group flex items-center gap-3 p-4 rounded-md bg-cream dark:bg-[#15152f] hover:bg-[#15152f]/10 dark:bg-[#15152f]/40 transition-all"
            >
              <m.icon
                className="h-4 w-4 text-[#3D24A0] dark:text-[#96ff7e] group-hover:"
                strokeWidth={1.6}
              />
              <span className="text-[13px] ">{m.label}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 col-span-12 w-full flex flex-wrap gap-3 mt-4">
        <Link
          to="/importar"
          className="group inline-flex items-center gap-2 text-lg transition-colors"
        >
          Ver todos os métodos
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </section>
  );
}
