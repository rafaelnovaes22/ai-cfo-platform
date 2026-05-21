import { Loader, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const phrases = [
  "Fazendo upload dos dados financeiros...",
  "Analisando os dados importados...",
  "Rodando modelos financeiros avançados...",
  "Preparando insights personalizados para você...",
  "Otimizando suas finanças com inteligência artificial...",
];

export default function ImportLoading({ show }: { show: boolean }) {
  const getPhraseInOrder = (index: number) => {
    return phrases[index % phrases.length];
  };

  const [set, setSet] = useState(getPhraseInOrder(0));

  useEffect(() => {
    // change phrase every 5 seconds
    const interval = setInterval(() => {
      setSet((prev) => {
        const currentIndex = phrases.indexOf(prev);
        return getPhraseInOrder(currentIndex + 1);
      });
      console.log("Changing phrase to:", set);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (!show) return null;

  return (
    <div className="animate-pulse text-sm mt-2 flex items-center gap-2 text-muted-foreground">
      <Loader2 className="animate-spin w-4 h-4" /> {set}
    </div>
  );
}
