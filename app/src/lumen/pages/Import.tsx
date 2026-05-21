import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ClipboardPaste,
  FileText,
  Sheet,
  PencilLine,
  ArrowRight,
  X,
  UploadCloud,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api/index.js";
import { ApiProblem } from "@/lib/api/client.js";
import { toast } from "sonner";

type Method = "paste" | "pdf" | "xls" | "manual" | null;

const cards: {
  id: Exclude<Method, null>;
  eyebrow: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}[] = [
  {
    id: "paste",
    eyebrow: "Recomendado",
    title: "Cole sua planilha",
    desc: "Cole qualquer formato direto da sua planilha — categorizamos automaticamente.",
    icon: ClipboardPaste,
  },
  {
    id: "pdf",
    eyebrow: "Do contador",
    title: "DRE em PDF",
    desc: "Envie o relatório fechado pelo seu contador.",
    icon: FileText,
  },
  {
    id: "xls",
    eyebrow: "Estruturado",
    title: "Excel ou CSV",
    desc: "Planilhas exportadas do seu ERP ou banco.",
    icon: Sheet,
  },
  {
    id: "manual",
    eyebrow: "Manual",
    title: "Lançamento individual",
    desc: "Adicione uma receita ou despesa específica.",
    icon: PencilLine,
  },
];

function thisMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function sheetToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const parts: string[] = [];
        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name];
          const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
          parts.push(`--- Aba: ${name} ---\n${csv}`);
        });
        resolve(parts.join("\n\n"));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiProblem) return e.detail ?? e.title;
  if (e instanceof Error) return e.message;
  return "Erro desconhecido";
}

// ===== Paste modal =====
function PasteModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(thisMonth());
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    if (!referenceMonth) { toast.error("Informe o mês de referência."); return; }
    setSubmitting(true);
    try {
      const result = await api.ingest.clipboard({ referenceMonth, text });
      toast.success(`${result.entryCount} lançamentos importados (${result.outcome}).`);
      onImported();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Cole sua planilha">
      <p className="text-[13px] text-[#96ff7e] mb-4">
        Copie qualquer formato — extrato, DRE, lançamentos. A IA identifica colunas e categoriza automaticamente.
      </p>
      <MonthField value={referenceMonth} onChange={setReferenceMonth} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={submitting}
        className="w-full h-56 bg-background border border-[#171132] rounded-md p-4 text-[12.5px] resize-none focus:outline-none focus:border-[#96ff7e] mt-3"
        placeholder={"Data\tDescrição\tValor\n01/09\tCliente Vértice MRR\t14200\n02/09\tMeta Ads\t-22840\n..."}
      />
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#96ff7e] hover:">Cancelar</button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] flex items-center gap-1.5 disabled:opacity-50"
        >
          {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando…</> : <>Importar <ArrowRight className="h-3.5 w-3.5" /></>}
        </button>
      </div>
    </ModalShell>
  );
}

