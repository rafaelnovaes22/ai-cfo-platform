import { formatBRL } from "@/lumen/data/categories";

const payments = [
  {
    id: 1,
    account: "Luz",
    dueDate: "2024-07-10",
    amount: 150.0,
    expectedBalance: 850.0,
  },
  {
    id: 2,
    account: "Aluguel",
    dueDate: "2024-07-05",
    amount: 1200.0,
    expectedBalance: -350.0,
  },
  {
    id: 3,
    account: "Internet",
    dueDate: "2024-07-15",
    amount: 100.0,
    expectedBalance: 1450.0,
  },
  {
    id: 4,
    account: "Telefone",
    dueDate: "2024-07-20",
    amount: 80.0,
    expectedBalance: -570.0,
  },
  {
    id: 5,
    account: "Internet",
    dueDate: "2024-07-15",
    amount: 100.0,
    expectedBalance: -450.0,
  },
  {
    id: 6,
    account: "Telefone",
    dueDate: "2024-07-20",
    amount: 80.0,
    expectedBalance: 2570.0,
  },
];

const formatDate = (dateString: string) => {
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
  };
  return new Date(dateString).toLocaleDateString("pt-BR", options);
};

export default function PaymentsCard() {
  return (
    <article className="relative h-full grid grid-cols-12 pb-12">
      <div className="col-span-12">
        <div className="font-semibold mb-8">Contas a pagar</div>
      </div>
      <div className="text-sm col-span-12 grid grid-cols-12 gap-2">
        <div className="col-span-12 grid grid-cols-12 gap-2 border-b border-[#15152f] pb-2 mb-2">
          <div className="col-span-4 md:col-span-6 font-semibold">Conta</div>
          <div className="hidden md:block col-span-2 text-center font-semibold">
            Vencimento
          </div>
          <div className="col-span-4 md:col-span-2 text-end font-semibold">
            Valor
          </div>
          <div className="col-span-4 md:col-span-2 text-end font-semibold">
            Saldo Previsto
          </div>
        </div>
        {payments.map((payment) => (
          <div key={payment.id} className="col-span-12 grid grid-cols-12 gap-2">
            <div className="col-span-4 md:col-span-6">
              {payment.account}{" "}
              <div className="block md:hidden opacity-30">
                {formatDate(payment.dueDate)}
              </div>
            </div>
            <div className="hidden md:block col-span-2 text-center">
              {formatDate(payment.dueDate)}
            </div>
            <div className={`col-span-4 md:col-span-2 text-end text-[#ff9191]`}>
              -{formatBRL(payment.amount)}
            </div>
            <div
              className={`col-span-4 md:col-span-2 text-end ${
                payment.expectedBalance >= 0
                  ? "text-[#29c89b]"
                  : "text-[#ff9191]"
              }`}
            >
              {formatBRL(payment.expectedBalance)}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
