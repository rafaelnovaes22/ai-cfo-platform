import { useEffect, useState } from "react";

// Conta de 0 até o alvo com ease-out. Com reduced-motion, devolve o alvo
// direto. Usado só na assinatura visual (numeral herói).
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || durationMs <= 0) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      setValue(target * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
