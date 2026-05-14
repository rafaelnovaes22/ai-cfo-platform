import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { z } from "zod";
import { categoriesFor } from "../data/categories.ts";
import type { Transaction, NewTransaction } from "../data/useTransactions.ts";
import { toast } from "@/components/ui/sonner";

const schema = z.object({
  date: z.string().min(1, "Informe a data"),
  description: z.string().trim().min(1, "Informe a descrição").max(200),
  category: z.string().min(1, "Escolha uma categoria"),
  account: z.string().trim().min(1, "Informe a conta").max(80),
  amount: z.number().positive("Valor deve ser maior que zero").max(99999999.99),
  type: z.enum(["income", "expense"]),
  notes: z.string().max(500).optional().nullable(),
});

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (tx: NewTransaction) => Promise<void>;
  initial?: Transaction;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionModal({ open, onClose, onSubmit, initial }: Props) {
  const [type, setType] = useState<"income" | "expense">(
    initial?.type ?? "expense"
  );
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [account, setAccount] = useState(initial?.account ?? "Principal");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(initial?.type ?? "expense");
    setDate(initial?.date ?? todayISO());
    setDescription(initial?.description ?? "");
    setCategory(initial?.category ?? "");
    setAccount(initial?.account ?? "Principal");
    setAmount(initial?.amount?.toString() ?? "");
    setNotes(initial?.notes ?? "");
    setErrors({});
  }, [open, initial]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(",", "."));
    const parsed = schema.safeParse({
      date,
      description,
      category,
      account,
      amount: isNaN(numAmount) ? 0 : numAmount,
      type,
      notes: notes || null,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) fe[String(i.path[0])] = i.message;
      });
      setErrors(fe);
      return;
    }
    setSubmitting(true);
    try {
      const d = parsed.data;
      await onSubmit({
        date: d.date,
        description: d.description,
        category: d.category,
        account: d.account,
        amount: d.amount,
        type: d.type,
        notes: d.notes ?? null,
        source: initial?.source ?? "manual",
      });
      toast.success(initial ? "Lançamento atualizado." : "Lançamento criado.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = categoriesFor(type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#111164]/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] bg-card border border-border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-[15px] font-medium ">
            {initial ? "Editar lançamento" : "Novo lançamento"}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-cream-deep">
            <X className="h-4 w-4 text-[#96ff7e]" />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-cream-deep rounded-md">
            <button
              type="button"
              onClick={() => {
                setType("expense");
                setCategory("");
              }}
              className={`py-1.5 rounded text-[12.5px] transition-colors ${
                type === "expense"
                  ? "bg-card  shadow-sm"
                  : "text-[#96ff7e] hover:"
              }`}
            >
              Despesa
            </button>
            <button
              type="button"
              onClick={() => {
                setType("income");
                setCategory("");
              }}
              className={`py-1.5 rounded text-[12.5px] transition-colors ${
                type === "income"
                  ? "bg-card  shadow-sm"
                  : "text-[#96ff7e] hover:"
              }`}
            >
              Receita
            </button>
          </div>

          <Field label="Descrição" error={errors.description}>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="auth-input"
              placeholder="Ex: Pagamento cliente Acme"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" error={errors.date}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="auth-input"
              />
            </Field>
            <Field label="Valor (R$)" error={errors.amount}>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="auth-input font-mono"
                placeholder="0,00"
              />
            </Field>
          </div>

          <Field label="Categoria" error={errors.category}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="auth-input"
            >
              <option value="">Selecione…</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Conta" error={errors.account}>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="auth-input"
              placeholder="Ex: Itaú PJ, Nubank, Caixa"
            />
          </Field>

          <Field label="Observações (opcional)">
            <textarea
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              className="auth-input min-h-[68px] py-2 resize-none"
              maxLength={500}
            />
          </Field>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-md text-[13px] text-[#96ff7e] hover: hover:bg-cream-deep transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 h-9 rounded-md bg-[#111164] text-cream text-[13px] font-medium hover:bg-[#111164]/90 transition-colors disabled:opacity-60"
            >
              {submitting ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
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
      <span className="text-[12px] text-[#96ff7e]">{label}</span>
      {children}
      {error && <span className="text-[11.5px] text-red-600">{error}</span>}
    </label>
  );
}
