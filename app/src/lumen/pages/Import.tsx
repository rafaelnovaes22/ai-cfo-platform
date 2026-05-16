import { useState, useEffect, useRef } from "react";
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
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import {
  useTransactions,
  type NewTransaction,
  type Transaction,
} from "../data/useTransactions";
import { TransactionModal } from "../components/TransactionModal";
import { useAnalyses } from "../data/useAnalyses";
import { categoriesFor, formatBRL } from "../data/categories";
import { toast } from "sonner";

type Method = "paste" | "pdf" | "xls" | "manual" | null;

const cards: {
  id: Exclude<Method, null>;
  eyebrow: string;
  title: string;
  desc: string;
  icon: any;
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

// ===== Helpers =====
async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = Array.from(bytes.subarray(i, i + chunk)) as number[];
    binary += String.fromCharCode.apply(null, slice);
  }
  return btoa(binary);
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

async function callParseImport(payload: any) {
  const { data, error } = await supabase.functions.invoke("parse-import", {
    body: payload,
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any)?.transactions as NewTransaction[];
}

// ===== Review modal (shared) =====
function ReviewList({
  items,
  onChange,
  onRemove,
}: {
  items: NewTransaction[];
  onChange: (i: number, patch: Partial<NewTransaction>) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="border border-[#171132] rounded-md max-h-[420px] overflow-auto">
      <table className="w-full text-[12.5px]">
        <thead className="sticky top-0 bg-cream-deep/80 backdrop-blur">
          <tr className="text-left">
            <th className="uppercase text-[11px] tracking-widest px-3 py-2">
              Data
            </th>
            <th className="uppercase text-[11px] tracking-widest px-3 py-2">
              Descrição
            </th>
            <th className="uppercase text-[11px] tracking-widest px-3 py-2">
              Categoria
            </th>
            <th className="uppercase text-[11px] tracking-widest px-3 py-2 text-right">
              Valor
            </th>
            <th className="uppercase text-[11px] tracking-widest px-3 py-2">
              Tipo
            </th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {items.map((t, i) => (
            <tr key={i} className="border-t border-[#171132]/60">
              <td className="px-2 py-1.5">
                <input
                  type="date"
                  value={t.date}
                  onChange={(e) => onChange(i, { date: e.target.value })}
                  className="bg-transparent border border-transparent hover:border-[#171132] focus:border-[#96ff7e] rounded px-1.5 py-1  text-[12px] w-full"
                />
              </td>
              <td className="px-2 py-1.5">
                <input
                  value={t.description}
                  onChange={(e) => onChange(i, { description: e.target.value })}
                  className="bg-transparent border border-transparent hover:border-[#171132] focus:border-[#96ff7e] rounded px-1.5 py-1 w-full"
                />
              </td>
              <td className="px-2 py-1.5">
                <select
                  value={t.category}
                  onChange={(e) => onChange(i, { category: e.target.value })}
                  className="bg-transparent border border-transparent hover:border-[#171132] focus:border-[#96ff7e] rounded px-1.5 py-1 text-[12px]"
                >
                  {categoriesFor(t.type).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-1.5 text-right">
                <input
                  type="number"
                  step="0.01"
                  value={t.amount}
                  onChange={(e) =>
                    onChange(i, { amount: Number(e.target.value) })
                  }
                  className="bg-transparent border border-transparent hover:border-[#171132] focus:border-[#96ff7e] rounded px-1.5 py-1  text-[12px] text-right w-24"
                />
              </td>
              <td className="px-2 py-1.5">
                <select
                  value={t.type}
                  onChange={(e) => {
                    const newType = e.target.value as "income" | "expense";
                    const allowed = categoriesFor(newType) as readonly string[];
                    const cat = allowed.includes(t.category)
                      ? t.category
                      : allowed[0];
                    onChange(i, { type: newType, category: cat });
                  }}
                  className={`rounded px-1.5 py-1 text-[12px] font-medium ${
                    t.type === "income" ? "text-positive" : "text-negative"
                  }`}
                >
                  <option value="income">Receita</option>
                  <option value="expense">Despesa</option>
                </select>
              </td>
              <td>
                <button
                  onClick={() => onRemove(i)}
                  className="p-1 text-[#96ff7e] hover:text-negative"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewSummary({ items }: { items: NewTransaction[] }) {
  const income = items
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const expense = items
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  return (
    <div className="grid grid-cols-3 gap-3 mb-3">
      <Stat label="Lançamentos" value={String(items.length)} />
      <Stat label="Receitas" value={formatBRL(income)} tone="text-positive" />
      <Stat label="Despesas" value={formatBRL(expense)} tone="text-negative" />
    </div>
  );
}
function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="border border-[#171132] rounded-md px-3 py-2">
      <div className="uppercase text-[11px] tracking-widest">{label}</div>
      <div className={` text-[14px] mt-0.5 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function suggestAnalysisName(items: NewTransaction[]): string {
  if (items.length === 0) return "Nova análise";
  const dates = items
    .map((t) => t.date)
    .filter(Boolean)
    .sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  const MONTHS = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  if (!first) return "Nova análise";
  const [y1, m1] = first.split("-");
  const [y2, m2] = last.split("-");
  if (first === last || (y1 === y2 && m1 === m2)) {
    return `Análise · ${MONTHS[Number(m1) - 1]}/${y1}`;
  }
  return `Análise · ${MONTHS[Number(m1) - 1]}/${y1.slice(2)} → ${
    MONTHS[Number(m2) - 1]
  }/${y2.slice(2)}`;
}

// ===== Paste modal =====
function PasteModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [items, setItems] = useState<NewTransaction[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [analysisName, setAnalysisName] = useState("");
  const { createMany } = useTransactions();
  const { create: createAnalysis } = useAnalyses();

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    try {
      const txs = await callParseImport({ mode: "text", text });
      if (!txs || txs.length === 0) {
        toast.error(
          "Nenhum lançamento identificado. Tente colar com mais contexto."
        );
      } else {
        const mapped = txs.map((t) => ({ ...t, source: "pasted" as const }));
        setItems(mapped);
        setAnalysisName(suggestAnalysisName(mapped));
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao processar texto");
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    if (!items) return;
    if (!analysisName.trim()) {
      toast.error("Dê um nome para a análise");
      return;
    }
    setSaving(true);
    try {
      const dates = items.map((t) => t.date).sort();
      const analysis = await createAnalysis({
        name: analysisName.trim(),
        period_start: dates[0] ?? null,
        period_end: dates[dates.length - 1] ?? null,
      });
      await createMany(items.map((t) => ({ ...t, analysis_id: analysis.id })));
      toast.success(`${items.length} lançamentos importados`);
      onImported();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      onClose={onClose}
      title={items ? "Revisar lançamentos" : "Cole sua planilha"}
    >
      {!items && (
        <>
          <p className="text-[13px] text-[#96ff7e] mb-4">
            Copie qualquer formato — extrato, DRE, lançamentos. A IA identifica
            colunas e categoriza automaticamente.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={parsing}
            className="w-full h-64 bg-background border border-[#171132] rounded-md p-4  text-[12.5px]  resize-none focus:outline-none focus:border-[#96ff7e]"
            placeholder={
              "Data\tDescrição\tValor\tConta\n01/09\tCliente Vértice MRR\t14200\tItaú PJ\n02/09\tMeta Ads\t-22840\tInter PJ\n..."
            }
          />
          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-[#96ff7e] hover:"
            >
              Cancelar
            </button>
            <button
              onClick={handleParse}
              disabled={parsing || !text.trim()}
              className="bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] flex items-center gap-1.5 disabled:opacity-50"
            >
              {parsing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando…
                </>
              ) : (
                <>
                  Analisar com IA <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </>
      )}
      {items && (
        <ReviewBlock
          items={items}
          setItems={setItems}
          onCancel={() => setItems(null)}
          onSave={handleSave}
          saving={saving}
          analysisName={analysisName}
          setAnalysisName={setAnalysisName}
        />
      )}
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
  const [parsing, setParsing] = useState(false);
  const [items, setItems] = useState<NewTransaction[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [analysisName, setAnalysisName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { createMany } = useTransactions();
  const { create: createAnalysis } = useAnalyses();

  async function handleParse() {
    if (!file) return;
    setParsing(true);
    try {
      let txs: NewTransaction[];
      if (kind === "pdf") {
        const b64 = await fileToBase64(file);
        txs = await callParseImport({
          mode: "file",
          fileBase64: b64,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
        });
      } else {
        const text = await sheetToText(file);
        txs = await callParseImport({ mode: "text", text });
      }
      if (!txs || txs.length === 0) {
        toast.error("Nenhum lançamento identificado no arquivo.");
      } else {
        const src: NewTransaction["source"] =
          kind === "pdf" ? "pdf" : "spreadsheet";
        const mapped = txs.map((t) => ({ ...t, source: src }));
        setItems(mapped);
        setAnalysisName(suggestAnalysisName(mapped));
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao processar arquivo");
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    if (!items) return;
    if (!analysisName.trim()) {
      toast.error("Dê um nome para a análise");
      return;
    }
    setSaving(true);
    try {
      const dates = items.map((t) => t.date).sort();
      const analysis = await createAnalysis({
        name: analysisName.trim(),
        period_start: dates[0] ?? null,
        period_end: dates[dates.length - 1] ?? null,
      });
      await createMany(items.map((t) => ({ ...t, analysis_id: analysis.id })));
      toast.success(`${items.length} lançamentos importados`);
      onImported();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title={items ? "Revisar lançamentos" : title}>
      {!items && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-[#171132] rounded-lg p-12 text-center bg-cream-deep/30 hover:border-[#96ff7e] transition-colors"
          >
            {file ? (
              <>
                <CheckCircle2
                  className="h-10 w-10 mx-auto text-positive mb-3"
                  strokeWidth={1.4}
                />
                <h3 className=" text-[20px]  mb-1">{file.name}</h3>
                <p className="text-[12.5px] text-[#96ff7e]">
                  {(file.size / 1024).toFixed(0)} KB · clique para trocar
                </p>
              </>
            ) : (
              <>
                <UploadCloud
                  className="h-10 w-10 mx-auto text-[#96ff7e] mb-3"
                  strokeWidth={1.4}
                />
                <h3 className=" text-[20px]  mb-1">Clique para selecionar</h3>
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
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] text-[#96ff7e] hover:"
            >
              Cancelar
            </button>
            <button
              onClick={handleParse}
              disabled={!file || parsing}
              className="bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] flex items-center gap-1.5 disabled:opacity-50"
            >
              {parsing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando…
                </>
              ) : (
                <>
                  Analisar com IA <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </>
      )}
      {items && (
        <ReviewBlock
          items={items}
          setItems={setItems}
          onCancel={() => setItems(null)}
          onSave={handleSave}
          saving={saving}
          analysisName={analysisName}
          setAnalysisName={setAnalysisName}
        />
      )}
    </ModalShell>
  );
}

function ReviewBlock({
  items,
  setItems,
  onCancel,
  onSave,
  saving,
  analysisName,
  setAnalysisName,
}: {
  items: NewTransaction[];
  setItems: (i: NewTransaction[]) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  analysisName: string;
  setAnalysisName: (v: string) => void;
}) {
  return (
    <>
      <p className="text-[13px] text-[#96ff7e] mb-4">
        Dê um nome para a análise e revise os lançamentos antes de salvar.
      </p>
      <div className="mb-4">
        <label className="block text-[12px] text-[#96ff7e] mb-1.5">
          Nome da análise
        </label>
        <input
          value={analysisName}
          onChange={(e) => setAnalysisName(e.target.value)}
          placeholder="Ex: Outubro 2025, Trimestre 3, Auditoria 2024…"
          className="w-full bg-background border border-[#171132] rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-[#96ff7e]"
        />
      </div>
      <ReviewSummary items={items} />
      <ReviewList
        items={items}
        onChange={(i, patch) => {
          const next = items.slice();
          next[i] = { ...next[i], ...patch } as NewTransaction;
          setItems(next);
        }}
        onRemove={(i) => setItems(items.filter((_, idx) => idx !== i))}
      />
      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-[13px] text-[#96ff7e] hover:"
        >
          Voltar
        </button>
        <button
          onClick={onSave}
          disabled={saving || items.length === 0}
          className="bg-[#111164] text-cream px-4 py-2 rounded-md text-[13px] flex items-center gap-1.5 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando…
            </>
          ) : (
            <>Importar {items.length} lançamentos</>
          )}
        </button>
      </div>
    </>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-[#111164]/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[#0b0918] border border-[#171132] rounded-lg shadow-[#0b0918] w-full max-w-3xl p-7 animate-fade-up max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="uppercase text-[11px] tracking-widest mb-1">
              Importar dados
            </div>
            <h2 className=" text-[24px] tracking-tight ">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-cream-deep"
          >
            <X className="h-4 w-4 text-[#96ff7e]" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Import() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initial = params.get("method") as Method;
  const [open, setOpen] = useState<Method>(initial);

  useEffect(() => {
    if (initial) setOpen(initial);
  }, [initial]);

  const handleImported = () => {
    setOpen(null);
    navigate("/");
  };

  return (
    <div className="space-y-10">
      <header className="animate-fade-up">
        <div className="uppercase text-[11px] tracking-widest mb-3">
          Importar dados
        </div>
        <h1 className=" text-3xl leading-[1.05] tracking-tight  max-w-xl">
          Como você quer trazer seus números?
        </h1>
        <p className="dark:text-[#96ff7e] mt-3 text-[14px] max-w-lg">
          Seja via planilha ou fazendo lançamentos individuais, escolha a melhor
          forma de trazer seus dados.
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 animate-fade-up delay-1">
        {cards.map((c) => (
          <MethodCard key={c.id} card={c} onClick={() => setOpen(c.id)} />
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

function ManualEntry({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { create } = useTransactions();
  const { activeId, create: createAnalysis } = useAnalyses();
  return (
    <TransactionModal
      open
      onClose={onClose}
      onSubmit={async (tx) => {
        let analysisId = activeId;
        if (!analysisId) {
          const a = await createAnalysis({
            name: "Lançamentos avulsos",
            description:
              "Análise criada automaticamente para receber lançamentos manuais.",
            period_start: tx.date,
            period_end: tx.date,
          });
          analysisId = a.id;
        }
        await create({ ...tx, analysis_id: analysisId });
        toast.success("Lançamento adicionado");
        onSaved();
      }}
    />
  );
}

function MethodCard({
  card,
  onClick,
}: {
  card: (typeof cards)[number];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col h-full text-left dark:bg-[#0b0918] border dark:border-[#171132] rounded-lg p-6 hover:border-[#96ff7e] hover:shadow-[#0b0918] transition-all"
    >
      <card.icon
        className="h-5 w-5 dark:text-[#96ff7e] mb-5"
        strokeWidth={1.6}
      />
      <div className="uppercase text-[11px] tracking-widest mb-2">
        {card.eyebrow}
      </div>
      <h3 className=" text-[20px] leading-snug tracking-tight  mb-2">
        {card.title}
      </h3>
      <p className="text-[12.5px] dark:text-[#96ff7e] leading-relaxed flex-1">
        {card.desc}
      </p>
      <div className="mt-5 flex justify-end">
        <ArrowRight className="h-4 w-4 dark:text-[#96ff7e] group-hover: group-hover:translate-x-0.5 transition-all" />
      </div>
    </button>
  );
}
