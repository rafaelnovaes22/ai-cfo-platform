import { api } from "@/lib/api";
import { addCountryCode } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { PatternFormat } from "react-number-format";

interface NotificationConfigItem {
  phone?: string;
  enabled?: boolean;
}

type SaveStatus = { type: "idle" | "saving" | "success" | "error"; message?: string };

export default function NotificationsConfig() {
  const [values, setValues] = useState<NotificationConfigItem>({});
  const [, setLoading] = useState(true);
  const [status, setStatus] = useState<SaveStatus>({ type: "idle" });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.notificationConfig.get();
      setValues(items);
    } catch {
      setValues({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: "saving" });

    // Telefone informado precisa ser um número válido (E.164). Sem isto, um número
    // incompleto era enviado como undefined e ignorado em silêncio pelo backend.
    let phone: string | null = null;
    if (values?.phone) {
      const normalized = addCountryCode(values.phone);
      if (!normalized) {
        setStatus({ type: "error", message: "Número de telefone incompleto ou inválido." });
        return;
      }
      phone = normalized;
    }

    try {
      await api.notificationConfig.update({ phone, enabled: values?.enabled });
      setStatus({ type: "success", message: "Configurações salvas." });
      refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.";
      setStatus({ type: "error", message });
    }
  };

  const removeCountryCode = (phone: string) => {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 13 && digits.startsWith("55")) {
      return digits.substring(2);
    }
    return digits;
  };

  return (
    <div className="space-y-8 relative max-w-2xl">
      <header className="animate-fade-up flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl leading-[1.05] tracking-tight ">
            Configurações de usuário{" "}
          </h1>
        </div>
      </header>
      <div
        id="tabs"
        className="border-b-2 border-gray-200 dark:border-[#15152f] flex items-end"
      >
        {/* <Link
          to="/config/usuario"
          className="px-6 -mb-0.5 cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 pb-4"
        >
          Dados do usuário
        </Link> */}
        <span className="px-6 -mb-0.5 cursor-pointer text-gray-900 hover:text-gray-700 dark:text-white dark:hover:text-gray-200 border-b-2 border-[#3D24A0] hover:border-gray-300 dark:hover:border-gray-600 pb-4">
          Notificações
        </span>
      </div>
      <div className="animate-fade-up rounded-lg bg-popover dark:bg-[#15152f] p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              Configurações de WhatsApp
            </h2>
            <p className="text-sm text-black/50 dark:text-white/50">
              Defina o número de WhatsApp para envio de mensagens e autorize o
              envio.
            </p>
          </div>
          <form
            className="grid w-full items-center gap-4"
            onSubmit={handleSubmit}
          >
            <div className="grid w-full items-center gap-2">
              <label
                htmlFor="phone"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Número de WhatsApp
              </label>
              <PatternFormat
                type="text"
                value={removeCountryCode(values?.phone) || ""}
                onChange={(e) =>
                  setValues({ ...values, phone: e.target.value })
                }
                className="auth-input ! !bg-[#0b0918] !text-white !border !border-[#171132]"
                autoComplete="phone"
                format="(##) #####-####" // Máscara para números de 9 dígitos
                mask="_" // Opcional: exibe underscores enquanto digita
                placeholder="(99) 99999-9999"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enabled"
                checked={values?.enabled || false}
                onChange={(e) =>
                  setValues({ ...values, enabled: e.target.checked })
                }
                className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-ring"
              />
              <label
                htmlFor="enabled"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Autorizar envio de mensagens
              </label>
            </div>
            <button
              type="submit"
              disabled={status.type === "saving"}
              className="inline-flex mt-6 items-center justify-center rounded-md bg-[#3D24A0] px-4 py-2 text-sm font-medium text-white hover:bg-[#3D24A0]/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status.type === "saving" ? "Salvando..." : "Salvar configurações"}
            </button>
            {status.type === "success" && (
              <p className="text-sm text-green-500">{status.message}</p>
            )}
            {status.type === "error" && (
              <p className="text-sm text-red-500">{status.message}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
