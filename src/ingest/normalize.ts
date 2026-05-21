// Normalização determinística de datas e valores financeiros no padrão BR.

// ── Datas ──────────────────────────────────────────────────────────────────

// Groups[1..3] são garantidos pela regex; com noUncheckedIndexedAccess TS exige defaults.
const g = (m: RegExpMatchArray, i: number): string => m[i] ?? "";

const DATE_PATTERNS: Array<{ regex: RegExp; parse: (m: RegExpMatchArray) => string }> = [
  // DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  {
    regex: /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
    parse: (m) => `${g(m, 3)}-${g(m, 2).padStart(2, "0")}-${g(m, 1).padStart(2, "0")}`,
  },
  // YYYY-MM-DD
  {
    regex: /^(\d{4})-(\d{2})-(\d{2})$/,
    parse: (m) => `${g(m, 1)}-${g(m, 2)}-${g(m, 3)}`,
  },
  // MM/DD/YYYY (formato americano — menos comum no BR, mas aparece em exports)
  {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parse: (m) => {
      // Sem distinção real entre MM/DD e DD/MM — assume DD/MM (default BR). Drift histórico documentado.
      return `${g(m, 3)}-${g(m, 2).padStart(2, "0")}-${g(m, 1).padStart(2, "0")}`;
    },
  },
];

export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  for (const { regex, parse } of DATE_PATTERNS) {
    const m = s.match(regex);
    if (m) {
      const iso = parse(m);
      const d = new Date(`${iso}T00:00:00Z`);
      if (isNaN(d.getTime())) continue;
      // Validação estrita: rejeita overflow (ex.: 31/02 vira 03/03 em JS).
      // Compara dia/mês/ano após round-trip via Date UTC.
      const isoBack = d.toISOString().slice(0, 10);
      if (isoBack === iso) return iso;
    }
  }
  return null;
}

// ── Valores ────────────────────────────────────────────────────────────────

export function normalizeAmountCents(raw: string | number): number | null {
  if (typeof raw === "number") {
    return isNaN(raw) ? null : Math.round(Math.abs(raw) * 100);
  }

  let s = raw.toString().trim();
  // Remove R$, espaços, aspas
  s = s.replace(/R\$\s*/gi, "").replace(/\s/g, "").replace(/"/g, "");
  // Parênteses → negativo (formato contábil)
  const negative = s.startsWith("(") && s.endsWith(")");
  s = s.replace(/[()]/g, "");

  // Formato BR: 1.234,56 → 1234.56
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // Formato US: 1,234.56 → já ok depois de remover vírgula de milhar
  else if (s.includes(".") && s.indexOf(".") < s.length - 3) {
    s = s.replace(/,/g, "");
  }

  const num = parseFloat(s);
  if (isNaN(num)) return null;
  const cents = Math.round(Math.abs(num) * 100);
  return negative ? -cents : cents; // negativo preservado para inferir direção
}

// ── Direção ────────────────────────────────────────────────────────────────

const CREDIT_TOKENS = /^(c|cr|cred|crédito|credito|entrada|e|receita|in)$/i;
const DEBIT_TOKENS  = /^(d|db|deb|débito|debito|saída|saida|s|despesa|out)$/i;

export function normalizeDirection(
  raw: string | null | undefined,
  amountCents: number,
): "credit" | "debit" {
  if (raw) {
    const s = raw.trim();
    if (CREDIT_TOKENS.test(s)) return "credit";
    if (DEBIT_TOKENS.test(s))  return "debit";
  }
  // Fallback: sinal do valor (negativo = debit)
  return amountCents >= 0 ? "credit" : "debit";
}

// ── Detecção de coluna ─────────────────────────────────────────────────────

const COL_DATE   = /data|date|dt|vencimento|competência|competencia/i;
const COL_DESC   = /descri|historico|histórico|memo|lancamento|lançamento|complement/i;
const COL_AMOUNT = /valor|amount|value|montante|quantia|vlr/i;
const COL_DIR    = /tipo|natureza|type|d[\/\-]c|dc|entrada|saida/i;
// Colunas separadas de crédito/débito (ex: extrato Itaú "Crédito (R$)" / "Débito (R$)")
const COL_CREDIT = /crédito|credito/i;
const COL_DEBIT  = /débito|debito/i;

export function detectColumns(headers: string[]): {
  dateIdx: number;
  descIdx: number;
  amountIdx: number;
  dirIdx: number | null;
  creditIdx: number | null;
  debitIdx: number | null;
} {
  const find = (re: RegExp) => headers.findIndex((h) => re.test(h.trim()));
  const creditIdx = find(COL_CREDIT);
  const debitIdx  = find(COL_DEBIT);
  // Quando ambas as colunas existem, são colunas de valor (não de direção)
  const hasSplitAmounts = creditIdx >= 0 && debitIdx >= 0;
  return {
    dateIdx:   find(COL_DATE),
    descIdx:   find(COL_DESC),
    amountIdx: find(COL_AMOUNT),
    dirIdx:    hasSplitAmounts ? null : (find(COL_DIR) >= 0 ? find(COL_DIR) : null),
    creditIdx: hasSplitAmounts ? creditIdx : null,
    debitIdx:  hasSplitAmounts ? debitIdx : null,
  };
}
