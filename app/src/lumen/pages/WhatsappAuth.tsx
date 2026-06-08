import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { LumenLogo } from "../components/Logo.tsx";

type Status = "loading" | "success" | "error";

// Página do magic link: lê ?token=, vincula o número do WhatsApp à conta logada.
// Protegida por login (ProtectedRoute) — se não logado, vai pro /auth e volta com o token.
export default function WhatsappAuth() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Vinculando seu número...");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // evita chamada dupla no StrictMode
    ran.current = true;

    if (!token) {
      setStatus("error");
      setMessage("Link inválido: token ausente.");
      return;
    }

    api.whatsapp
      .link(token)
      .then(() => {
        setStatus("success");
        setMessage("Número vinculado! Volte ao WhatsApp e mande sua mensagem.");
      })
      .catch((err: unknown) => {
        setStatus("error");
        setMessage(
          err instanceof Error ? err.message : "Não foi possível vincular. Tente o link novamente.",
        );
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0b0918] flex items-center justify-center px-6">
      <div className="w-full max-w-[420px] text-center">
        <div className="flex justify-center mb-8">
          <LumenLogo size={48} className="brightness-[1000%]" />
        </div>
        <div className="bg-[#171132]/80 border border-[#15152f] text-white rounded-3xl p-10">
          {status === "loading" && (
            <p className="text-[15px] text-[#96ff7e] animate-pulse">{message}</p>
          )}
          {status === "success" && (
            <>
              <div className="text-4xl mb-4">✅</div>
              <h1 className="text-[18px] font-medium mb-2">Tudo certo!</h1>
              <p className="text-[14px] opacity-80">{message}</p>
            </>
          )}
          {status === "error" && (
            <>
              <div className="text-4xl mb-4">⚠️</div>
              <h1 className="text-[18px] font-medium mb-2">Não deu certo</h1>
              <p className="text-[14px] opacity-80">{message}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
