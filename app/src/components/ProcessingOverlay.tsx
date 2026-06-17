import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export const catchphrases = [
  "Categorizando lançamentos...",
  "Calculando margens de lucro...",
  "Identificando oportunidades de economia...",
  "Projetando fluxo de caixa...",
  "Ajustando bússola financeira...",
  "Preparando dashboard de performance...",
];

export function ProcessingContent({
  className,
  title = "Analisando seus dados",
  showDots = true,
}: {
  className?: string;
  title?: string;
  showDots?: boolean;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % catchphrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${className}`}
    >
      <div className="relative mb-6">
        <Loader2 className="h-10 w-10 animate-spin text-[#111164] dark:text-[#96ff7e]" />
      </div>
      <div className="space-y-2 animate-fade-up min-w-[300px]">
        <h2 className="text-xl font-medium tracking-tight">{title}</h2>
        <p className="text-[14px] text-muted-foreground animate-pulse min-h-[1.5em]">
          {catchphrases[index]}
        </p>
      </div>

      {showDots && (
        <div className="mt-8 flex justify-center gap-1.5">
          {catchphrases.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === index
                  ? "w-8 bg-[#111164] dark:bg-[#96ff7e]"
                  : "w-2 bg-muted opacity-30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProcessingOverlay({
  title,
  showDots,
}: {
  title?: string;
  showDots?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-cream dark:bg-[#0b0918]">
      <ProcessingContent title={title} showDots={showDots} />
    </div>
  );
}
