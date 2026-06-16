import { useState, useRef, useEffect } from "react";
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
import { LIMITS, isAcceptedFile, formatBytes } from "@/lib/limits.js";
import { toast } from "sonner";
import ProcessingOverlay from "@/components/ProcessingOverlay";
import { useAnalyses } from "../data/useAnalyses";
import ImportLoading from "@/components/ImportLoading";

type Method = "paste" | "pdf" | "xls" | "manual" | null;

const cards: {
  id: Exclude<Method, null>;
  eyebrow: string;
  title: string;
  desc: string;
  icon: typeof ClipboardPaste;
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

function formatReferenceMonth(referenceMonth: string): string {
  const [year, month] = referenceMonth.split("-");
  if (!year || !month) return referenceMonth;
  return `${month}/${year}`;
}

function inferReferenceMonthFromSheet(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const counts = new Map<string, number>();

        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name];
          const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
            header: 1,
            defval: "",
          });

          for (const row of rows.slice(0, 2_000)) {
            for (const cell of row) {
              const month = monthFromCell(cell);
              if (month) counts.set(month, (counts.get(month) ?? 0) + 1);
            }
          }
        });

        const [month] =
          [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
        resolve(month ?? null);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function monthFromCell(cell: unknown): string | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return cell.toISOString().slice(0, 7);
  }

  const value = String(cell ?? "").trim();
  const iso = value.match(/^(\d{4})-(\d{2})-\d{2}/);
  if (iso?.[1] && iso[2]) return `${iso[1]}-${iso[2]}`;

  const br = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (br?.[2] && br[3]) return `${br[3]}-${br[2].padStart(2, "0")}`;

  return null;
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiProblem) return e.detail ?? e.title;
  if (e instanceof Error) return e.message;
  return "Erro desconhecido";
}

