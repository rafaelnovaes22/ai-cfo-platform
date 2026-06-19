import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.tsx";

// Gate por feature DENTRO do app (diferente do SubscriberRoute, que barra o shell
// inteiro). Assinante vê o conteúdo real. Lead/free (logado, não assinante) vê um
// teaser bloqueado (upsell inline) no lugar, OU é redirecionado quando `redirectTo`
// é dado (ex: home de análise → /caixa). O grátis acessa o app; só o que é análise
// (DRE, plano, lançamentos) fica travado.
export function SubscriberGate({
  children,
  feature,
  redirectTo,
}: {
  children: React.ReactNode;
  feature?: string;
  redirectTo?: string;
}) {
  const { user } = useAuth();

  if (user?.isSubscriber) return <>{children}</>;
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return <LockedTeaser feature={feature} />;
}

function LockedTeaser({ feature }: { feature?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-[460px] text-center rounded-3xl border border-[#15152f] bg-[#171132]/80 p-10 text-white">
        <div className="text-4xl mb-4">🔒</div>
        <h1 className="text-[20px] font-medium mb-2">
          {feature ? `${feature} faz parte do plano pago` : "Recurso do plano pago"}
        </h1>
        <p className="text-[14px] opacity-80 mb-6">
          No plano gratuito você acompanha seu fluxo de caixa. A análise completa (DRE
          facilitado, leitura do mês e plano de ação) é gerada com IA e está disponível
          ao assinar.
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
  );
}
