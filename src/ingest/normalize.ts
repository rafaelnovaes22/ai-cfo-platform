// Normalização determinística de datas e valores financeiros no padrão BR.

import type { DirectionSource } from "@/ingest/types.js";

// ── Datas ──────────────────────────────────────────────────────────────────

// Groups[1..3] são garantidos pela regex; com noUncheckedIndexedAccess TS exige defaults.
const g = (m: RegExpMatchArray, i: number): string => m[i] ?? "";

// dia/mês com / ou - e ano de 2 OU 4 dígitos (DD/MM/YY, DD-MM-YYYY, MM/DD/YY…).
// O ano é opcional: extrato/planilha colada costuma trazer só "01/09". Sem ano,
// normalizeDate usa o `defaultYear` (ano do mês de referência escolhido no modal).
const SLASH_DATE = /^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2}|\d{4}))?$/;
// dia/mês com . exige ano de 4 dígitos: evita que código contábil "1.1.01" vire data.
const DOT_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
// ISO YYYY-MM-DD.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Ano de 2 dígitos → assume século 2000 ("26" → "2026").
const expandYear = (y: string): string => (y.length === 2 ? `20${y}` : y);

// Extrai [campo1, campo2, ano4] de uma data dia/mês (DD/MM ou MM/DD); ano = "" quando
// ausente (só DD/MM). null se não casar.
function dayMonthParts(s: string): [string, string, string] | null {
  const m = s.match(SLASH_DATE) ?? s.match(DOT_DATE);
  if (!m) return null;
  const rawYear = g(m, 3);
  return [g(m, 1), g(m, 2), rawYear ? expandYear(rawYear) : ""];
}

