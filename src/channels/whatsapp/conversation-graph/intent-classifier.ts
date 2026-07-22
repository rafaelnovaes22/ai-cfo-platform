import type { WaIncomingMessage } from "../types.js";
import { isSupportedDocument } from "../message-parser.js";
import type { WaConversationState, WaIntent } from "./state.js";
import { rawTextFromMessage } from "./state.js";

export interface WaIntentClassification {
  intent: WaIntent;
  confidence: "high" | "medium" | "low";
  requiresSlm: boolean;
  normalizedText: string;
}

// Abreviações comuns de WhatsApp (registro adulto — persona aluno = sócio/CEO
// de PME). Expandidas token a token após normalização, antes do matching.
const ABBREVIATIONS: Record<string, string> = {
  vc: "voce",
  vcs: "voces",
  oq: "o que",
  q: "que",
  pq: "por que",
  n: "nao",
  blz: "beleza",
  vlw: "valeu",
  obg: "obrigado",
  agr: "agora",
  dps: "depois",
  ta: "esta",
  tao: "estao",
  to: "estou",
  tb: "tambem",
  tbm: "tambem",
  qto: "quanto",
  qnto: "quanto",
  qdo: "quando",
  hj: "hoje",
};

export function normalizeWhatsappText(text: string): string {
  const base = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Pontuação vira espaço para o matching por palavra inteira funcionar
    // ("lucro?" → "lucro"); dígitos são preservados (menu legado "1"/"2"/"3").
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return base
    .split(" ")
    .map((token) => ABBREVIATIONS[token] ?? token)
    .join(" ");
}

// Matching por palavra inteira (termos de 1+ palavras). Substring cru causava
// falsos positivos graves: "foi"→"oi" (GREETING), "negativo"→"ativo"
// (ASK_STATUS), "mesmo"→"mes" (ASK_MONTHLY_ANALYSIS).
function matchAny(padded: string, terms: readonly string[]): boolean {
  return terms.some((term) => padded.includes(` ${term} `));
}

function startsWithAny(tokens: string[], terms: readonly string[]): boolean {
  return terms.some((term) => {
    const termTokens = term.split(" ");
    return termTokens.every((t, i) => tokens[i] === t);
  });
}

const HUMAN_SUPPORT_TERMS = [
  "humano",
  "atendente",
  "suporte",
  "consultor",
  "consultora",
  "falar com alguem",
  "falar com uma pessoa",
  "falar com um pessoa",
  "alguem do time",
  "alguem ai",
  "atendimento humano",
] as const;

// Coisas que o Aicfo genuinamente NÃO faz. Frases específicas para não roubar
// de ASK_CASHFLOW (que tem "imposto"/"folha" soltos): aqui só "imposto de renda"
// e "declarar imposto", nunca "imposto" sozinho.
const OUT_OF_SCOPE_TERMS = [
  "nota fiscal",
  "notas fiscais",
  "emitir nota",
  "emitir nf",
  "emissao de nota",
  "nfe",
  "nfse",
  "boleto",
  "boletos",
  "pagar boleto",
  "contabilidade",
  "contabil",
  "escrituracao",
  "imposto de renda",
  "declarar imposto",
  "declaracao de imposto",
  "declaracao",
  "abrir empresa",
  "abrir cnpj",
  "abrir mei",
  "emprestimo",
  "financiamento",
] as const;

const CAPABILITIES_TERMS = [
  "como funciona",
  "funciona",
  "como interajo",
  "como interagir",
  "interagir com voce",
  "interagir",
  "como uso",
  "como usar",
  "como te uso",
  "como utilizo",
  "como utilizar",
  "o que voce faz",
  "o que voce pode",
  "o que da pra fazer",
  "o que da para fazer",
  "pra que serve",
  "para que serve",
  "como falar com voce",
  "como converso com voce",
  "quem e voce",
  "o que e o aicfo",
  "uma ia",
  "robo",
  "bot",
  "substitui",
] as const;

