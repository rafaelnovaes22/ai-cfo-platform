import { formatBRL } from "@/lumen/data/analytics";

export default function LoanTable() {
  const demoData = {
    loans: [
      {
        id: 1,
        name: "Troca de 8 dívidas",
        startDate: "Outubro/2025",
        totalAmount: 100000,
        totalSavings: 18000,
        amountPerInstallment: 3125,
        remainingAmount: 80000,
        installments: 48,
        currentInstallment: 8,
        interestRate: 0.7,
      },
      {
        id: 2,
        name: "Pré-aprovado",
        startDate: "Janeiro/2023",
        totalAmount: 56000,
        totalSavings: 2700,
        amountPerInstallment: 1200,
        remainingAmount: 7400,
        installments: 64,
        currentInstallment: 48,
        interestRate: 0.82,
      },
    ],
  };

  return (
    <>
      <div className="flex items-end justify-between mb-2">
        <h2 className="font-semibold mb-4">
          Crédito tomado ({demoData.loans.length})
        </h2>
      </div>
      <div className="w-full overflow-auto">
        <div className="min-w-[1400px] w-full -mx-6 overflow-hidden divide-y dark:divide-[#0b0918]/50">
          <div
            className={`grid grid-cols-12 items-center gap-2 px-6 py-4 transition-colors`}
          >
            <span className="col-span-2 font-semibold">ID</span>
            <span className="col-span-1 text-end">Data inicial</span>
            <span className="col-span-2 text-end">Valor tomado</span>
            <span className="col-span-2 text-end">Saldo devedor</span>
            <span className="col-span-1 text-end">Parcelas</span>
            <span className="col-span-1 text-end">Próxima parcela</span>
            <span className="col-span-1 text-end">Taxa de juros</span>
            <span className="col-span-2 text-end">Economia total</span>
          </div>
          {demoData.loans.map((a) => {
            const s = { income: 0, expense: 0, count: 0 };
            const net = s.income - s.expense;
            const margin = s.income > 0 ? (net / s.income) * 100 : 0;
            return (
              <div
                key={a.id}
                className={`grid grid-cols-12 items-center gap-2 px-6 py-4 transition-colors`}
              >
                <span className="col-span-2 font-semibold">{a.name}</span>
                <span className="col-span-1 text-end">{a.startDate}</span>
                <span className="col-span-2 text-end">
                  {formatBRL(a.totalAmount)}
                </span>
                <span className="col-span-2 text-end">
                  {formatBRL(a.remainingAmount)}
                </span>
                <span className="col-span-1 text-end">
                  {a.currentInstallment}/{a.installments}
                </span>
                <span className="col-span-1 text-end">
                  {formatBRL(a.amountPerInstallment)}
                </span>
                <span className="col-span-1 text-end">
                  {a.interestRate}%/mês
                </span>
                <span className="col-span-2 text-end">
                  {formatBRL(a.totalSavings)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
