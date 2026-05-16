import { formatBRL } from "@/lumen/data/analytics";

export default function AccountsCard() {
  const bankAccounts = [
    {
      id: 1,
      bankName: "Itaú",
      accountNumber: "1234-5678-90",
      icon: "https://static.wikia.nocookie.net/mundo-das-marcas/images/c/c9/Itau2023.png/revision/latest/scale-to-width-down/250?cb=20240122212019&path-prefix=pt-br",
      amount: 3603.75,
    },
    {
      id: 2,
      bankName: "Nubank",
      accountNumber: "1234-5678-90",
      icon: "https://cdn.brandfetch.io/idXWQ2eElW/w/1079/h/1079/theme/dark/icon.png?c=1bxid64Mup7aczewSAYMX&t=1667571947369",
      amount: 7500.85,
    },
    {
      id: 3,
      bankName: "Bradesco",
      accountNumber: "1234-5678-90",
      icon: "https://cdn.brandfetch.io/domain/bradesco.com.br/fallback/lettermark/theme/dark/h/400/w/400/icon?c=1bfwsmEH20zzEfSNTed",
      amount: -2500,
    },
    {
      id: 4,
      bankName: "Banco do Brasil",
      accountNumber: "1234-5678-90",
      icon: "https://cdn.brandfetch.io/id07U7q9Is/w/200/h/200/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX&t=1772695974101",
      amount: 9875.24,
    },
  ];
  const hideAccountNumber = (accountNumber: string) => {
    const lastFourDigits = accountNumber.slice(-4);
    return `****-****-${lastFourDigits}`;
  };
  return (
    <article className="relative h-full grid grid-cols-12 pb-12">
      <div className="col-span-12 font-semibold">Contas bancárias</div>
      <div className="flex col-span-12 flex-col gap-2 items-start">
        {bankAccounts.map((account) => (
          <div
            key={account.id}
            className="w-full flex items-center justify-between py-2 rounded-lg"
          >
            <div className="flex items-center gap-4">
              <img
                src={account.icon}
                alt={account.bankName}
                className="w-8 h-8 bg-white rounded object-cover"
              />
              <div>
                <div className="text-sm text-gray-500">
                  {hideAccountNumber(account.accountNumber)}
                </div>
              </div>
            </div>
            <div
              className={`font-semibold ${
                account.amount >= 0 ? "text-[#29c89b]" : "text-[#ff9191]"
              }`}
            >
              {formatBRL(account.amount)}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
