import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LumenLogo } from "../components/Logo.tsx";
import { toast } from "@/components/ui/sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash and creates a session automatically
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")
        setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

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
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada com sucesso.");
    navigate("/", { replace: true });
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

          {!ready ? (
            <div className="text-[13px] text-[#96ff7e]">Validando link…</div>
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
                <span className="text-[12px] text-[#96ff7e]">
                  Confirme a senha
                </span>
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
