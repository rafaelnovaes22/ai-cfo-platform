import { useState, useMemo } from "react";
import {
  ChevronRight,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTransactions } from "../data/useTransactions";
import { useAnalyses } from "../data/useAnalyses.ts";
import { AnalysisPicker } from "../components/AnalysisPicker.tsx";
import {
  buildDRE,
  buildInsights,
  listMonthKeys,
  monthLabel,
  monthShortLabel,
  formatBRL,
  formatPct,
  type DRELine,
  type Insight,
} from "../data/analytics";

type View = "value" | "pct" | "vs";

function toneFor(type: DRELine["type"]) {
  switch (type) {
    case "income":
      return { bar: "bg-[#29c89b]/70", text: "text-[#29c89b]", marker: "+" };
    case "cost":
      return { bar: "bg-[#ff9191]/60", text: "text-[#ff9191]", marker: "−" };
    case "expense":
      return { bar: "bg-[#ffc66e]/70", text: "text-[#ff9191]", marker: "−" };
    case "subtotal":
      return { bar: "bg-[#5a5a7e]/30", text: "", marker: "=" };
    case "result":
      return { bar: "bg-[#5a5a7e]", text: "text-cream", marker: "=" };
  }
}

function Bar({ share, type }: { share: number; type: DRELine["type"] }) {
  const tone = toneFor(type);
  const pct = Math.min(Math.max(share, 0), 1) * 100;
  return (
    <div className="h-1.5 w-full bg-gray-300 dark:bg-[#15152f] rounded-full overflow-hidden">
      <div
        className={`h-full ${tone.bar} rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Row({
  line,
  view,
  depth = 0,
}: {
  line: DRELine;
  view: View;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const tone = toneFor(line.type);
  const hasChildren = !!line.children?.length;
  const isResult = line.type === "result";
  const isSubtotal = line.type === "subtotal";

  if (isResult) {
    return (
      <div className="bg-gray-200 dark:bg-[#15152f] -mx-6 px-12 py-7 mt-2 -mb-2">
        <div className="flex flex-col items-end">
          <div className="col-span-5  text-[24px] tracking-tight">
            {line.label}
          </div>
          <div className="col-span-3" />
          <div className="col-span-3 text-right text-3xl leading-none tabular font-sans">
            {formatBRL(line.value)}
          </div>
          <div className="flex gap-4 mt-4">
            <span>Margem líquida</span>
            <span className="">{formatPct(line.share)}</span>
          </div>
        </div>
      </div>
    );
  }

  const valueDisplay =
    view === "value"
      ? formatBRL(line.value)
      : view === "pct"
      ? formatPct(line.share)
      : line.vsLast !== undefined
      ? formatPct(line.vsLast / 100, true)
      : "—";

  return (
    <>
      <div
        onClick={() => hasChildren && setOpen(!open)}
        className={`relative grid grid-cols-12 items-center gap-4 py-3.5 group transition-colors pb-6 md:pb-3.5 ${
          hasChildren ? "cursor-pointer hover:bg-cream-deep/40" : ""
        } ${
          isSubtotal
            ? "border-t dark:border-[#15152f] bg-cream-deep/30"
            : "border-t dark:border-[#15152f]/60"
        }`}
        style={{ paddingLeft: depth * 24 + 16, paddingRight: 16 }}
      >
        <div className="col-span-1 flex items-center gap-1.5">
          {hasChildren && (
            <ChevronRight
              className={`h-3 w-3 text-[#96ff7e] transition-transform ${
                open ? "rotate-90" : ""
              }`}
            />
          )}
          <span className={` text-[12px] ${tone.text}`}>{tone.marker}</span>
        </div>
        <div
          className={`col-span-5 text-[13.5px] ${
            isSubtotal ? "font-medium " : ""
          }`}
        >
          {line.label}
        </div>
        <div className="col-span-4 md:col-span-2  text-[13px]  tabular text-right pr-2">
          {formatBRL(line.value)}
        </div>
        <div className="col-span-2 absolute bottom-2 left-0 right-0 px-2 md:static">
          <Bar share={line.share} type={line.type} />
        </div>
        <div
          className={`col-span-2 text-right  text-[12.5px] tabular font-semibold ${tone.text}`}
        >
          {valueDisplay}
        </div>
      </div>
      {open &&
        line.children?.map((c) => (
          <Row key={c.key} line={c} view={view} depth={depth + 1} />
        ))}
    </>
  );
}

function InsightCard({ ins }: { ins: Insight }) {
  const conf = {
    critical: {
      Icon: AlertOctagon,
      chip: "bg-[#441616]-soft text-[#ff9191]",
      border: "border-[#a64c4c]",
    },
    warning: {
      Icon: AlertTriangle,
      chip: "bg-[#493210] text-[#d19130] dark:text-[#ffc66e]",
      border: "border-[#9c7335]",
    },
    healthy: {
      Icon: CheckCircle2,
      chip: "bg-[#08382a] text-[#29c89b]",
      border: "border-[#157d60]",
    },
  }[ins.level];
  return (
    <article
      className={`rounded-lg border ${conf.border} dark:bg-[#0b0918] p-5`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${conf.chip}`}
        >
          <conf.Icon className="h-3 w-3" strokeWidth={2} />
          {ins.tag}
        </span>
      </div>
      <h3 className=" text-[18px] leading-snug tracking-tight  mb-2">
        {ins.title}
      </h3>
      <p className="text-[13px] opacity-60 leading-relaxed">
        {ins.description}
      </p>
    </article>
  );
}

export default function DRE() {
  const { transactions, loading } = useTransactions();
  const { activeAnalysis, analyses } = useAnalyses();
  const [view, setView] = useState<View>("value");

  const months = useMemo(() => listMonthKeys(transactions), [transactions]);
  const [selected, setSelected] = useState<string | null>(null);
  const currentKey = selected ?? months[0];
  const prevKey = currentKey
    ? months[months.indexOf(currentKey) + 1]
    : undefined;

  const dre = useMemo(
    () => (currentKey ? buildDRE(transactions, currentKey, prevKey) : []),
    [transactions, currentKey, prevKey]
  );
  const insights = useMemo(
    () => (currentKey ? buildInsights(transactions, currentKey, prevKey) : []),
    [transactions, currentKey, prevKey]
  );

  const tabs: { id: View; label: string }[] = [
    { id: "value", label: "Valores R$" },
    { id: "pct", label: "% Receita" },
    { id: "vs", label: "vs. mês ant." },
  ];

  if (!loading && analyses.length === 0) {
    return <DREEmpty />;
  }

  if (!loading && months.length === 0) {
    return <DREEmpty />;
  }

  return (
    <div className="space-y-12">
      <header className="animate-fade-up flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="uppercase text-[11px] tracking-widest mb-3 !opacity-30">
            DRE facilitado{activeAnalysis ? ` · ${activeAnalysis.name}` : ""}
          </div>
          <h1 className=" text-2xl leading-[1.05] tracking-tight ">
            {currentKey ? monthLabel(currentKey) : "—"}
          </h1>
          <p className="opacity-60 mt-2 text-[14px]">
            Demonstrativo do resultado traduzido em peso visual sobre a receita.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <AnalysisPicker />
          <select
            value={currentKey ?? ""}
            onChange={(e) => setSelected(e.target.value)}
            className="dark:bg-[#0b0918] border dark:border-[#151132] rounded-md px-3 py-2 text-[13px]  "
          >
            {months.map((k) => (
              <option key={k} value={k}>
                {monthShortLabel(k)}
              </option>
            ))}
          </select>
          <div className="inline-flex rounded-md border dark:border-[#151132] dark:bg-[#0b0918] p-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`px-3 py-1.5 text-[12px] rounded-[4px] transition-colors ${
                  view === t.id
                    ? "bg-gray-300 dark:bg-[#15152f] dark:text-cream"
                    : "dark:text-[#96ff7e] hover:bg-cream-deep"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="animate-fade-up delay-1 dark:bg-[#0b0918] border dark:border-[#151132] rounded-lg overflow-hidden shadow-soft">
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-200 dark:bg-[#15152f]/60 border-b dark:border-[#151132]">
          <div className="uppercase text-[11px] tracking-widest col-span-1 !opacity-30">
            Tipo
          </div>
          <div className="uppercase text-[11px] tracking-widest col-span-5 !opacity-30">
            Linha
          </div>
          <div className="uppercase text-[11px] tracking-widest col-span-2 !opacity-30 text-right pr-2">
            Valor
          </div>
          <div className="uppercase text-[11px] tracking-widest hidden md:block col-span-2 !opacity-30">
            Peso na receita
          </div>
          <div className="uppercase text-[11px] tracking-widest col-span-2 !opacity-30 text-right whitespace-nowrap">
            {view === "vs" ? "vs. ant." : "% receita"}
          </div>
        </div>
        <div className="px-2 pb-2">
          {dre.map((line) => (
            <Row key={line.key} line={line} view={view} />
          ))}
        </div>
      </section>

      {insights.length > 0 && (
        <section className="animate-fade-up delay-2">
          <h2 className=" text-[24px] tracking-tight  mb-5">
            Leitura da história
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((i, idx) => (
              <InsightCard key={idx} ins={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function DREEmpty() {
  return (
    <div className="dark:bg-[#0b0918] border dark:border-[#151132] rounded-lg p-12 text-center">
      <Inbox
        className="h-10 w-10 mx-auto dark:text-[#96ff7e] mb-4"
        strokeWidth={1.4}
      />
      <h2 className=" text-[28px] tracking-tight  mb-2">Sem dados ainda</h2>
      <p className="text-[14px] dark:text-[#96ff7e] max-w-md mx-auto mb-6">
        O DRE é montado automaticamente a partir dos seus lançamentos. Importe
        ou adicione manualmente para começar.
      </p>
      <Link
        to="/importar"
        className="inline-flex items-center gap-2 bg-[#15152f] text-cream px-5 py-3 rounded-md text-[13.5px] hover:bg-[#15152f]/90 transition-colors"
      >
        Importar dados
      </Link>
    </div>
  );
}