// ===== File modal (PDF / XLSX / CSV) =====
function FileModal({
  onClose,
  onImported,
  format,
  title,
  accept,
  kind,
}: {
  onClose: () => void;
  onImported: () => void;
  format: string;
  title: string;
  accept: string;
  kind: "pdf" | "xls";
}) {
  const [file, setFile] = useState<File | null>(null);
  const [referenceMonth, setReferenceMonth] = useState(thisMonth());
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit() {
    if (!file) return;
    if (!referenceMonth) { toast.error("Informe o mês de referência."); return; }
    setSubmitting(true);
    try {
      let result;
      if (kind === "pdf") {
        result = await api.ingest.upload(file, referenceMonth);
      } else {
        const text = await sheetToText(file);
        result = await api.ingest.clipboard({ referenceMonth, text });
      }
      toast.success(`${result?.entryCount ?? 0} lançamentos importados.`);
      onImported();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title={title}>
      <MonthField value={referenceMonth} onChange={setReferenceMonth} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full border-2 border-dashed border-[#171132] rounded-lg p-10 text-center bg-cream-deep/30 hover:border-[#96ff7e] transition-colors mt-3"
      >
        {file ? (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-positive mb-3" strokeWidth={1.4} />
            <h3 className="text-[20px] mb-1">{file.name}</h3>
            <p className="text-[12.5px] text-[#96ff7e]">{(file.size / 1024).toFixed(0)} KB · clique para trocar</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-10 w-10 mx-auto text-[#96ff7e] mb-3" strokeWidth={1.4} />
            <h3 className="text-[20px] mb-1">Clique para selecionar</h3>
            <p className="text-[12.5px] text-[#96ff7e]">{format}</p>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 text-[13px] text-[#96ff7e] hover:">Cancelar</button>
        <button
          onClick={handleSubmit}
          disabled={!file || submitting}
          className="bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] flex items-center gap-1.5 disabled:opacity-50"
        >
          {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando…</> : <>Importar <ArrowRight className="h-3.5 w-3.5" /></>}
        </button>
      </div>
    </ModalShell>
  );
}

// ===== Manual entry =====
function ManualEntry({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [referenceMonth, setReferenceMonth] = useState(thisMonth());
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("debit");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!date) errs.date = "Informe a data";
    if (!description.trim()) errs.description = "Informe a descrição";
    const numAmount = parseFloat(amount.replace(",", "."));
    if (!amount || isNaN(numAmount) || numAmount <= 0) errs.amount = "Valor inválido";
    if (!referenceMonth) errs.referenceMonth = "Informe o mês";
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const result = await api.ingest.manual({
        referenceMonth,
        entries: [{ date, description: description.trim(), amount: numAmount, direction }],
      });
      toast.success(`Lançamento importado (${result.outcome}).`);
      onSaved();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Lançamento manual">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <MonthField value={referenceMonth} onChange={setReferenceMonth} error={errors.referenceMonth} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" error={errors.date}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full dark:bg-[#0b0918] border dark:border-[#171132] rounded-md px-3 py-2 text-[13px]"
            />
          </Field>
          <Field label="Tipo" error={undefined}>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "credit" | "debit")}
              className="w-full dark:bg-[#0b0918] border dark:border-[#171132] rounded-md px-3 py-2 text-[13px]"
            >
              <option value="credit">Receita (entrada)</option>
              <option value="debit">Despesa (saída)</option>
            </select>
          </Field>
        </div>
        <Field label="Descrição" error={errors.description}>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Contrato cliente Alfa, Meta Ads setembro…"
            className="w-full dark:bg-[#0b0918] border dark:border-[#171132] rounded-md px-3 py-2 text-[13px]"
          />
        </Field>
        <Field label="Valor (R$)" error={errors.amount}>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0,00"
            className="w-full dark:bg-[#0b0918] border dark:border-[#171132] rounded-md px-3 py-2 text-[13px]"
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] text-[#96ff7e]">Cancelar</button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…</> : "Adicionar lançamento"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ===== Shared helpers =====
function MonthField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <Field label="Mês de referência" error={error}>
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="dark:bg-[#0b0918] border dark:border-[#171132] rounded-md px-3 py-2 text-[13px] w-full"
      />
    </Field>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-[#96ff7e]">{label}</span>
      {children}
      {error && <span className="text-[11.5px] text-red-500">{error}</span>}
    </label>
  );
}

function ModalShell({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[#111164]/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0b0918] border border-[#171132] rounded-lg shadow-[#0b0918] w-full max-w-2xl p-7 animate-fade-up max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="uppercase text-[11px] tracking-widest mb-1">Importar dados</div>
            <h2 className="text-[24px] tracking-tight">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-cream-deep">
            <X className="h-4 w-4 text-[#96ff7e]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ===== Main page =====
export default function Import() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initial = params.get("method") as Method;
  const [open, setOpen] = useState<Method>(initial);

  const handleImported = () => {
    setOpen(null);
    navigate("/");
  };

  return (
    <div className="space-y-10">
      <header className="animate-fade-up">
        <div className="uppercase text-[11px] tracking-widest mb-3">Importar dados</div>
        <h1 className="text-3xl leading-[1.05] tracking-tight max-w-xl">
          Como você quer trazer seus números?
        </h1>
        <p className="dark:text-[#96ff7e] mt-3 text-[14px] max-w-lg">
          Seja via planilha ou fazendo lançamentos individuais, escolha a melhor forma de trazer seus dados.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-fade-up delay-1">
        {cards.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpen(c.id)}
            className="group flex flex-col h-full text-left dark:bg-[#0b0918] border dark:border-[#171132] rounded-lg p-6 hover:border-[#96ff7e] hover:shadow-[#0b0918] transition-all"
          >
            <c.icon className="h-5 w-5 dark:text-[#96ff7e] mb-5" strokeWidth={1.6} />
            <div className="uppercase text-[11px] tracking-widest mb-2">{c.eyebrow}</div>
            <h3 className="text-[20px] leading-snug tracking-tight mb-2">{c.title}</h3>
            <p className="text-[12.5px] dark:text-[#96ff7e] leading-relaxed flex-1">{c.desc}</p>
            <div className="mt-5 flex justify-end">
              <ArrowRight className="h-4 w-4 dark:text-[#96ff7e] group-hover:translate-x-0.5 transition-all" />
            </div>
          </button>
        ))}
      </section>

      {open === "paste" && (
        <PasteModal onClose={() => setOpen(null)} onImported={handleImported} />
      )}
      {open === "pdf" && (
        <FileModal
          onClose={() => setOpen(null)}
          onImported={handleImported}
          format="Arquivos .pdf até 10 MB"
          title="Importar DRE em PDF"
          accept="application/pdf"
          kind="pdf"
        />
      )}
      {open === "xls" && (
        <FileModal
          onClose={() => setOpen(null)}
          onImported={handleImported}
          format="Arquivos .xlsx ou .csv até 10 MB"
          title="Importar Excel ou CSV"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          kind="xls"
        />
      )}
      {open === "manual" && (
        <ManualEntry onClose={() => setOpen(null)} onSaved={handleImported} />
      )}
    </div>
  );
}
