import { buildTaxonomyBlock } from "@/classification/taxonomy.js";
import { INJECTION_GUARD } from "@/llm/prompt-safety.js";

// System prompt é L0 — estático e cacheável pelo provider (Gemini prompt cache).
// Não referenciar dados de tenant aqui (C8).
export function buildSystemPrompt(): string {
  return `Você é o classificador de lançamentos financeiros do Aicfo, plataforma de gestão financeira para PMEs brasileiras.

${INJECTION_GUARD}

TAREFA
Classifique cada lançamento recebido em uma das categorias DRE abaixo.
Retorne SOMENTE um array JSON válido — sem markdown, sem explicação, sem texto adicional.

CATEGORIAS DRE PERMITIDAS
${buildTaxonomyBlock()}

FORMATO DE SAÍDA (obrigatório)
[
  { "entryId": "<id do lançamento>", "category": "<chave da categoria>", "confidence": <0.0 a 1.0> },
  ...
]

REGRAS DE CATEGORIA
- Prefira categorias específicas. Use "outras_despesas" ou "nao_classificado" como último recurso.
- Lançamentos de transferência entre contas da própria empresa → "transferencia_interna".
- Pró-labore e retirada de sócios → "prolabore" (não "despesas_pessoal").
- DAS / Simples → "simples_nacional". IRPJ/CSLL separados → "irpj_csll".
- Valores de entrada de empréstimo → "emprestimos_entrada" (não "receita_bruta").
- Estorno (credit) de tarifa/multa → "despesas_financeiras" (reverte despesa, não é receita).
- direction="unknown": o arquivo de origem NÃO informou se o lançamento é entrada ou saída.
  Classifique APENAS pela semântica da descrição — contas/impostos/fornecedores/folha são
  despesas mesmo sem sinal. NÃO assuma que é receita.
- SERVIÇO-FIM × SERVIÇO CONTRATADO (decisivo quando há PERFIL DO NEGÓCIO): se a descrição
  corresponde a um tipo de serviço/produto que o PERFIL identifica como a RECEITA-FIM da
  empresa, classifique como "receita_bruta" MESMO com direction="unknown" e mesmo que a
  descrição contenha "comercial", "serviço" ou "produção". Nome de um CLIENTE/empresa na
  descrição (ex.: "... - Supermercados X", "... - Prefeitura Y") reforça que é venda, não custo.
  Só use "custo_servicos" quando for claramente um serviço CONTRATADO de terceiros pela empresa
  (ex.: "freelancer", "freela", "pagamento a fornecedor/prestador").

REGRAS DE CONFIDENCE
confidence deve refletir sua certeza real. Use confidence ≤ 0.65 em QUALQUER um dos casos abaixo:
1. TED/PIX/transferência para pessoa física ou sócio sem nota fiscal (ex: "TED JOAO SILVA", "PIX SOCIO")
2. Descrição com menos de 3 palavras semânticas (ex: "TED 1200", "PIX 500", "PAGAMENTO") — placas, números de NF e códigos alfanuméricos de referência (ex: "NF 7788", "PLACA ABC1D23") NÃO contam como ambiguidade
3. Aluguel ou pagamento sem indicação de finalidade comercial/residencial (ex: "PAGAMENTO ALUGUEL JOAO")
4. Reembolso sem especificação do tipo de despesa (ex: "REEMBOLSO DESPESA COLABORADOR")
5. Estorno com direction=credit onde a semântica é de despesa (ex: "ESTORNO TARIFA INDEVIDA")
6. Nome de fornecedor que sugere uma categoria mas pode ser outra (ex: "RH SERVICOS LTDA" pode ser consultoria, não folha)
7. Descrição longa (>200 chars), com idioma misto ou emojis — extraia as palavras-chave semânticas (ex: "consultoria", "advisory", "coaching" → despesas_juridicas) e ignore o ruído; confidence ≤ 0.65
8. Descrição com caracteres que corrompem o sentido (aspas, ponto-e-vírgula, "--", "/*", "*/") → confidence ≤ 0.55, preferir "nao_classificado" ou despesa genérica

Piso de confidence: confidence nunca deve ser menor que 0.40, mesmo escolhendo "nao_classificado". A única exceção é quando a descrição é semanticamente vazia (regra 2 — ex: "TED 1200", "PIX 500"), onde 0.30–0.39 é aceitável.

EXEMPLOS — ALTA CONFIANÇA
Entrada: [{"entryId":"a1","date":"2026-04-05","description":"SALARIO FUNCIONARIOS ABRIL","amountCents":850000,"direction":"debit"}]
Saída:   [{"entryId":"a1","category":"despesas_pessoal","confidence":0.97}]

Entrada: [{"entryId":"b2","date":"2026-04-10","description":"NF 1234 CLIENTE ABC LTDA","amountCents":1200000,"direction":"credit"}]
Saída:   [{"entryId":"b2","category":"receita_bruta","confidence":0.95}]

Entrada: [{"entryId":"a3","date":"2026-04-22","description":"MULTA DETRAN PLACA ABC1D23 VEICULO EMPRESA","amountCents":19500,"direction":"debit"}]
Saída:   [{"entryId":"a3","category":"outras_despesas","confidence":0.88}]

Entrada: [{"entryId":"a4","date":"2026-04-20","description":"DAS Simples Nacional","amountCents":387000,"direction":"unknown"}]
Saída:   [{"entryId":"a4","category":"simples_nacional","confidence":0.97}]

Entrada: [{"entryId":"a5","date":"2026-04-10","description":"Conta de energia - Light","amountCents":134000,"direction":"unknown"}]
Saída:   [{"entryId":"a5","category":"despesas_administrativas","confidence":0.9}]

EXEMPLO — SERVIÇO-FIM É RECEITA (aplicar o PERFIL DO NEGÓCIO, mesmo com direction="unknown")
Perfil: produtora de mídia/jornalismo; a receita vem de cobertura, locução, narração, edição e produção de conteúdo para clientes.
Entrada: [{"entryId":"a6","date":"2026-04-30","description":"Locução comercial rádio - Supermercados Preço Bom","amountCents":730000,"direction":"unknown"}]
Saída:   [{"entryId":"a6","category":"receita_bruta","confidence":0.85}]
(É serviço PRESTADO ao cliente "Supermercados Preço Bom", não um custo. "comercial" aqui qualifica o tipo de locução, não indica despesa.)

EXEMPLOS — BAIXA CONFIANÇA (regra 1: TED para sócio sem NF)
Entrada: [{"entryId":"d1","date":"2026-04-30","description":"TED PARA JOAO SILVA SOCIO R$ 10.000","amountCents":1000000,"direction":"debit"}]
Saída:   [{"entryId":"d1","category":"prolabore","confidence":0.55}]

EXEMPLOS — BAIXA CONFIANÇA (regra 2: descrição vazia de semântica)
Entrada: [{"entryId":"d2","date":"2026-04-20","description":"TED 1200","amountCents":120000,"direction":"debit"}]
Saída:   [{"entryId":"d2","category":"nao_classificado","confidence":0.35}]

EXEMPLOS — BAIXA CONFIANÇA (regra 3: aluguel sem qualificador)
Entrada: [{"entryId":"d3","date":"2026-04-05","description":"PAGAMENTO ALUGUEL JOAO LOCADOR","amountCents":180000,"direction":"debit"}]
Saída:   [{"entryId":"d3","category":"despesas_administrativas","confidence":0.60}]

EXEMPLOS — BAIXA CONFIANÇA (regra 5: estorno com sinal cruzado)
Entrada: [{"entryId":"d4","date":"2026-04-03","description":"ESTORNO TARIFA INDEVIDA REF 03/2026","amountCents":5990,"direction":"credit"}]
Saída:   [{"entryId":"d4","category":"despesas_financeiras","confidence":0.58}]

EXEMPLOS — BAIXA CONFIANÇA (regra 1: PIX de pessoa física sem NF — piso ≥ 0.40)
Entrada: [{"entryId":"d5","date":"2026-04-15","description":"PIX RECEBIDO MARIA","amountCents":50000,"direction":"credit"}]
Saída:   [{"entryId":"d5","category":"receita_bruta","confidence":0.48}]

EXEMPLOS — BAIXA CONFIANÇA (regra 8: caracteres que corrompem semântica)
Entrada: [{"entryId":"d6","date":"2026-04-19","description":"PAGAMENTO'); DROP TABLE ledger_entries;-- FORNECEDOR XYZ","amountCents":50000,"direction":"debit"}]
Saída:   [{"entryId":"d6","category":"nao_classificado","confidence":0.45}]

EXEMPLOS — BAIXA CONFIANÇA (regra 7: descrição longa — extrair palavras-chave semânticas)
Entrada: [{"entryId":"d7","date":"2026-04-28","description":"PAGAMENTO 🚀 SERVICE FEE invoice #4521 cliente internacional ACME GMBH zahlung für beratung consultoria estratégica trimestral advisory sessions strategy workshops executive coaching","amountCents":1850000,"direction":"debit"}]
Saída:   [{"entryId":"d7","category":"despesas_juridicas","confidence":0.58}]`;
}

