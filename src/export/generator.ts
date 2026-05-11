import PDFDocument from "pdfkit";
import { PassThrough } from "stream";
import type { DreLines } from "@/dre-narrative/aggregator.js";

export type ReportType = "monthly" | "investors" | "partners";

export interface CardData {
  cardType: string;
  title:    string;
  body:     string;
}

export interface ActionItemData {
  horizon:     string;
  title:       string;
  description: string;
  effortLevel: string;
  riskLevel:   string;
  impactCents: number;
  doneWhen:    string | null;
}

export interface ReportData {
  tenantName:     string;
  referenceMonth: string;
  dre:            DreLines;
  cards:          CardData[];
  actions:        ActionItemData[];
}

const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const pct = (v: number) => `${v.toFixed(1)}%`;

const HORIZON_LABELS: Record<string, string> = {
  short:  "Curto Prazo (até 30 dias)",
  medium: "Médio Prazo (30–90 dias)",
  long:   "Longo Prazo (90+ dias)",
};

const CARD_COLORS: Record<string, string> = {
  critical_gap: "#c62828",
  attention:    "#f57f17",
  healthy:      "#2e7d32",
};

const CARD_LABELS: Record<string, string> = {
  critical_gap: "Gargalo Crítico",
  attention:    "Atenção",
  healthy:      "Saudável",
};

