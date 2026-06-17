// Pré-classificador determinístico (zero-token) de categoria DRE.
//
// PRINCÍPIO: financeiro não pode ser gratuitamente probabilístico. Termos
// INEQUÍVOCOS (aluguel, pró-labore, DAS, contador, Meta Ads...) recebem categoria
// por regra com confiança 1.0 e PULAM o LLM. Só o que é genuinamente ambíguo
// (receitas que dependem do business-profile, descrições genéricas) segue para o
// modelo. Reduz a superfície probabilística, o custo e a latência.
//
// Espelha a técnica de DEBIT_DESC_TERMS (normalize.ts), mas mapeando termo →
// CATEGORIA em vez de direção. Alta precisão sobre recall: termo ambíguo fica de
// fora de propósito e cai no LLM. Quando duas categorias casam, devolve null
// (não chuta). Quando a natureza da categoria contradiz a direção CONFIÁVEL do
// extrato, devolve null (deixa o LLM/revisão decidir, sem forçar o caixa).

import { CATEGORY_NATURE, type DreCategory } from "@/classification/taxonomy.js";
import { normalizeDescription } from "@/ingest/normalize.js";

// Só categorias de natureza determinável e termos sem ambiguidade léxica em PT-BR.
// CUIDADO com termos curtos que também são palavras comuns/artigos: "das" (de+as)
// casaria "pagamento das comissões", por isso usamos só "das simples"/"simples
// nacional"; "luz"/"gas" sozinhos são ambíguos e ficam fora.
const CATEGORY_DESC_TERMS: Partial<Record<DreCategory, readonly string[]>> = {
  prolabore: ["pro labore", "prolabore", "retirada de socios", "retirada dos socios"],
  despesas_pessoal: [
    "salario", "salarios", "folha de pagamento", "fgts", "inss", "ferias",
    "rescisao", "vale transporte", "vale refeicao", "vale alimentacao",
    "decimo terceiro", "13o salario",
  ],
  despesas_administrativas: [
    "aluguel", "condominio", "iptu", "energia eletrica", "conta de luz",
    "agua e esgoto", "internet", "telefonia",
  ],
  simples_nacional: ["das simples nacional", "simples nacional", "das simples", "guia das"],
  irpj_csll: ["irpj", "csll", "darf irpj", "darf csll"],
  despesas_comerciais: [
    "meta ads", "google ads", "facebook ads", "instagram ads",
    "trafego pago", "impulsionamento",
  ],
  despesas_ti: [
    "google workspace", "microsoft 365", "office 365", "figma", "github",
    "hostgator", "hospedagem de site",
  ],
  despesas_juridicas: [
    "contador", "contabilidade", "honorarios contabeis", "honorarios contador",
    "advogado", "honorarios advocaticios", "escritorio de contabilidade",
  ],
  despesas_financeiras: [
    "tarifa bancaria", "tarifas bancarias", "iof", "taxa de maquininha",
    "anuidade cartao", "anuidade do cartao",
  ],
  // Bens duráveis (ativo imobilizado). Só viram capex quando são AQUISIÇÃO — a
  // guarda NON_ACQUISITION_TERMS abaixo barra manutenção/aluguel/serviço sobre o
  // mesmo equipamento (ex.: "manutenção câmera", "aluguel notebook"), que é despesa.
  // Nomes específicos, não a palavra "equipamento" (genérica demais: frete/aluguel).
  capex: [
    "microfone", "microfones", "camera", "cameras", "tripe",
    "computador", "computadores", "notebook", "notebooks", "macbook", "desktop",
    "lente", "lentes", "monitor", "monitores", "impressora", "impressoras",
    "servidor", "drone", "drones", "headset", "projetor",
  ],
};

// Termos que indicam que o lançamento NÃO é aquisição do bem (é despesa sobre ele):
// manutenção, conserto, aluguel, assinatura, seguro. Anulam o match de capex.
const NON_ACQUISITION_TERMS = [
  "manutencao", "conserto", "reparo", "reparos", "revisao", "aluguel", "locacao",
  "assinatura", "mensalidade", "assistencia", "seguro", "frete",
] as const;

const NATURE_TO_DIRECTION = { credit: "credit", debit: "debit" } as const;

export interface RuleMatch {
  category: DreCategory;
  /** Determinístico: certeza máxima. */
  confidence: 1;
}

/**
 * Classifica um lançamento por regra determinística. Devolve null quando:
 *  - nenhum termo-âncora casa (→ LLM decide);
 *  - mais de uma categoria casa (ambíguo → LLM decide);
 *  - a natureza da categoria contradiz a direção CONFIÁVEL do extrato
 *    (direction !== "unknown"), preservando o caixa contábil sem forçar a regra.
 */
export function classifyByRule(
  description: string,
  direction: "credit" | "debit" | "unknown",
): RuleMatch | null {
  const norm = normalizeDescription(description);
  const matched = new Set<DreCategory>();
  for (const [cat, terms] of Object.entries(CATEGORY_DESC_TERMS) as [
    DreCategory,
    readonly string[],
  ][]) {
    if (terms.some((t) => norm.includes(` ${t} `))) matched.add(cat);
  }
  if (matched.size !== 1) return null;

  const category = [...matched][0]!;
  // Equipamento durável só é capex se for AQUISIÇÃO — manutenção/aluguel/serviço
  // sobre ele é despesa, deixa o LLM decidir.
  if (category === "capex" && NON_ACQUISITION_TERMS.some((t) => norm.includes(` ${t} `))) {
    return null;
  }
  const nature = CATEGORY_NATURE[category];
  if (direction !== "unknown" && nature !== null && NATURE_TO_DIRECTION[nature] !== direction) {
    return null;
  }
  return { category, confidence: 1 };
}