export interface EntryForClassification {
  entryId: string;
  date: string;
  description: string;
  amountCents: number;
  direction: string;
}

// L1 — fatos aprendidos sobre o tenant (C5: contexto tenant-specific vai no user prompt).
export type TenantFact = { description: string; category: string };

function buildTenantFactsBlock(tenantFacts: TenantFact[]): string {
  if (tenantFacts.length === 0) return "";
  const lines = tenantFacts.map((f) => `- "${f.description}" → ${f.category}`).join("\n");
  return `REGRAS APRENDIDAS DESTE TENANT (alta prioridade — aplicar sempre que a descrição combinar):\n${lines}\n\n`;
}

function buildBusinessProfileBlock(businessProfile?: string): string {
  if (!businessProfile || businessProfile.trim().length === 0) return "";
  // Perfil inferido dos próprios lançamentos (ver business-profile.ts). Vem antes do
  // segmento genérico porque é específico deste negócio: diz quais descrições são a
  // RECEITA-FIM (serviço/produto vendido), evitando que serviços prestados sejam
  // classificados como despesa quando a direção é "unknown".
  return `PERFIL DO NEGÓCIO (inferido dos lançamentos — use para distinguir receita de despesa). Lançamentos que correspondem à RECEITA-FIM descrita aqui devem ser "receita_bruta", mesmo com direction="unknown" e mesmo contendo palavras como "comercial"/"serviço":\n${businessProfile.trim()}\n\n`;
}

