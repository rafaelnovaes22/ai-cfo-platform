// Normalização determinística de datas e valores financeiros no padrão BR.

// ── Datas ──────────────────────────────────────────────────────────────────

const DATE_PATTERNS: Array<{ regex: RegExp; parse: (m: RegExpMatchArray) => string }> = [
  // DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
  {
    regex: /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
    parse: (m) => `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
  },
  // YYYY-MM-DD
  {
    regex: /^(\d{4})-(\d{2})-(\d{2})$/,
    parse: (m) => `${m[1]}-${m[2]}-${m[3]}`,
  },
  // MM/DD/YYYY (formato americano — menos comum no BR, mas aparece em exports)
  {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    parse: (m) => {
      const d1 = parseInt(m[1], 10);
      const d2 = parseInt(m[2], 10);
      // Se d1 > 12, deve ser dia; caso contrário assume DD/MM
      if (d1 > 12) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    },
  },
];

export function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  for (const { regex, parse } of DATE_PATTERNS) {
    const m = s.match(regex);
    if (m) {
      const iso = parse(m);
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return iso;
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
const COL_DIR    = /tipo|natureza|type|d[\/\-]c|dc|entrada|saida|crédito|débito/i;

export function detectColumns(headers: string[]): {
  dateIdx: number;
  descIdx: number;
  amountIdx: number;
  dirIdx: number | null;
} {
  const find = (re: RegExp) => headers.findIndex((h) => re.test(h.trim()));
  return {
    dateIdx:   find(COL_DATE),
    descIdx:   find(COL_DESC),
    amountIdx: find(COL_AMOUNT),
    dirIdx:    find(COL_DIR) >= 0 ? find(COL_DIR) : null,
  };
}