// CONFIRMATION: mensagem curta composta só de vocabulário de aceite.
// CORE precisa aparecer; FILLER completa frases tipo "ok pode mandar".
const CONFIRM_CORE = [
  "sim",
  "ok",
  "pode",
  "claro",
  "vamos",
  "bora",
  "beleza",
  "manda",
  "mandar",
  "continuar",
  "fechou",
  "fechado",
  "combinado",
  "positivo",
] as const;
const CONFIRM_FILLER = [
  "ser",
  "entao",
  "vai",
  "isso",
  "pra",
  "para",
  "mim",
  "ja",
  "perfeito",
  "la",
  "que",
  "e",
] as const;

const NEGATION_EXACT = [
  "nao",
  "agora nao",
  "depois",
  "mais tarde",
  "ainda nao",
  "hoje nao",
  "por enquanto nao",
] as const;
const NEGATION_PHRASES = [
  "deixa pra depois",
  "deixa para depois",
  "fica pra depois",
  "fica para depois",
  "depois eu vejo",
  "depois a gente ve",
  "agora nao",
  "mais tarde",
] as const;

const SOCIAL_ACK_TERMS = [
  "obrigado",
  "obrigada",
  "brigado",
  "brigada",
  "valeu",
  "agradeco",
  "show",
  "top",
  "otimo",
  "perfeito",
  "excelente",
  "massa",
  "joia",
  "ajudou",
] as const;

const GREETING_TERMS = [
  "oi",
  "oii",
  "oie",
  "ola",
  "opa",
  "eae",
  "e ai",
  "fala",
  "bom dia",
  "boa tarde",
  "boa noite",
  "tudo bem",
  "tudo certo",
  "menu",
  "ajuda",
] as const;

const EXPLAIN_TERMS = [
  "explica",
  "explique",
  "explicar",
  "por que",
  "porque",
  "entendi",
  "significa",
  "normal",
  "errado",
  "errada",
  "negativo",
  "isso esta bom",
  "esta bom",
  "esta ruim",
  "bom ou ruim",
  "e bom",
  "e ruim",
  "esta certo",
  "de onde saiu",
  "de onde veio",
  "esse valor",
  "esse numero",
  "o que acha",
  "recomenda",
  "avalie",
  "avaliar",
  "comente",
  "comentar",
  "interprete",
  "interpretar",
  "analise o resultado",
  "analise meu resultado",
  "analise o caixa",
  "analise meu caixa",
  "leitura do resultado",
  "leitura do extrato",
  "como esta o resultado",
  "como esta meu resultado",
  "como estao os resultados",
  "como estao meus resultados",
] as const;

const STATEMENT_TERMS = [
  "extrato",
  "extratos",
  "estrato",
  "estratos",
  "arquivo",
  "arquivos",
  "pdf",
  "excel",
  "csv",
  "ofx",
  "planilha",
  "planilhas",
  "anexo",
  "anexar",
  "como envio",
  "envio",
  "enviar",
  "mando",
  "mandar",
] as const;

// Vocabulário de dono de negócio: lucro, prejuízo, faturamento, margem,
// imposto, folha e "no vermelho" são as formas como o aluno (sócio/CEO de
// empresa R$1M+/ano) pergunta pelo caixa.
const CASHFLOW_TERMS = [
  "fluxo",
  "caixa",
  "saldo",
  "entrada",
  "entradas",
  "saida",
  "saidas",
  "entrou",
  "saiu",
  "recebimento",
  "recebimentos",
  "pagamento",
  "pagamentos",
  "paguei",
  "resultado",
  "resultados",
  "lucro",
  "prejuizo",
  "faturei",
  "faturou",
  "faturamento",
  "margem",
  "imposto",
  "impostos",
  "folha",
  "vermelho",
  "gastei",
  "gasto",
  "gastos",
  "sobrou",
  "grana",
] as const;

const NEXT_STEP_TERMS = [
  "continua",
  "continuar",
  "e agora",
  "proximo",
  "proximo passo",
  "o que faco",
  "que eu faco",
  "faco agora",
  "faco com isso",
  "o que fazer",
  "corto custo",
  "corto custos",
  "cortar custo",
  "cortar custos",
  "reduzir custo",
  "reduzir custos",
] as const;

