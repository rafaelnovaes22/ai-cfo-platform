import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, ClipboardPaste, FileText, Sheet, PencilLine, Inbox } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useAnalyses } from "../data/useAnalyses.ts";
import { api, type HubResponse } from "@/lib/api/index.js";
import { formatBRL } from "../data/analytics";
import { PipelineProgress } from "../components/PipelineProgress.tsx";

const inputMethods = [
  { id: "paste", icon: ClipboardPaste, label: "Colar planilha" },
  { id: "pdf", icon: FileText, label: "PDF do contador" },
  { id: "xls", icon: Sheet, label: "Excel / CSV" },
  { id: "manual", icon: PencilLine, label: "Lançamento manual" },
];

const STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  ready: "Pronto",
  delivered: "Entregue",
  approved: "Aprovado",
  failed: "Falha",
};

const MODE_LABEL: Record<string, string> = {
  SHADOW: "Shadow",
  ASSISTED: "Assistido",
  AUTONOMOUS: "Autônomo",
};

const GENERATING_STATUSES = new Set(["generating", "queued", "processing"]);

export default function Hub() {
  const { user } = useAuth();
  const { analyses, activeId, activeAnalysis, setActiveId, loading } = useAnalyses();
  const location = useLocation();
  const entryCount = (location.state as { entryCount?: number } | null)?.entryCount;
  const [hub, setHub] = useState<HubResponse | null>(null);
  const [hubLoading, setHubLoading] = useState(true);

  const isGenerating = activeAnalysis != null && GENERATING_STATUSES.has(activeAnalysis.status);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api.hub.get().then((data) => {
      if (!cancelled) setHub(data);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setHubLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);

  const latest = hub?.latestAnalysis;
  const userName = user?.name?.split(" ")[0] ?? "você";

  return (
    <div className="space-y-12">
      <header className="animate-fade-up">
        <div className="uppercase text-[11px] tracking-widest mb-4">
          Hub de análises · {user?.tenantId ?? "Sua empresa"}
        </div>
        <h1 className="text-[44px] leading-[1.05] tracking-tight max-w-2xl">
          {latest ? `Análise ${latest.referenceMonth}` : "Suas análises financeiras"}
        </h1>
        <p className="text-ink-soft dark:text-zinc-300 mt-3 text-[15px]">
          {loading
            ? "Carregando…"
            : analyses.length === 0
            ? "Importe dados ou faça lançamentos manuais para gerar sua primeira análise."
            : `${analyses.length} ${analyses.length === 1 ? "análise" : "análises"} disponíve${analyses.length === 1 ? "l" : "is"}.`}
        </p>
      </header>

      {analyses.length === 0 && !loading && <EmptyState userName={userName} />}

      {!hubLoading && latest?.dre && (
        <section className="animate-fade-up delay-1">
          <article className="bg-card border border-border rounded-lg shadow-card overflow-hidden">
            <div className="grid grid-cols-12">
              <div className="col-span-12 lg:col-span-8 p-10 border-b lg:border-b-0 lg:border-r border-border">
                <div className="flex items-center gap-2 mb-8">
                  <span className="uppercase text-[11px] tracking-widest">Período analisado</span>
                  <span className="h-px w-10 bg-border" />
                  <span className="text-[11px] text-[#96ff7e]">REF · {latest.referenceMonth}</span>
                </div>
                <div className="italic text-[18px] text-[#96ff7e] mb-4">
                  {latest.referenceMonth}
                </div>
                <div className="text-[88px] leading-none tracking-tight tabular font-sans">
                  {formatBRL(latest.dre.lucroLiquido)}
                </div>
                <div className="mt-5 flex items-center gap-3 text-[13px]">
                  <span className="text-[#96ff7e]">Lucro líquido · margem</span>
                  <span className={`font-medium ${latest.dre.margemLiquida >= 0 ? "text-positive" : "text-negative"}`}>
                    {latest.dre.margemLiquida.toFixed(1)}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 mt-10">
                  <Link
                    to="/dre"
                    className="group inline-flex items-center gap-2 bg-[#111164] text-cream px-5 py-3 rounded-md text-[13.5px] hover:bg-[#111164]/90 transition-colors"
                  >
                    Ver DRE completo
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <Link
                    to="/plano"
                    className="group inline-flex items-center gap-2 border border-[#96ff7e] px-5 py-3 rounded-md text-[13.5px] hover:bg-[#111164] hover:text-cream transition-colors"
                  >
                    Ver plano de ação
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
              <aside className="col-span-12 lg:col-span-4 p-10 bg-cream-deep/50 flex flex-col justify-between">
                <div>
                  <div className="uppercase text-[11px] tracking-widest mb-4">Composição do mês</div>
                  <ul className="space-y-4 text-[13px]">
                    <li className="flex justify-between items-baseline">
                      <span className="text-[#96ff7e]">Receita</span>
                      <span className="text-positive">{formatBRL(latest.dre.receitaBruta)}</span>
                    </li>
                    <li className="flex justify-between items-baseline">
                      <span className="text-[#96ff7e]">EBITDA</span>
                      <span className={latest.dre.ebitda >= 0 ? "text-positive" : "text-negative"}>
                        {formatBRL(latest.dre.ebitda)}
                      </span>
                    </li>
                    <li className="flex justify-between items-baseline pt-4 border-t border-border">
                      <span>Lucro líquido</span>
                      <span className="font-medium">{formatBRL(latest.dre.lucroLiquido)}</span>
                    </li>
                  </ul>
                </div>
                {latest.actionPlan && (
                  <p className="text-[12px] text-[#96ff7e] mt-8 leading-relaxed">
                    {latest.actionPlan.total} ações no plano · impacto estimado {formatBRL(latest.actionPlan.totalImpactCents / 100)}.
                  </p>
                )}
              </aside>
            </div>
          </article>
        </section>
      )}

      {isGenerating && (
        <section className="animate-fade-up delay-1">
          <PipelineProgress entryCount={entryCount} />
        </section>
      )}

      {analyses.length > 0 && (
        <section className="animate-fade-up delay-2">
          <div className="flex items-end justify-between mb-5">
            <h2 className="text-[26px] tracking-tight">Todas as análises</h2>
            <span className="text-[12px] text-[#96ff7e]">
              {analyses.length} {analyses.length === 1 ? "análise" : "análises"}
            </span>
          </div>
          <div className="border border-border rounded-lg bg-card overflow-hidden divide-y divide-border">
            {analyses.map((a) => {
              const isActive = a.id === activeId;
              return (
                <div
                  key={a.id}
                  className={`grid grid-cols-12 items-center gap-2 px-6 py-4 transition-colors ${
                    isActive ? "bg-cream-deep/60" : "hover:bg-cream-deep/40"
                  }`}
                >
                  <button
                    onClick={() => setActiveId(a.id)}
                    className="col-span-1 text-[11px] text-[#96ff7e] underline underline-offset-2 text-left"
                    title={isActive ? "Análise ativa" : "Tornar ativa"}
                  >
                    {isActive ? "ativa" : "selecionar"}
                  </button>
                  <div className="col-span-5">
                    <div className="text-[17px] leading-tight">{a.name}</div>
                    <div className="text-[11px] text-[#96ff7e] mt-0.5">{a.referenceMonth}</div>
                  </div>
                  <div className="col-span-3 flex gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border border-[#171132] dark:bg-[#15152f]">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border border-[#171132] dark:bg-[#15152f]">
                      {MODE_LABEL[a.mode] ?? a.mode}
                    </span>
                  </div>
                  <div className="col-span-3 text-right text-[12px] text-[#96ff7e]">
                    {a.deliveredAt ? new Date(a.deliveredAt).toLocaleDateString("pt-BR") : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="animate-fade-up delay-3">
        <div className="border border-border rounded-lg bg-card text-ink p-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-[24px] tracking-tight">Nova análise</h2>
              <p className="text-[13px] text-ink-soft mt-1">Escolha o formato dos dados e leve cerca de 2 minutos.</p>
            </div>
            <Link
              to="/importar"
              className="text-[12.5px] underline underline-offset-4 decoration-border hover:decoration-[#111164]"
            >
              Ver todos os métodos
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {inputMethods.map((m) => (
              <Link
                key={m.id}
                to={`/importar?method=${m.id}`}
                className="group flex items-center gap-3 p-4 rounded-md border border-border hover:border-[#96ff7e] hover:bg-cream-deep/40 transition-all"
              >
                <m.icon className="h-4 w-4 text-[#111164]" strokeWidth={1.6} />
                <span className="text-[13px]">{m.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ userName }: { userName: string }) {
  return (
    <section className="animate-fade-up delay-1 bg-card text-ink border border-border rounded-lg p-12 text-center">
      <Inbox className="h-10 w-10 mx-auto text-[#111164] mb-4" strokeWidth={1.4} />
      <h2 className="text-[28px] tracking-tight mb-2">Vamos começar, {userName}?</h2>
      <p className="text-[14px] text-ink-soft max-w-md mx-auto mb-6">
        Importe um extrato, cole uma planilha ou adicione lançamentos manuais para gerar sua primeira análise.
      </p>
      <Link
        to="/importar"
        className="inline-flex items-center gap-2 bg-[#111164] text-cream px-5 py-3 rounded-md text-[13.5px] hover:bg-[#111164]/90 transition-colors"
      >
        Trazer meus números
        <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
