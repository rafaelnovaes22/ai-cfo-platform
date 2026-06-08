import { Link } from "react-router-dom";

export default function NotificationsConfig() {
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
        <Link
          to="/config/usuario"
          className="px-6 -mb-0.5 cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 pb-4"
        >
          Dados do usuário
        </Link>
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
          <form className="grid w-full items-center gap-4">
            <div className="grid w-full items-center gap-2">
              <label
                htmlFor="whatsapp"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Número de WhatsApp
              </label>
              <input
                type="tel"
                id="whatsapp"
                placeholder="Digite seu número de WhatsApp"
                className="flex h-10 w-full rounded-md bg-input dark:bg-[#0b0918] px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-black/50 dark:placeholder:text-white/30 dark:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="authorize"
                className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-ring"
              />
              <label
                htmlFor="authorize"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Autorizar envio de mensagens
              </label>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