// ===== Paste modal =====
function PasteModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (entryCount: number, analysisId: string) => void;
}) {
  const [text, setText] = useState("");
  const [referenceMonth, setReferenceMonth] = useState(thisMonth());
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    if (!referenceMonth) {
      toast.error("Informe o mês de referência.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.ingest.clipboard({ referenceMonth, text });
      toast.success(
        `${result.entryCount} lançamentos importados (${result.outcome}).`
      );
      onImported(result.entryCount, result.analysisId);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Cole sua planilha">
      <p className="text-[13px] dark:text-[#96ff7e] mb-4">
        Copie qualquer formato — extrato, DRE, lançamentos. A IA identifica
        colunas e categoriza automaticamente.
      </p>
      <MonthField value={referenceMonth} onChange={setReferenceMonth} />
      <textarea
        value={text}
        maxLength={LIMITS.PASTE_MAX_CHARS}
        onChange={(e) => {
          // maxLength não cobre paste programático em todos os browsers — corta aqui também.
          const next = e.target.value;
          if (next.length > LIMITS.PASTE_MAX_CHARS) {
            toast.error(
              "Texto muito grande. Cole até 1 milhão de caracteres ou envie como arquivo."
            );
            setText(next.slice(0, LIMITS.PASTE_MAX_CHARS));
            return;
          }
          setText(next);
        }}
        disabled={submitting}
        className="w-full h-56 bg-cream-deep dark:bg-[#0b0918] text-ink dark:text-cream border border-[#171132] rounded-md p-4 text-[12.5px] resize-none focus:outline-none focus:border-[#96ff7e] mt-3"
        placeholder={
          "Data\tDescrição\tValor\n01/09/2026\tCliente Vértice MRR\t14.200,00\n02/09/2026\tMeta Ads\t-22.840,00\n..."
        }
      />
      <div className="flex items-center justify-end gap-2 mt-5">
        <div className="mr-auto">
          <ImportLoading show={submitting} />
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 text-[13px] dark:text-[#96ff7e] hover:"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] flex items-center gap-1.5 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando…
            </>
          ) : (
            <>
              Importar <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
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
  onImported: (entryCount: number, analysisId: string) => void;
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
    if (!referenceMonth) {
      toast.error("Informe o mês de referência.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.ingest.upload(file, referenceMonth);
      if (!result || result.outcome === "failed" || result.entryCount === 0) {
        toast.error(
          "Nenhum lançamento reconhecido. Verifique se o arquivo tem colunas de data, descrição e valor."
        );
        return;
      }
      toast.success(
        `${result.entryCount} lançamentos importados em ${formatReferenceMonth(result.referenceMonth)}.`
      );
      onImported(result.entryCount, result.analysisId);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFileChange(selected: File | null) {
    // Valida ANTES de aceitar: a UI promete "até 10 MB" e isso precisa ser real
    // (em prod um PDF de 10211 KB passava e só falhava depois do round-trip).
    if (selected && selected.size > LIMITS.FILE_MAX_BYTES) {
      toast.error(
        `Arquivo de ${formatBytes(selected.size)} excede o limite de ${formatBytes(LIMITS.FILE_MAX_BYTES)}.`
      );
      setFile(null);
      return;
    }
    if (selected && !isAcceptedFile(selected.name)) {
      toast.error(
        "Formato não suportado. Envie PDF, Excel (.xlsx/.xls) ou CSV."
      );
      setFile(null);
      return;
    }

    setFile(selected);
    if (!selected || kind !== "xls") return;

    try {
      const inferredMonth = await inferReferenceMonthFromSheet(selected);
      if (inferredMonth) setReferenceMonth(inferredMonth);
    } catch {
      // Mantem o mes selecionado manualmente se a planilha nao puder ser inspecionada no navegador.
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
            <CheckCircle2
              className="h-10 w-10 mx-auto text-positive mb-3"
              strokeWidth={1.4}
            />
            <h3 className="text-[20px] mb-1">{file.name}</h3>
            <p className="text-[12.5px] dark:text-[#96ff7e]">
              {(file.size / 1024).toFixed(0)} KB · clique para trocar
            </p>
          </>
        ) : (
          <>
            <UploadCloud
              className="h-10 w-10 mx-auto dark:text-[#96ff7e] mb-3"
              strokeWidth={1.4}
            />
            <h3 className="text-[20px] mb-1">Clique para selecionar</h3>
            <p className="text-[12.5px] dark:text-[#96ff7e]">{format}</p>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
      />
      <div className="flex justify-end gap-2 mt-5">
        <div className="mr-auto">
          <ImportLoading show={submitting} />
        </div>
        <button
          onClick={onClose}
          className="px-4 py-2 text-[13px] dark:text-[#96ff7e] hover:"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!file || submitting}
          className="bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] flex items-center gap-1.5 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importando…
            </>
          ) : (
            <>
              Importar <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </ModalShell>
  );
}

// ===== Manual entry =====
function ManualEntry({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (entryCount: number, analysisId: string) => void;
}) {
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
    else if (description.trim().length > LIMITS.DESCRIPTION_MAX_CHARS)
      errs.description = `Descrição até ${LIMITS.DESCRIPTION_MAX_CHARS} caracteres`;
    const numAmount = parseFloat(amount.replace(",", "."));
    if (
      !amount ||
      isNaN(numAmount) ||
      !Number.isFinite(numAmount) ||
      numAmount <= 0
    )
      errs.amount = "Valor inválido";
    else if (numAmount > LIMITS.AMOUNT_MAX_REAIS)
      errs.amount = `Valor máximo por lançamento: R$ ${LIMITS.AMOUNT_MAX_REAIS.toLocaleString("pt-BR")},00`;
    if (!referenceMonth) errs.referenceMonth = "Informe o mês";
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.ingest.manual({
        referenceMonth,
        entries: [
          {
            date,
            description: description.trim(),
            amount: numAmount,
            direction,
          },
        ],
      });
      toast.success(`Lançamento importado (${result.outcome}).`);
      onSaved(result.entryCount ?? 1, result.analysisId);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Lançamento manual">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <MonthField
          value={referenceMonth}
          onChange={setReferenceMonth}
          error={errors.referenceMonth}
        />
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
              onChange={(e) =>
                setDirection(e.target.value as "credit" | "debit")
              }
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
            maxLength={LIMITS.DESCRIPTION_MAX_CHARS}
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
            max={LIMITS.AMOUNT_MAX_REAIS}
            value={amount}
            onChange={(e) => {
              // type=number não respeita maxLength: sem este corte dava para
              // digitar uma fileira interminável de dígitos (visto em prod).
              if (e.target.value.length > 16) return;
              setAmount(e.target.value);
            }}
            placeholder="0,00"
            className="w-full dark:bg-[#0b0918] border dark:border-[#171132] rounded-md px-3 py-2 text-[13px]"
          />
        </Field>
        <div className="flex justify-end gap-2 mt-2">
          <div className="mr-auto">
            <ImportLoading show={submitting} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] dark:text-[#96ff7e]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
              </>
            ) : (
              "Adicionar lançamento"
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ===== Shared helpers =====
function MonthField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
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
    <label className="flex flex-col gap-1">
      <span className="text-[12px] dark:text-[#96ff7e]">{label}</span>
      {children}
      {error && <span className="text-[11.5px] text-red-500">{error}</span>}
    </label>
  );
}

function ModalShell({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 h-screen w-screen z-[500] !mt-0 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-[#111164]/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-cream dark:bg-[#0b0918] border dark:border-[#171132] rounded-lg shadow-[#0b0918] w-full max-w-2xl p-7 animate-fade-up max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="uppercase text-[11px] tracking-widest mb-1 text-ink-soft dark:text-cream/60">
              Importar dados
            </div>
            <h2 className="text-[24px] tracking-tight text-ink dark:text-cream">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-cream-deep"
          >
            <X className="h-4 w-4 dark:text-[#96ff7e]" />
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
  const { refresh, setActiveId } = useAnalyses();
  const initial = params.get("method") as Method;
  const [open, setOpen] = useState<Method>(initial);

  const handleImported = (entryCount: number, analysisId: string) => {
    setOpen(null);
    setActiveId(analysisId);
    void refresh();
    navigate("/", { state: { showAnalysisOverlay: true } });
  };

  return (
    <div className="space-y-10">
      <header className="animate-fade-up">
        <div className="uppercase text-[11px] tracking-widest mb-3">
          Importar dados
        </div>
        <h1 className="text-3xl leading-[1.05] tracking-tight max-w-xl">
          Como você quer trazer seus números?
        </h1>
        <p className="text-ink-soft dark:text-[#96ff7e] mt-3 text-[14px] max-w-lg">
          Seja via planilha ou fazendo lançamentos individuais, escolha a melhor
          forma de trazer seus dados.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-fade-up delay-1">
        {cards.map((c) => (
          <button
            key={c.id}
            onClick={() => setOpen(c.id)}
            className="group flex flex-col h-full text-left dark:bg-[#0b0918] border dark:border-[#171132] rounded-lg p-6 hover:border-[#96ff7e] hover:shadow-[#0b0918] transition-all"
          >
            <c.icon
              className="h-5 w-5 text-ink-soft dark:text-[#96ff7e] mb-5"
              strokeWidth={1.6}
            />
            <div className="uppercase text-[11px] tracking-widest mb-2 text-ink-soft dark:text-cream/60">
              {c.eyebrow}
            </div>
            <h3 className="text-[20px] leading-snug tracking-tight mb-2 text-ink dark:text-cream">
              {c.title}
            </h3>
            <p className="text-[12.5px] text-ink-soft dark:text-[#96ff7e] leading-relaxed flex-1">
              {c.desc}
            </p>
            <div className="mt-5 flex justify-end">
              <ArrowRight className="h-4 w-4 text-ink-soft dark:text-[#96ff7e] group-hover:translate-x-0.5 transition-all" />
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
