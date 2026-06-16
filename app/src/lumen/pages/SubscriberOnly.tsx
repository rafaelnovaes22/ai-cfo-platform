import { useAuth } from "../auth/AuthContext.tsx";
import { LumenLogo } from "../components/Logo.tsx";

// Destino do lead logado (plan student/trial): a conta foi criada e os dados
// capturados, mas o painel é exclusivo de assinante. Não expõe o app.
export default function SubscriberOnly() {
  const { user, signOut } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="min-h-screen bg-[#0b0918] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[440px] text-center">
        <div className="flex justify-center mb-8">
          <LumenLogo size={48} className="brightness-[1000%]" />
        </div>
        <div className="bg-[#171132]/80 border border-[#15152f] text-white rounded-3xl p-10">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-[20px] font-medium mb-2">
            {firstName ? `${firstName}, sua conta está pronta` : "Sua conta está pronta"}
          </h1>
          <p className="text-[14px] opacity-80 mb-6">
            O painel completo do Aicfo é exclusivo para assinantes. Recebemos seus dados e,
            assim que sua assinatura estiver ativa, o acesso é liberado aqui.
          </p>
          <p className="text-[13px] opacity-60 mb-8">
            Enquanto isso, você pode continuar usando o Aicfo pelo WhatsApp para calcular
            seu fluxo de caixa.
          </p>
          <a
            href="https://wa.me/551153047368"
            target="_blank"
            rel="noopener noreferrer"
            className="block h-10 leading-10 rounded-md bg-[#111164] text-cream text-[13.5px] font-medium hover:bg-[#111164]/90 transition-colors mb-3"
          >
            Falar com o time
          </a>
          <button
            onClick={() => signOut()}
            className="text-[12.5px] text-[#96ff7e] underline-offset-2 hover:underline"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