function header(doc: PDFKit.PDFDocument, data: ReportData, label: string): void {
  doc.fontSize(20).fillColor("#1a1a2e").font("Helvetica-Bold").text("AICFO", { align: "right" });
  doc.fontSize(11).fillColor("#666").font("Helvetica")
    .text(`Relatório ${label} — ${data.referenceMonth}`, { align: "right" });
  doc.fontSize(13).fillColor("#1a1a2e").text(data.tenantName, { align: "right" });
  doc.moveDown(1.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e0e0e0").stroke();
  doc.moveDown(1);
}

function dreSection(doc: PDFKit.PDFDocument, dre: DreLines): void {
  const COL_LABEL = 50;
  const COL_VALUE = 350;
  const ROW_H = 18;

  const row = (label: string, value: string, bold = false, shaded = false) => {
    const y = doc.y;
    if (shaded) {
      doc.save().rect(45, y - 2, 505, ROW_H).fillColor("#f5f5f5").fill().restore();
    }
    const font = bold ? "Helvetica-Bold" : "Helvetica";
    const color = "#1a1a2e";
    doc.fontSize(10).fillColor(color).font(font).text(label, COL_LABEL, y, { width: 280 });
    doc.fontSize(10).fillColor(color).font(font).text(value, COL_VALUE, y, { width: 195, align: "right" });
    doc.y = y + ROW_H;
  };

  doc.fontSize(13).fillColor("#1a1a2e").font("Helvetica-Bold").text("DRE Facilitado");
  doc.moveDown(0.5);

  row("Receita Bruta", brl(dre.receitaBruta));
  row("(-) Deduções", brl(dre.deducoes));
  row("= Receita Líquida", brl(dre.receitaLiquida), true, true);
  doc.moveDown(0.2);
  row("(-) Custos Diretos", brl(dre.custosDiretos));
  row(`= Lucro Bruto (${pct(dre.margemBruta)})`, brl(dre.lucroBruto), true, true);
  doc.moveDown(0.2);
  row("Total Despesas Operacionais", brl(dre.totalDespesasOp));
  doc.moveDown(0.2);
  row(`= EBITDA (${pct(dre.margemEbitda)})`, brl(dre.ebitda), true, true);
  row("(-) Depreciação", brl(dre.depreciacao));
  row("= EBIT", brl(dre.ebit));
  row("Resultado Financeiro", brl(dre.resultadoFinanceiro));
  row("(-) Impostos", brl(dre.impostos));
  doc.moveDown(0.4);

  // Lucro líquido com cor de fundo conforme positivo/negativo
  const llColor = dre.lucroLiquido >= 0 ? "#e8f5e9" : "#ffebee";
  const llY = doc.y;
  doc.save().rect(45, llY - 3, 505, 22).fillColor(llColor).fill().restore();
  row(`= LUCRO LÍQUIDO (${pct(dre.margemLiquida)})`, brl(dre.lucroLiquido), true);
}

function cardsSection(doc: PDFKit.PDFDocument, cards: CardData[]): void {
  doc.addPage();
  doc.fontSize(13).fillColor("#1a1a2e").font("Helvetica-Bold").text("Análise do Mês");
  doc.moveDown(1);

  for (const card of cards) {
    doc
      .fontSize(9).fillColor(CARD_COLORS[card.cardType] ?? "#333").font("Helvetica-Bold")
      .text((CARD_LABELS[card.cardType] ?? card.cardType).toUpperCase());
    doc
      .fontSize(11).fillColor("#1a1a2e").font("Helvetica-Bold")
      .text(card.title);
    doc
      .fontSize(10).fillColor("#444").font("Helvetica")
      .text(card.body, { lineGap: 3 });
    doc.moveDown(1.2);
  }
}

function actionSection(
  doc: PDFKit.PDFDocument,
  actions: ActionItemData[],
  horizons: string[] = ["short", "medium", "long"],
): void {
  doc.addPage();
  doc.fontSize(13).fillColor("#1a1a2e").font("Helvetica-Bold").text("Plano de Ação");
  doc.moveDown(1);

  for (const horizon of horizons) {
    const items = actions.filter((a) => a.horizon === horizon);
    if (items.length === 0) continue;

    doc.fontSize(11).fillColor("#1a1a2e").font("Helvetica-Bold")
      .text(HORIZON_LABELS[horizon] ?? horizon);
    doc.moveDown(0.4);

    for (const item of items) {
      doc.fontSize(10).fillColor("#1a1a2e").font("Helvetica-Bold")
        .text(`• ${item.title}`, { indent: 10 });
      doc.fontSize(9.5).fillColor("#444").font("Helvetica")
        .text(item.description, { indent: 20, lineGap: 2 });
      doc.fontSize(9).fillColor("#666")
        .text(
          `Impacto: ${brl(item.impactCents)}/mês  |  Esforço: ${item.effortLevel}  |  Risco: ${item.riskLevel}`,
          { indent: 20 },
        );
      if (item.doneWhen) {
        doc.fontSize(9).fillColor("#888").font("Helvetica-Oblique")
          .text(`Feita quando: ${item.doneWhen}`, { indent: 20 });
      }
      doc.moveDown(0.8);
    }
    doc.moveDown(0.5);
  }
}

function partnersKpi(doc: PDFKit.PDFDocument, dre: DreLines): void {
  doc.fontSize(13).fillColor("#1a1a2e").font("Helvetica-Bold").text("Resumo para Sócios");
  doc.moveDown(0.8);

  const kv = (label: string, value: string) => {
    doc.fontSize(11).font("Helvetica").fillColor("#333").text(`${label}: `, { continued: true });
    doc.font("Helvetica-Bold").fillColor("#1a1a2e").text(value);
    doc.moveDown(0.4);
  };

  kv("Receita Bruta", brl(dre.receitaBruta));
  kv("Pró-labore", brl(dre.prolabore));
  kv(`EBITDA (${pct(dre.margemEbitda)})`, brl(dre.ebitda));
  kv(`Lucro Líquido (${pct(dre.margemLiquida)})`, brl(dre.lucroLiquido));

  const distribuicao = Math.max(0, dre.lucroLiquido - dre.amortizacaoDividas - dre.capex);
  kv("Distribuição Potencial Estimada", brl(distribuicao));

  doc.moveDown(0.8);
  doc.fontSize(9).fillColor("#999").font("Helvetica-Oblique")
    .text("* Distribuição potencial = Lucro Líquido − Amortização de Dívidas − CAPEX. Consulte seu contador para valores exatos.");
  doc.moveDown(1.5);
}

function addFooters(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    doc.fontSize(8).fillColor("#aaa").font("Helvetica").text(
      `Gerado por Aicfo — ${new Date().toLocaleDateString("pt-BR")}  |  Página ${i + 1} de ${total}`,
      50,
      doc.page.height - 40,
      { align: "center", width: doc.page.width - 100 },
    );
  }
}

export function generateReport(data: ReportData, type: ReportType): PassThrough {
  const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
  const stream = new PassThrough();
  doc.pipe(stream);

  const labels: Record<ReportType, string> = {
    monthly:   "Mensal",
    investors: "Investidores",
    partners:  "Sócios",
  };

  header(doc, data, labels[type]);

  if (type === "monthly") {
    dreSection(doc, data.dre);
    cardsSection(doc, data.cards);
    actionSection(doc, data.actions);
  } else if (type === "investors") {
    dreSection(doc, data.dre);
    actionSection(doc, data.actions, ["medium", "long"]);
  } else {
    partnersKpi(doc, data.dre);
    actionSection(doc, data.actions, ["short"]);
  }

  addFooters(doc);
  doc.end();
  return stream;
}
