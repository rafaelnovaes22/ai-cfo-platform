import { useEffect, useRef, useState } from "react";
import { Check, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useAnalyses } from "../data/useAnalyses.tsx";

const STEPS = [
  { label: "Lançamentos importados" },
  { label: "Classificando categorias", sub: "IA identificando cada transação" },
  { label: "Gerando DRE", sub: "Montando demonstrativo de resultado" },
  { label: "Criando Plano de Ação", sub: "Recomendações 3-horizontes" },
];

// Tempo estimado (s) para avançar para cada passo (baseado em logs reais)
const STEP_DURATIONS = [0, 12, 25, 38];

export function PipelineProgress({ entryCount }: { entryCount?: number }) {
  const { activeAnalysis } = useAnalyses();
  const startRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const status = activeAnalysis?.status;
  const done = status === "completed" || status === "ready" || status === "delivered" || status === "approved";
  const failed = status === "failed";

  const currentStep = done
    ? STEPS.length
    : STEP_DURATIONS.findLastIndex((t) => elapsed >= t);

  if (!status || status === "pending") return null;

  return (
    <div className="rounded-xl border dark:border-[#96ff7e]/20 dark:bg-[#0d0d24] p-6 animate-fade-up">
      <div className="text-[11px] uppercase tracking-widest opacity-40 mb-5">
        {done ? "Análise concluída" : "Gerando análise"}
      </div>

      <div className="space-y-4">
        {STEPS.map((step, i) => {
          const stepDone = done || i < currentStep;
          const stepActive = !done && !failed && i === currentStep;
          return (
            <div key={i} className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  stepDone
                    ? "bg-emerald-500/20 text-emerald-400"
                    : stepActive
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-white/5 text-white/20"
                }`}
              >
                {stepDone ? (
                  <Check className="h-3 w-3" />
                ) : stepActive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="text-[10px]">{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[13px] leading-snug ${
                    !stepDone && !stepActive ? "opacity-25" : ""
                  }`}
                >
                  {step.label}
                  {i === 0 && entryCount != null ? (
                    <span className="opacity-50"> · {entryCount} lançamentos</span>
                  ) : null}
                </div>
                {stepActive && step.sub && (
                  <div className="text-[11px] opacity-40 mt-0.5">{step.sub}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {failed && (
        <div className="mt-5 flex items-center gap-2 text-[12.5px] text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          Ocorreu um erro na geração. Tente reimportar os dados.
        </div>
      )}

      {done && (
        <Link
          to="/dre"
          className="mt-6 w-full flex items-center justify-center gap-2 bg-[#111164] text-white rounded-lg py-2.5 text-[13px] hover:bg-[#1a1a80] transition-colors"
        >
          Ver análise completa <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
