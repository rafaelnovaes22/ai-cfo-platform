import * as XLSX from "xlsx";
import type { Transaction } from "./useTransactions";
import type { Analysis } from "./useAnalyses";
import {
  buildDRE,
  listMonthKeys,
  monthLabel,
  monthShortLabel,
  type DRELine,
} from "./analytics";

function flatten(lines: DRELine[], depth = 0): Array<{ depth: number; line: DRELine }> {
  const out: Array<{ depth: number; line: DRELine }> = [];
  for (const l of lines) {
    out.push({ depth, line: l });
    if (l.children?.length) out.push(...flatten(l.children, depth + 1));
  }
  return out;
}

function safeSheetName(name: string): string {
  // Excel: max 31 chars, sem : \ / ? * [ ]
  return name.replace(/[\\/:*?\[\]]/g, " ").slice(0, 31);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "_");
}

/**
 * Gera um arquivo XLSX com o DRE facilitado da análise informada.
 * - Aba "Resumo": metadados da análise.
 * - Uma aba por mês com linhas hierárquicas, valor, % da receita e variação vs. mês anterior.
 */
export function exportDREToXLSX(analysis: Analysis, transactions: Transaction[]) {
  const months = listMonthKeys(transactions);
  const wb = XLSX.utils.book_new();

  // ===== Aba Resumo =====
  const resumoRows: (string | number | null)[][] = [
    ["DRE Facilitado"],
    [],
    ["Análise", analysis.name],
    ["Descrição", analysis.description ?? ""],
    ["Período", analysis.period_start && analysis.period_end ? `${analysis.period_start} → ${analysis.period_end}` : "—"],
    ["Lançamentos", transactions.length],
    ["Meses cobertos", months.length],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    [],
    ["Meses incluídos:"],
    ...months.map((k) => [monthLabel(k)]),
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoRows);
  wsResumo["!cols"] = [{ wch: 22 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  if (months.length === 0) {
    const empty = XLSX.utils.aoa_to_sheet([["Sem lançamentos para exportar."]]);
    XLSX.utils.book_append_sheet(wb, empty, "DRE");
  }

  // ===== Uma aba por mês (mais recente primeiro) =====
  for (let i = 0; i < months.length; i++) {
    const key = months[i];
    const prevKey = months[i + 1];
    const dre = buildDRE(transactions, key, prevKey);
    const flat = flatten(dre);

    const header = ["Tipo", "Linha", "Valor (R$)", "% Receita", "vs. mês anterior"];
    const rows: (string | number | null)[][] = [
      [`DRE — ${monthLabel(key)}`],
      [`Análise: ${analysis.name}`],
      [],
      header,
      ...flat.map(({ depth, line }) => {
        const typeLabel = {
          income: "Receita",
          cost: "Custo",
          expense: "Despesa",
          subtotal: "Subtotal",
          result: "Resultado",
        }[line.type];
        const indent = "    ".repeat(depth);
        return [
          typeLabel,
          `${indent}${line.label}`,
          Number(line.value.toFixed(2)),
          line.share,
          line.vsLast !== undefined ? line.vsLast / 100 : null,
        ];
      }),
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 48 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
    ];

    // Aplica formatos numéricos a partir da linha 5 (índice 4) — após título/análise/blank/header
    const range = XLSX.utils.decode_range(ws["!ref"]!);
    for (let R = 4; R <= range.e.r; R++) {
      const cValor = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];
      if (cValor && typeof cValor.v === "number") {
        cValor.t = "n";
        cValor.z = '"R$" #,##0.00;[Red]"R$" -#,##0.00;"-"';
      }
      const cPct = ws[XLSX.utils.encode_cell({ r: R, c: 3 })];
      if (cPct && typeof cPct.v === "number") {
        cPct.t = "n";
        cPct.z = "0.0%";
      }
      const cVs = ws[XLSX.utils.encode_cell({ r: R, c: 4 })];
      if (cVs && typeof cVs.v === "number") {
        cVs.t = "n";
        cVs.z = "+0.0%;-0.0%;0.0%";
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(monthShortLabel(key)));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const fname = `DRE_${sanitizeFileName(analysis.name)}_${stamp}.xlsx`;
  XLSX.writeFile(wb, fname);
}