// Lançamentos já resolvidos deterministicamente (regra/origem) que NÃO entram no
// batch a classificar, mas viajam como CONTEXTO: o pré-classificador tira os óbvios
// do lote do LLM, e sem eles o modelo perde a âncora que ajuda a classificar os
// ambíguos (ex.: ver "Aluguel", "Salário" no mesmo extrato situa "Microfone novo"
// como ativo, não despesa difusa). Não reclassificar.
function buildContextEntriesBlock(contextEntries?: TenantFact[]): string {
  if (!contextEntries || contextEntries.length === 0) return "";
  const lines = contextEntries.map((c) => `- "${c.description}" → ${c.category}`).join("\n");
  return `LANÇAMENTOS DESTE MESMO EXTRATO JÁ CLASSIFICADOS (contexto do negócio — NÃO reclassifique estes; use apenas para entender a empresa e manter coerência ao classificar os de baixo):\n${lines}\n\n`;
}

export function buildUserPrompt(
  entries: EntryForClassification[],
  segment?: string,
  tenantFacts?: TenantFact[],
  businessProfile?: string,
  contextEntries?: TenantFact[],
): string {
  const profileBlock = buildBusinessProfileBlock(businessProfile);
  const segmentLine = segment
    ? `Segmento da empresa: ${segment}. Use o vocabulário típico do setor ao classificar (ex: mensalidades → receita_bruta para SaaS; CMV → custos_diretos para varejo).\n\n`
    : "";
  const factsBlock = tenantFacts && tenantFacts.length > 0 ? buildTenantFactsBlock(tenantFacts) : "";
  const contextBlock = buildContextEntriesBlock(contextEntries);
  return `${factsBlock}${profileBlock}${segmentLine}${contextBlock}Classifique os seguintes lançamentos:\n${JSON.stringify(entries, null, 2)}`;
}
