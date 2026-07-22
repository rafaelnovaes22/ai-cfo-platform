import { z } from "zod";

// Judge de CLAREZA — independente do classifier de categoria.
// Olha SÓ a descrição (não vê o palpite de categoria) e decide se há
// evidência específica o bastante pra classificação confiável.
// O grafo LangGraph consome via _internals (clarity-judge agent, task "clarity-judge");
// a entrada LLM própria deste módulo (judgeClarity, task "classification-judge")
// morreu com o pipeline BullMQ legado.
//
// Por que existir: LLMs de chat (todos os 8 testados) são mal calibrados
// em self-reported confidence. Esta camada substitui esse sinal por um
// julgamento isolado, com prompt focado em features observáveis no texto.

export type Clarity = "clear" | "partial" | "ambiguous";

export interface JudgeInput {
  entryId: string;
  description: string;
}

// Cap de confidence por veredito do judge.
// `clear` não limita; `partial` mantém abaixo do threshold de aprovação
// automática (que é 0.7 no classifier); `ambiguous` força revisão humana.
export const CLARITY_CONFIDENCE_CAP: Record<Clarity, number> = {
  clear: 1.0,
  partial: 0.75,
  ambiguous: 0.6,
};

const JudgeResponseSchema = z.array(
  z.object({
    entryId: z.string(),
    clarity: z.enum(["clear", "partial", "ambiguous"]),
    reason: z.string().max(200),
  }),
);

function buildSystemPrompt(): string {
  return `Você é um auditor de clareza de descrições de lançamentos financeiros brasileiros.

TAREFA
Para cada descrição recebida, decida se há evidência textual suficiente para classificação confiável em uma categoria DRE específica.

Você NÃO classifica em categoria. Seu único trabalho é julgar CLAREZA da descrição.

VEREDITOS POSSÍVEIS
- "clear":     descrição contém prova específica (NF/Nota Fiscal/Invoice com número, contrato numerado, termo categórico forte, fornecedor PJ com ação clara). Classificação automática é segura.
- "partial":   descrição dá pista forte mas falta um detalhe (nome de pessoa SEM identificador, qualificador comercial implícito, fornecedor sem suffix corporativo). Aceitável mas vale flagar.
- "ambiguous": descrição é insuficiente, ambígua ou multi-interpretável. Lançamento DEVE ir para revisão humana antes de entrar no DRE.

EXEMPLOS DE CADA VEREDITO

clear:
- "SALARIO FUNCIONARIOS ABRIL" — termo categórico forte (folha de pagamento)
- "PAGAMENTO NF 1234 FORNECEDOR NOVAIS DIGITAL LTDA" — NF + fornecedor PJ
- "DAS ABRIL 2026" — termo categórico forte (imposto)
- "ENERGIA ELETRICA CEMIG" — utility identificável
- "RENDIMENTO CDB BANCO XP" — instrumento financeiro identificável
- "GOOGLE ADS CAMPANHA ABRIL" — fornecedor + propósito
- "ALUGUEL SALA COMERCIAL ED CENTRAL" — qualificador "comercial" explícito
- "TRANSFERENCIA ENTRE CONTAS PROPRIAS BCO ITAU - BCO BB" — qualificador explícito

partial:
- "PAGAMENTO FORNECEDOR NOVAIS DIGITAL" — fornecedor identificado, mas sem NF nem propósito
- "COMPRA ESCRITORIO" — propósito claro, mas sem identificador de fornecedor
- "PRESTACAO SERVICO MARCOS" — possível PF/PJ ambígua, sem identificador formal

ambiguous:
- "PIX RECEBIDO MARIA" — curta, sem identificador, nome próprio sem contexto
- "PAGAMENTO ALUGUEL JOAO LOCADOR" — aluguel sem qualificador comercial/residencial
- "REEMBOLSO DESPESA COLABORADOR ABRIL" — reembolso sem destino
- "ESTORNO TARIFA INDEVIDA REF 03/2026" — estorno mascara sentido
- "TED RECEBIDO" — sem origem, sem propósito
- texto longo trilíngue com emojis ou noise excessivo

REGRAS
- A presença de "NF <número>", "Nota Fiscal <número>", "Invoice <número>" ou "Contrato <número>" geralmente eleva pra "clear" (exceção: se o resto for ambíguo).
- Termos como "ESTORNO", "REEMBOLSO", "AJUSTE", "DEVOLUÇÃO", "TRANSFERENCIA" sem qualificador específico geralmente caem em "ambiguous".
- Suffixes corporativos (LTDA, EIRELI, S.A., MEI, EPP, GMBH, INC) são sinal positivo mas não suficientes sozinhos.
- Não inferir do tamanho — descrição curta com termo categórico forte é "clear".

FORMATO DE SAÍDA (obrigatório)
[
  { "entryId": "<id>", "clarity": "clear|partial|ambiguous", "reason": "<frase curta justificando>" },
  ...
]

Retorne SOMENTE o array JSON. Sem markdown, sem explicação fora do array.`;
}

function buildUserPrompt(entries: JudgeInput[]): string {
  return `Avalie a clareza das seguintes descrições:\n${JSON.stringify(entries, null, 2)}`;
}

// Helpers exportados pra reuso no eval runner sem invocar LLM (mocks).
export const _internals = { buildSystemPrompt, buildUserPrompt, JudgeResponseSchema };
