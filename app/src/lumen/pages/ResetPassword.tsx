import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api/index.js";
import { ApiProblem } from "@/lib/api/client.js";
import { LumenLogo } from "../components/Logo.tsx";
import { toast } from "@/components/ui/sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (!token) {
      toast.error("Link de recuperação inválido ou expirado.");
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.confirmPasswordReset(token, password);
      toast.success("Senha atualizada com sucesso.");
      navigate("/auth", { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiProblem
          ? (err.detail ?? err.title)
          : "Erro ao atualizar senha.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex justify-center mb-10">
          <LumenLogo size={32} />
        </div>
        <div className="bg-card border border-border rounded-lg p-8">
          <h1 className="text-[20px] font-medium  mb-1">Redefinir senha</h1>
          <p className="text-[13px] text-[#96ff7e] mb-6">
            Escolha uma nova senha pra sua conta.
          </p>

          {!token ? (
            <div className="text-[13px] text-red-500">
              Link inválido ou expirado. Solicite um novo link de recuperação.
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] text-[#96ff7e]">Nova senha</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="auth-input"
                  autoComplete="new-password"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] text-[#96ff7e]">Confirme a senha</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="auth-input"
                  autoComplete="new-password"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="mt-2 h-10 rounded-md bg-[#111164] text-cream text-[13.5px] font-medium hover:bg-[#111164]/90 transition-colors disabled:opacity-60"
              >
                {submitting ? "Aguarde…" : "Atualizar senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