// Valida via round-trip UTC; rejeita overflow (ex.: 31/02 vira 03/03 em JS).
function validateIso(iso: string): string | null {
  const d = new Date(`${iso}T00:00:00Z`);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * Detecta se um conjunto de datas usa mês-primeiro (MM/DD, formato americano).
 * Varre todas: um campo > 12 só pode ser dia, o que fixa a ordem. Se há evidência
 * de mês-primeiro e nenhuma de dia-primeiro → true. Empate/ambíguo → false (default
 * BR, DD/MM). Resolve o caso em que TODAS as datas do arquivo são ambíguas por linha.
 */
export function detectMonthFirst(raws: Array<string | null | undefined>): boolean {
  let dayFirst = false;
  let monthFirst = false;
  for (const raw of raws) {
    if (!raw) continue;
    const parts = dayMonthParts(String(raw).trim());
    if (!parts) continue;
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (a > 12 && b <= 12) dayFirst = true; // 1º campo só pode ser dia → DD/MM
    if (b > 12 && a <= 12) monthFirst = true; // 2º campo só pode ser dia → MM/DD
  }
  return monthFirst && !dayFirst;
}

/**
 * Normaliza uma data para ISO (YYYY-MM-DD). Aceita ISO, DD/MM e MM/DD com ano de
 * 2 ou 4 dígitos — ou SEM ano, caso em que usa `defaultYear` (ano do mês de
 * referência). Desambigua por linha quando um campo > 12; quando ambos ≤ 12, usa
 * `monthFirst` (orientação do arquivo, ver detectMonthFirst). Default BR (DD/MM).
 */
export function normalizeDate(raw: string, monthFirst = false, defaultYear?: string): string | null {
  const s = raw.trim();

  const iso = s.match(ISO_DATE);
  if (iso) return validateIso(`${g(iso, 1)}-${g(iso, 2)}-${g(iso, 3)}`);

  const parts = dayMonthParts(s);
  if (!parts) return null;
  const [f1, f2, parsedYear] = parts;
  const year = parsedYear || (defaultYear ?? "");
  if (!year) return null; // DD/MM sem ano e sem defaultYear: não há como montar a data
  const n1 = Number(f1);
  const n2 = Number(f2);

  let day: string;
  let month: string;
  if (n1 > 12 && n2 <= 12) {
    day = f1;
    month = f2; // 1º campo só pode ser dia
  } else if (n2 > 12 && n1 <= 12) {
    month = f1;
    day = f2; // 2º campo só pode ser dia → 1º é mês
  } else if (monthFirst) {
    month = f1;
    day = f2;
  } else {
    day = f1;
    month = f2;
  }

  return validateIso(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
}

// ── Valores ────────────────────────────────────────────────────────────────

// Teto absoluto por lançamento: R$ 20M (2e9 cents). Precisa caber no Int4 do
// Postgres (max 2.147.483.647 cents); sem este guard, "1e22" digitado no form
// virava Infinity/overflow e estourava 500 no INSERT (visto em prod 2026-06-11).
export const MAX_AMOUNT_CENTS = 2_000_000_000;

function boundedCents(cents: number, negative: boolean): number | null {
  if (!Number.isFinite(cents) || cents > MAX_AMOUNT_CENTS) return null;
  return negative ? -cents : cents;
}

export function normalizeAmountCents(raw: string | number): number | null {
  if (typeof raw === "number") {
    // Preserva o sinal: -900 do Excel é débito de fato (resolveDirection usa o
    // sinal). Os parsers aplicam Math.abs no amountCents persistido.
    if (isNaN(raw)) return null;
    const cents = Math.round(Math.abs(raw) * 100);
    return boundedCents(cents, raw < 0);
  }

  let s = raw.toString().trim();
  // Remove R$, espaços, aspas
  s = s.replace(/R\$\s*/gi, "").replace(/\s/g, "").replace(/"/g, "");
  // Negativo: parênteses contábeis, sinal à esquerda OU à direita (formato Totvs/Protheus: "1.234,56-")
  const negative =
    (s.startsWith("(") && s.endsWith(")")) || s.startsWith("-") || s.endsWith("-");
  s = s.replace(/[()]/g, "").replace(/^-|-$/g, "");

  // Decide o separador decimal pelo que aparece MAIS À DIREITA, distinguindo
  // BR (1.234,56 → vírgula decimal) de US (1,234.56 → ponto decimal).
  // Sem isto, "1,234.56" era lido como 1,23456 → 123 centavos.
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Decimal é a vírgula (BR): pontos são milhar.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // Decimal é o ponto (US/plano): vírgulas são milhar.
    s = s.replace(/,/g, "");
  }

  const num = parseFloat(s);
  if (isNaN(num)) return null;
  const cents = Math.round(Math.abs(num) * 100);
  return boundedCents(cents, negative); // negativo preservado para inferir direção
}

// ── Direção ────────────────────────────────────────────────────────────────

const CREDIT_TOKENS = /^(c|cr|cred|crédito|credito|entrada|e|receita|in|credit)$/i;
const DEBIT_TOKENS  = /^(d|db|deb|débito|debito|saída|saida|s|despesa|out|debit)$/i;

export interface ResolvedDirection {
  direction: "credit" | "debit";
  source: DirectionSource;
}

// Resolve direção E registra a origem. "fallback" significa que o credit é chute
// (positivo sem marcador) — downstream decide se confia (ver service.ts).
export function resolveDirection(
  raw: string | null | undefined,
  amountCents: number,
): ResolvedDirection {
  if (raw) {
    const s = raw.trim();
    if (CREDIT_TOKENS.test(s)) return { direction: "credit", source: "explicit" };
    if (DEBIT_TOKENS.test(s))  return { direction: "debit", source: "explicit" };
  }
  return amountCents < 0
    ? { direction: "debit", source: "sign" }
    : { direction: "credit", source: "fallback" };
}

export function normalizeDirection(
  raw: string | null | undefined,
  amountCents: number,
): "credit" | "debit" {
  return resolveDirection(raw, amountCents).direction;
}

// ── Direção por descrição (heurística determinística, zero-token) ────────────

// Despesas que praticamente toda empresa PAGA, independente do ramo: contas,
// ocupação, tributos, pessoal, telecom, software, transporte, consumo, marketing,
// bancário. Termos inequívocos de SAÍDA — alta precisão sobre recall.
const DEBIT_DESC_TERMS = [
  // contas de consumo
  "energia", "energia eletrica", "luz", "agua", "light", "enel", "cemig", "copel",
  "sabesp", "eletropaulo", "saneamento", "gas",
  // ocupação
  "aluguel", "condominio", "iptu",
  // telecom
  "internet", "telefone", "telefonia", "vivo", "claro", "tim", "net virtua", "banda larga",
  // tributos
  "das", "simples nacional", "imposto", "impostos", "inss", "fgts", "darf", "iss",
  "icms", "pis", "cofins", "tributo", "tributos", "guia",
  // pessoal e terceiros (pagamentos que a empresa faz)
  "pro labore", "prolabore", "salario", "salarios", "folha", "folha de pagamento",
  "ferias", "rescisao", "vale transporte", "vale refeicao", "vale alimentacao",
  "decimo terceiro", "13o", "comissao", "freelancer", "freela", "estagiario",
  "estagiaria", "bolsa", "contador", "contabilidade", "contabeis", "curso",
  "treinamento", "capacitacao",
  // software / saas
  "adobe", "hostgator", "hospedagem", "dominio", "microsoft", "office 365",
  "google workspace", "aws", "dropbox", "canva", "figma", "licenca", "assinatura",
  "saas", "spotify", "netflix",
  // transporte
  "uber", "99", "taxi", "ifood", "combustivel", "gasolina", "etanol", "posto",
  "estacionamento", "pedagio",
  // viagem corporativa (despesa de deslocamento — diária, hospedagem, passagem).
  // "cobertura"/"viagem" aparecem em receita de mídia, mas só viram crédito junto
  // de um termo de CREDIT_DESC_TERMS; sozinhas com "diaria"/"hotel" são saída.
  "viagem", "viagens", "diaria", "diarias", "hotel", "pousada",
  "passagem", "passagens",
  // consumo / mercado
  "mercado", "supermercado", "mercado livre", "mercadolivre", "alimentacao",
  "restaurante", "lanche", "cafe", "copa", "padaria", "almoco", "jantar", "refeicao",
  // marketing
  "meta ads", "google ads", "facebook ads", "instagram ads", "impulsionamento",
  "trafego", "anuncio", "anuncios", "marketing",
  // bancário / financeiro
  "tarifa", "tarifas", "tarifa bancaria", "juros", "multa", "anuidade", "iof",
  // operacional
  "fornecedor", "fornecedores", "manutencao", "conserto", "material", "materiais",
  "frete", "correios", "sedex", "doacao",
] as const;

// Entradas inequívocas de dinheiro. Pequeno e conservador: serviços prestados
// (edição, assessoria, cobertura) são ambíguos por ramo e ficam de fora — caem
// no fallback "credit", que já acerta para eles.
const CREDIT_DESC_TERMS = [
  "recebimento", "recebimentos", "recebido", "recebida", "recebi",
  "receita", "receitas", "venda", "vendas", "vendido",
  "pix recebido", "deposito recebido", "transferencia recebida",
  "faturamento", "mensalidade recebida", "honorarios recebidos",
] as const;

function normalizeDescription(description: string): string {
  return ` ${description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/**
 * Infere direção pela descrição quando o extrato não traz coluna de tipo/sinal.
 * Determinística (zero-token): corrige o fallback "positivo = entrada", em que
 * despesas óbvias (energia, aluguel, DAS, pró-labore) virariam receita. Retorna
 * null quando ambíguo (termos de ambos os lados ou nenhum), preservando o
 * fallback para o classificador LLM tratar no tier pago. Crítico no free tier
 * do aluno, que não passa por classificação.
 */
export function inferDirectionFromDescription(description: string): "credit" | "debit" | null {
  const norm = normalizeDescription(description);
  const hasDebit = DEBIT_DESC_TERMS.some((t) => norm.includes(` ${t} `));
  const hasCredit = CREDIT_DESC_TERMS.some((t) => norm.includes(` ${t} `));
  if (hasDebit && !hasCredit) return "debit";
  if (hasCredit && !hasDebit) return "credit";
  return null;
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
  // Direção fixa quando há uma única coluna de Crédito OU Débito (todos os
  // lançamentos têm o mesmo sentido). null quando a direção vem de dado da linha.
  impliedDirection: "credit" | "debit" | null;
} {
  const normalizedHeaders = headers.map((h) =>
    h.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim(),
  );
  const find = (re: RegExp) => normalizedHeaders.findIndex((h) => re.test(h));
  const creditIdx = find(COL_CREDIT);
  const debitIdx  = find(COL_DEBIT);
  const amountIdx = find(COL_AMOUNT);
  // Quando ambas as colunas existem, são colunas de valor (não de direção)
  const hasSplitAmounts = creditIdx >= 0 && debitIdx >= 0;

  // Coluna única de Crédito OU Débito (sem a contraparte e sem coluna de valor
  // genérica): ela própria é a coluna de valor, com direção implícita. Sem isto,
  // amountIdx ficava -1 e o parser caía em modo posicional gerando lixo.
  let resolvedAmountIdx = amountIdx;
  let impliedDirection: "credit" | "debit" | null = null;
  if (!hasSplitAmounts && amountIdx < 0) {
    if (creditIdx >= 0) {
      resolvedAmountIdx = creditIdx;
      impliedDirection = "credit";
    } else if (debitIdx >= 0) {
      resolvedAmountIdx = debitIdx;
      impliedDirection = "debit";
    }
  }

  return {
    dateIdx:   find(COL_DATE),
    descIdx:   find(COL_DESC),
    amountIdx: resolvedAmountIdx,
    dirIdx:    hasSplitAmounts ? null : (find(COL_DIR) >= 0 ? find(COL_DIR) : null),
    creditIdx: hasSplitAmounts ? creditIdx : null,
    debitIdx:  hasSplitAmounts ? debitIdx : null,
    impliedDirection,
  };
}
