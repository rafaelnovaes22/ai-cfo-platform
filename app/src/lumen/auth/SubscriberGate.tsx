import { useAuth } from "./AuthContext.tsx";

// Gate por feature DENTRO do app (diferente do SubscriberRoute, que barra o shell
// inteiro). Assinante vê o conteúdo real. Lead/free (logado, não assinante) vê o
// conteúdo embaçado ao fundo com um card de upsell na frente (layout proposto pelo
// Edu). O grátis acessa o app; só as páginas de análise (DRE, plano, lançamentos)
// ficam travadas.
export function SubscriberGate({
  children,
  feature,
}: {
  children: React.ReactNode;
  feature?: string;
}) {
  const { user } = useAuth();

  if (user?.isSubscriber) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px] opacity-50" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center px-6 pt-20">
        <div className="w-full max-w-[460px] text-center rounded-3xl border border-[#15152f] bg-[#171132]/90 backdrop-blur-sm p-10 text-white shadow-2xl">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-[20px] font-medium mb-2">
            {feature ? `${feature} é exclusivo do plano pago` : "Recurso do plano pago"}
          </h1>
          <p className="text-[14px] opacity-80 mb-6">
            No plano gratuito você acompanha seu fluxo de caixa. A análise completa
            (DRE facilitado, leitura do mês e plano de ação) fica disponível ao assinar.
          </p>
          <a
            href="https://wa.me/551153047368"
            target="_blank"
            rel="noopener noreferrer"
            className="block h-10 leading-10 rounded-md bg-[#111164] text-cream text-[13.5px] font-medium hover:bg-[#111164]/90 transition-colors"
          >
            Liberar a análise completa
          </a>
        </div>
      </div>
    </div>
  );
}