const MONTHLY_TERMS = [
  "analise",
  "mensal",
  "mes",
  "dre",
  "relatorio",
  "fechamento",
] as const;

const STATUS_TERMS = [
  "status",
  "minha conta",
  "plano",
  "ativo",
  "ativa",
  "vinculado",
  "vinculada",
  "incluso",
  "inclusa",
  "assinatura",
] as const;

export function classifyWaIntent(
  msg: WaIncomingMessage,
  conversation?: WaConversationState | null,
): WaIntentClassification {
  if (isSupportedDocument(msg)) {
    return {
      intent: "DOCUMENT_RECEIVED",
      confidence: "high",
      requiresSlm: false,
      normalizedText: "",
    };
  }

  const normalizedText = normalizeWhatsappText(rawTextFromMessage(msg));

  if (!normalizedText) {
    return {
      intent: "UNKNOWN",
      confidence: "low",
      requiresSlm: false,
      normalizedText,
    };
  }

  const tokens = normalizedText.split(" ");
  const padded = ` ${normalizedText} `;
  const result = (
    intent: WaIntent,
    confidence: "high" | "medium" | "low" = "high",
    requiresSlm = false,
  ): WaIntentClassification => ({ intent, confidence, requiresSlm, normalizedText });

  if (["1", "2", "3"].includes(normalizedText)) {
    return result(normalizedText === "3" ? "ASK_MONTHLY_ANALYSIS" : "ASK_CASHFLOW");
  }

  if (matchAny(padded, HUMAN_SUPPORT_TERMS)) {
    return result("HUMAN_SUPPORT");
  }

  // Fora de escopo antes de CAPABILITIES: "como funciona a emissão de nota
  // fiscal?" deve dizer que não fazemos isso, não explicar o produto.
  if (matchAny(padded, OUT_OF_SCOPE_TERMS)) {
    return result("OUT_OF_SCOPE");
  }

  if (matchAny(padded, CAPABILITIES_TERMS)) {
    return result("CAPABILITIES_HELP");
  }

  // Confirmação: mensagem curta composta só de vocabulário de aceite
  // ("sim", "blz", "pode ser", "ok pode mandar").
  const confirmVocab = new Set<string>([...CONFIRM_CORE, ...CONFIRM_FILLER]);
  if (
    tokens.length <= 4 &&
    tokens.some((t) => (CONFIRM_CORE as readonly string[]).includes(t)) &&
    tokens.every((t) => confirmVocab.has(t))
  ) {
    return result("CONFIRMATION", "medium");
  }

  if (
    (NEGATION_EXACT as readonly string[]).includes(normalizedText) ||
    matchAny(padded, NEGATION_PHRASES)
  ) {
    return result("NEGATION", "medium");
  }

  if (matchAny(padded, SOCIAL_ACK_TERMS)) {
    return result("SOCIAL_ACK");
  }

  if (matchAny(padded, EXPLAIN_TERMS)) {
    const hasContext = Boolean(conversation?.lastOutcome || conversation?.passiveContext);
    return result("EXPLAIN_LAST_OUTCOME", hasContext ? "high" : "medium", hasContext);
  }

  if (matchAny(padded, STATEMENT_TERMS)) {
    return result("SEND_STATEMENT_HELP");
  }

  if (matchAny(padded, CASHFLOW_TERMS)) {
    return result("ASK_CASHFLOW");
  }

  if (matchAny(padded, NEXT_STEP_TERMS)) {
    return result("ASK_NEXT_STEP");
  }

  if (matchAny(padded, MONTHLY_TERMS)) {
    return result("ASK_MONTHLY_ANALYSIS");
  }

  if (matchAny(padded, STATUS_TERMS)) {
    return result("ASK_STATUS");
  }

  // Saudação por último entre os matches: "oi, quero ver meu caixa" deve cair
  // em ASK_CASHFLOW, não em GREETING. Aqui só chega mensagem sem outra intent.
  if (
    startsWithAny(tokens, GREETING_TERMS) ||
    (tokens.length <= 4 && matchAny(padded, GREETING_TERMS))
  ) {
    return result("GREETING");
  }

  return result("UNKNOWN", "low");
}
