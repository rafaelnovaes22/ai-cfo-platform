import { NavLink } from "react-router-dom";
import {
  Home,
  FileBarChart2,
  ListChecks,
  Upload,
  Receipt,
  ArrowDownUp,
  CircleDollarSign,
} from "lucide-react";

const workspace = [
  { to: "/", label: "Visão Geral", icon: Home, end: true, soon: false },
  { to: "/plano", label: "Plano de Ação", icon: ListChecks, soon: false },
  { to: "/dre", label: "DRE", icon: FileBarChart2, soon: false },
  { to: "/lancamentos", label: "Lançamentos", icon: Receipt, soon: false },
  { to: "/caixa", label: "Fluxo de Caixa", icon: ArrowDownUp },
  { to: "/credito", label: "Crédito", icon: CircleDollarSign, soon: true },
];
const dados = [
  { to: "/importar", label: "Importar", icon: Upload, soon: false },
];

export const routes = [...workspace];

function Section({ items }: { items: typeof workspace }) {
  return (
    <div>
      <nav className="flex md:gap-1 justify-around w-screen md:w-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            title={it.label}
            className={({ isActive }) =>
              `min-w-[64px] relative overflow-hidden group flex flex-col md:flex-row items-center gap-2.5 px-1 md:px-8 py-3 md:py-4 transition-colors ${
                isActive ? "font-semibold" : ""
              }`
            }
            children={({ isActive }) => (
              <>
                <it.icon
                  className={`h-[22px] w-[22px] md:h-[15px] md:w-[15px] shrink-0 ${
                    isActive ? "text-[#3D24A0] dark:text-[#96ff7e]" : ""
                  }`}
                  strokeWidth={1.75}
                />
                <span
                  className={`relative opacity-70 group-hover:opacity-100 text-center items-center flex leading-[1.2] md:text-left md:whitespace-nowrap text-[11px] md:text-base ${
                    isActive ? "opacity-100" : ""
                  }`}
                >
                  {it.label}
                  {it.soon && (
                    <div className="absolute inline-block tracking-widest opacity-50 -bottom-[14px] left-0 text-[9px] uppercase">
                      Em breve
                    </div>
                  )}
                </span>
                <span
                  className={`bg-[#3D24A0] dark:bg-[#96ff7e] rounded rounded-t-none rounded-b md:rounded-t md:rounded-b-none absolute left-0 h-1 w-full transition-all duration-300 group-hover:top-0 group-hover:bottom-auto group-hover:md:bottom-0 group-hover:md:top-auto ${
                    isActive
                      ? "md:top-auto md:bottom-0 top-0 bottom-auto "
                      : "-top-1 bottom-auto md:top-auto md:-bottom-1 bg-white"
                  }`}
                ></span>
              </>
            )}
          />
        ))}
      </nav>
    </div>
  );
}

export function Topbar() {
  return (
    <header className="fixed bottom-0 w-full md:sticky md:top-0 z-50 bg-gray-200 dark:bg-[#120d2a] flex items-center justify-between px-2 md:px-8">
      <div className="hidden pointer-events-none dark:block absolute -top-10 left-0 w-full h-10 bg-gradient-to-t from-[#09080f] to-transparent md:hidden"></div>
      <div className="hidden md:flex justify-between w-full">
        <Section items={workspace} />
        <Section items={dados} />
      </div>
      <div className="flex md:hidden justify-between w-full">
        <Section items={routes} />
      </div>
    </header>
  );
}
