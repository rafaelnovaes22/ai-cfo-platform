import { Download, Loader2, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { LumenLogo } from "../components/Logo.tsx";
import { useAuth } from "../auth/AuthContext.tsx";
import { useState, useRef, useEffect } from "react";
import { useAnalyses } from "../data/useAnalyses.ts";
import { toast } from "sonner";
import { routes } from "./Topbar.tsx";
import { NavLink } from "react-router-dom";
import { api } from "@/lib/api/index.js";

const map: Record<string, string> = {
  "/": "Hub de análise",
  "/dre": "DRE facilitado",
  "/plano": "Plano de ação",
  "/importar": "Importar dados",
  "/lancamentos": "Lançamentos",
};

export function Sidebar() {
  const { user, signOut } = useAuth();
  const { activeId } = useAnalyses();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [theme, setTheme] = useState("dark");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const htmlClasses = document.documentElement.classList;
    const defaultThemeIsDark =
      localStorage.theme === "dark" ||
      (!("theme" in localStorage) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    htmlClasses.toggle("dark", defaultThemeIsDark);
    setTheme(defaultThemeIsDark ? "dark" : "light");
  }, [theme]);

  const handleThemeToggle = () => {
    const htmlClasses = document.documentElement.classList;
    const newTheme = theme === "light" ? "dark" : "light";
    htmlClasses.toggle("dark", newTheme === "dark");
    localStorage.setItem("theme", newTheme);
    setTheme(newTheme);
  };

  const displayName = user?.userId ?? "";
  const initials = (displayName || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const canExport = !!activeId;

  async function handleExport() {
    if (!activeId) {
      toast.error("Selecione uma análise para exportar.");
      return;
    }
    setExporting(true);
    try {
      await api.export.download(activeId, "monthly");
      toast.success("DRE exportado.");
    } catch {
      toast.error("Erro ao exportar DRE.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <aside
      className={`w-full shrink-0 py-2 px-8 items-center bg-transparent md:bg-cream md:dark:bg-[#09080f] flex transition-[width] duration-200 ease-out justify-between`}
    >
      <div className={`py-2 flex items-center`}>
        <a href="/">
          <LumenLogo size={32} />
        </a>
        <h1 className="hidden md:flex whitespace-nowrap ml-8 pl-8 py-2 border-l border-1 border-[#245fff]/30 text-xl">
          Hub de Análises
        </h1>
      </div>

      <div className="md:hidden flex items-center gap-3">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:opacity-90 transition-colors"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      <div
        className={`${
          menuOpen
            ? "opacity-100 left-0 right-12"
            : "-left-[100%] right-auto opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto"
        } flex flex-col transition-all duration-200 ease-out fixed md:static top-0 bottom-0 z-[150] md:p-0 bg-cream dark:bg-[#09080f] md:flex md:flex-row md:gap-4 md:items-center`}
      >
        <X
          className="absolute top-4 right-4 md:hidden h-6 w-6 cursor-pointer"
          onClick={() => setMenuOpen(false)}
        />
        <div className="flex md:hidden flex-col md:h-auto py-6">
          <LumenLogo size={32} className="mb-8 mr-auto ml-4" />
          {routes.map((route) => (
            <NavLink
              key={route.to}
              to={route.to}
              title={route.label}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `relative overflow-hidden group flex items-center gap-2.5 px-4 py-4 transition-colors ${
                  isActive ? "font-semibold" : ""
                }`
              }
              children={({ isActive }) => (
                <>
                  <route.icon
                    className={`h-[22px] w-[22px] md:h-[15px] md:w-[15px] shrink-0 ${
                      isActive ? "text-[#3D24A0] dark:text-[#96ff7e]" : ""
                    }`}
                    strokeWidth={1.75}
                  />
                  <span
                    className={`-mt-1.5 opacity-70 group-hover:opacity-100 text-center items-center flex leading-[1.2] md:text-left md:whitespace-nowrap ${
                      isActive ? "opacity-100" : ""
                    }`}
                  >
                    {route.label}
                  </span>
                  <span
                    className={`bg-[#3D24A0] dark:bg-[#96ff7e] rounded rounded-r absolute h-full w-1 transition-all duration-300 group-hover:right-0 ${
                      isActive ? "right-0" : "-right-1 bg-white"
                    }`}
                  ></span>
                </>
              )}
            />
          ))}
        </div>
        <div className="flex items-start md:items-center gap-3 mt-auto md:mt-0 p-4 md:p-0">
          <button
            onClick={handleExport}
            disabled={!canExport || exporting}
            title={canExport ? "Exportar DRE da análise ativa" : "Selecione uma análise para exportar"}
            className="hidden md:flex items-center whitespace-nowrap gap-1.5 px-3 py-1.5 rounded-md text-white bg-[#3D24A0] dark:bg-[#245fff] text-[12.5px] hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? "Exportando…" : "DRE"}
          </button>
          <div
            onClick={handleThemeToggle}
            className="relative w-28 md:w-40 flex overflow-hidden cursor-pointer items-center mx-2 gap-4 px-3 py-2 rounded-full border border-[#3D24A0] dark:border-[#245fff]"
          >
            <Sun className="relative z-10 w-4 h-4 min-w-4 min-h-4 pointer-events-none text-white dark:text-inherit" />
            <Moon className="relative z-10 w-4 h-4 min-w-4 min-h-4 pointer-events-none" />
            <span className="sr-only pointer-events-none">Toggle theme</span>
            <span
              className={`absolute pointer-events-none transition-all duration-300 z-1 top-0 h-full w-1/2 bg-[#3D24A0] dark:bg-[#245fff] ${
                theme === "dark" ? "right-0 left-auto" : "left-0 right-auto"
              }`}
            ></span>
          </div>
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="h-8 w-8 rounded-full bg-navy text-cream flex items-center justify-center text-[12px] font-medium hover:opacity-90 transition-opacity"
              title={displayName}
            >
              {initials || "?"}
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-card rounded-md shadow-md py-1 z-30">
                <div className="px-3 py-2">
                  <div className="text-[12.5px] truncate">{user?.role ?? "—"}</div>
                  <div className="text-[11.5px] text-[#96ff7e] truncate">{user?.tenantId ?? ""}</div>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => signOut()}
            className={`group flex items-center w-full gap-2.5 px-3 py-2 rounded-md text-[12.5px] transition-colors`}
          >
            <LogOut className="h-[14px] w-[14px] shrink-0" strokeWidth={1.5} />
            <span>Sair</span>
          </button>
        </div>
      </div>
      <div
        className={`z-[51] block md:hidden fixed top-0 left-0 w-screen h-screen bg-[#000000]/90 ${
          menuOpen ? "opacity-100 pointer-events-all" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
      ></div>
    </aside>
  );
}

// Eliminate the unused import warning for `map`
void map;
