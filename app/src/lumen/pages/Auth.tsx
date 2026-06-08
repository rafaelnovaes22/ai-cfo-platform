import { useState, useEffect } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../auth/AuthContext.tsx";
import { LumenLogo } from "../components/Logo.tsx";
import { toast } from "@/components/ui/sonner";
import { ApiProblem } from "@/lib/api/client.js";
import { PatternFormat } from "react-number-format";
import { addCountryCode } from "@/lib/utils.ts";

const signUpSchema = z
  .object({
    tenantName: z.string().trim().min(2, "Informe o nome da empresa").max(100),
    name: z.string().trim().min(2, "Informe seu nome").max(100),
    phone: z
      .string()
      .transform((val) => val.replace(/\D/g, ""))
      .refine((val) => (val ? val.length === 11 : true), {
        message: "Telefone deve conter 11 dígitos (incluindo DDD)",
      })
      .optional(),
    email: z.string().trim().email("Email inválido").max(255),
    password: z.string().min(8, "Mínimo de 8 caracteres").max(72),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

const signInSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(1, "Informe a senha").max(72),
});

type Mode = "signin" | "signup" | "forgot";

export default function Auth() {
  const { user, loading, signIn, signUp, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Destino pós-login: a rota que o ProtectedRoute tentou acessar (state.from),
  // ou "/" como padrão. Antes ignorava o from e sempre ia para "/".
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";
  const [mode, setMode] = useState<Mode>("signin");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    tenantName: "",
    name: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setErrors({});
  }, [mode]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="text-[13px] text-[#96ff7e]">Carregando…</div>
      </div>
    );
  }

  if (user) return <Navigate to={from} replace />;

  const update =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) fieldErrors[String(i.path[0])] = i.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      await signUp(
        parsed.data.tenantName,
        parsed.data.name,
        addCountryCode(parsed.data?.phone),
        parsed.data.email,
        parsed.data.password
      );
      toast.success("Conta criada com sucesso!");
      navigate("/", { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiProblem
          ? (err.detail ?? err.title)
          : "Erro ao criar conta. Tente novamente.";
      if (
        msg.toLowerCase().includes("already") ||
        msg.toLowerCase().includes("existe")
      ) {
        toast.error("Este email já está cadastrado. Faça login.");
        setMode("signin");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signInSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) fieldErrors[String(i.path[0])] = i.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiProblem && err.status === 401
          ? "Email ou senha incorretos"
          : err instanceof ApiProblem
            ? (err.detail ?? err.title)
            : "Erro ao fazer login.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) {
      setErrors({ email: "Informe seu email" });
      return;
    }
    setSubmitting(true);
    try {
      await requestPasswordReset(form.email.trim());
    } finally {
      setSubmitting(false);
    }
    toast.success("Enviamos um link de recuperação pro seu email.");
    setMode("signin");
  };

  return (
    <div className="min-h-screen  bg-[url('https://images.unsplash.com/photo-1635776063043-ab23b4c226f6?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')] bg-cover flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex justify-center mb-10">
          <LumenLogo size={48} className="brightness-[1000%]" />
        </div>

        <div className="bg-[#171132]/80 border border-[#15152f] text-white rounded-3xl p-12">
          <h1 className="text-[20px] font-medium mb-1">
            {mode === "signin" && "Entrar"}
            {mode === "signup" && "Criar conta"}
            {mode === "forgot" && "Recuperar senha"}
          </h1>
          <p className="text-[13px] opacity-60 mb-6">
            {mode === "signin" && "Acesse sua conta pra continuar."}
            {mode === "signup" && "Leva menos de um minuto."}
            {mode === "forgot" &&
              "Te enviaremos um link pra redefinir sua senha."}
          </p>

          <form
            onSubmit={
              mode === "signin"
                ? handleSignIn
                : mode === "signup"
                  ? handleSignUp
                  : handleForgot
            }
            className="flex flex-col gap-3.5"
          >
            {mode === "signup" && (
              <>
                <Field label="Empresa" error={errors.tenantName}>
                  <input
                    type="text"
                    value={form.tenantName}
                    onChange={update("tenantName")}
                    className="auth-input ! !bg-[#0b0918] !text-white !border !border-[#171132]"
                    autoComplete="organization"
                    placeholder="Nome da sua empresa"
                  />
                </Field>
                <Field label="Nome" error={errors.name}>
                  <input
                    type="text"
                    value={form.name}
                    onChange={update("name")}
                    className="auth-input ! !bg-[#0b0918] !text-white !border !border-[#171132]"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Whatsapp" error={errors.phone}>
                  <PatternFormat
                    type="text"
                    value={form.phone || ""}
                    onChange={update("phone")}
                    className="auth-input ! !bg-[#0b0918] !text-white !border !border-[#171132]"
                    autoComplete="phone"
                    format="(##) #####-####" // Máscara para números de 9 dígitos
                    mask="_" // Opcional: exibe underscores enquanto digita
                    placeholder="(99) 99999-9999"
                    onValueChange={(e) =>
                      update("phone")({
                        target: { value: e.value },
                      } as React.ChangeEvent<HTMLInputElement>)
                    }
                  />
                </Field>
              </>
            )}

            <Field label="Email" error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={update("email")}
                className="auth-input ! !bg-[#0b0918] !text-white !border !border-[#171132]"
                autoComplete="email"
              />
            </Field>

            {mode !== "forgot" && (
              <Field label="Senha" error={errors.password}>
                <input
                  type="password"
                  value={form.password}
                  onChange={update("password")}
                  className="auth-input ! !bg-[#0b0918] !text-white !border !border-[#171132]"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                />
              </Field>
            )}

            {mode === "signup" && (
              <Field label="Confirme a senha" error={errors.confirmPassword}>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={update("confirmPassword")}
                  className="auth-input ! !bg-[#0b0918] !text-white !border !border-[#171132]"
                  autoComplete="new-password"
                />
              </Field>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 h-10 rounded-md bg-[#111164] text-cream text-[13.5px] font-medium hover:bg-[#111164]/90 transition-colors disabled:opacity-60"
            >
              {submitting
                ? "Aguarde…"
                : mode === "signin"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta"
                    : "Enviar link"}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-2 text-[12.5px] text-[#96ff7e] text-center">
            {mode === "signin" && (
              <>
                <button
                  onClick={() => setMode("forgot")}
                  className="hover: transition-colors"
                >
                  Esqueci minha senha
                </button>
                <div>
                  Não tem conta?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className=" underline-offset-2 hover:underline"
                  >
                    Criar conta
                  </button>
                </div>
              </>
            )}
            {mode === "signup" && (
              <div>
                Já tem conta?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className=" underline-offset-2 hover:underline"
                >
                  Entrar
                </button>
              </div>
            )}
            {mode === "forgot" && (
              <button
                onClick={() => setMode("signin")}
                className="hover: transition-colors"
              >
                Voltar pro login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] ">{label}</span>
      {children}
      {error && <span className="text-[11.5px] text-red-600">{error}</span>}
    </label>
  );
}
