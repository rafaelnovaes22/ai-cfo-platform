import { describe, expect, it } from "vitest";

import { classifyWaIntent } from "@/channels/whatsapp/conversation-graph/intent-classifier.js";
import { encodeOutcomeMetrics } from "@/channels/whatsapp/conversation-graph/explanation.js";
import type { WaIncomingMessage } from "@/channels/whatsapp/types.js";
import type {
  WaConversationState,
  WaIntent,
} from "@/channels/whatsapp/conversation-graph/state.js";

// Persona aluno do programa: sócio/CEO de empresa R$1M+/ano de faturamento.
// Mensagens reais de WhatsApp: informal moderado (vc/oq/pq/blz), vocabulário
// de gestão (lucro, margem, faturamento, contador, folha, imposto).
// Régua extraída da avaliação exploratória de 2026-06-11 — não regredir.

function textMsg(text: string): WaIncomingMessage {
  return {
    messageId: `msg-${text}`,
    from: "5511999999999",
    timestamp: "2026-06-11T12:00:00.000Z",
    type: "text",
    text,
  };
}

function freshState(): WaConversationState {
  return {
    phoneE164: "5511999999999",
    tenantId: "tenant-aluno",
    userName: "Marcos",
    plan: "student",
    stage: "READY_FOR_INPUT",
    mode: "active",
    updatedAt: "2026-06-11T12:00:00.000Z",
  };
}

function withOutcomeState(): WaConversationState {
  return {
    ...freshState(),
    stage: "SHOWING_CASHFLOW",
    lastOutcome: {
      type: "cashflow_statement",
      summary:
        "Caixa de maio/2026: entradas R$ 185.000,00, saídas R$ 212.000,00, resultado -R$ 27.000,00.",
      dataRef: encodeOutcomeMetrics({
        creditsCents: 18_500_000,
        debitsCents: 21_200_000,
        resultCents: -2_700_000,
        creditCount: 120,
        debitCount: 192,
        closingBalanceCents: null,
        startDate: "2026-05-01",
        endDate: "2026-05-31",
      }),
      createdAt: "2026-06-11T11:00:00.000Z",
    },
  };
}

type PersonaCase = [text: string, expected: WaIntent | WaIntent[], ctx?: "withOutcome"];

const GREETING_CASES: PersonaCase[] = [
  ["oi", "GREETING"],
  ["olá, tudo bem?", "GREETING"],
  ["boa tarde", "GREETING"],
  ["opa", "GREETING"],
  ["e aí, tudo certo?", "GREETING"],
  ["bom dia, acabei de entrar no programa", "GREETING"],
];

const CAPABILITIES_CASES: PersonaCase[] = [
  ["oq vc faz exatamente?", "CAPABILITIES_HELP"],
  ["o que vc faz?", "CAPABILITIES_HELP"],
  ["como funciona essa ferramenta", "CAPABILITIES_HELP"],
  ["como isso funciona na pratica?", "CAPABILITIES_HELP"],
  ["pra que serve isso?", "CAPABILITIES_HELP"],
  ["vc é uma ia?", "CAPABILITIES_HELP"],
  // Dúvida clássica de empresário
  ["isso substitui meu contador?", "CAPABILITIES_HELP"],
  ["que tipo de analise voce entrega?", ["CAPABILITIES_HELP", "ASK_MONTHLY_ANALYSIS"]],
];

const STATEMENT_CASES: PersonaCase[] = [
  ["como mando o extrato", "SEND_STATEMENT_HELP"],
  ["como envio o extrato da empresa?", "SEND_STATEMENT_HELP"],
  ["meu contador pode mandar o extrato?", "SEND_STATEMENT_HELP"],
  ["posso pedir pro financeiro enviar?", "SEND_STATEMENT_HELP"],
  ["aceita extrato do itau empresas?", "SEND_STATEMENT_HELP"],
  ["serve o pdf que o banco gera?", "SEND_STATEMENT_HELP"],
  // OFX é formato comum em conta PJ
  ["aceita ofx?", "SEND_STATEMENT_HELP"],
  ["posso mandar planilha do excel?", "SEND_STATEMENT_HELP"],
  // Typo comum
  ["como mando o estrato", "SEND_STATEMENT_HELP"],
  // Multi-conta, comum em PME
  ["tenho 3 contas, mando os 3 extratos?", "SEND_STATEMENT_HELP"],
];

const CASHFLOW_CASES: PersonaCase[] = [
  ["como ta meu caixa", "ASK_CASHFLOW"],
  ["quanto sobrou no mes?", ["ASK_CASHFLOW", "ASK_MONTHLY_ANALYSIS"]],
  ["to no vermelho?", "ASK_CASHFLOW"],
  ["quanto gastei", "ASK_CASHFLOW"],
  ["quanto entrou de dinheiro", "ASK_CASHFLOW"],
  ["qual meu saldo atual", "ASK_CASHFLOW"],
  ["tive lucro ou prejuizo?", ["ASK_CASHFLOW", "EXPLAIN_LAST_OUTCOME"]],
  ["qual foi meu lucro", "ASK_CASHFLOW"],
  ["deu prejuizo esse mes?", ["ASK_CASHFLOW", "ASK_MONTHLY_ANALYSIS"]],
  ["quanto faturei", "ASK_CASHFLOW"],
  ["como ta minha margem", ["ASK_CASHFLOW", "EXPLAIN_LAST_OUTCOME"]],
  ["quanto paguei de imposto", "ASK_CASHFLOW"],
  ["a folha ta pesando muito?", ["ASK_CASHFLOW", "EXPLAIN_LAST_OUTCOME"]],
];

const EXPLAIN_CASES: PersonaCase[] = [
  ["nao entendi esse resultado", "EXPLAIN_LAST_OUTCOME", "withOutcome"],
  ["n entendi", "EXPLAIN_LAST_OUTCOME", "withOutcome"],
  ["me explica melhor", "EXPLAIN_LAST_OUTCOME", "withOutcome"],
  ["isso ta bom ou ruim?", "EXPLAIN_LAST_OUTCOME", "withOutcome"],
  ["isso é normal pro meu setor?", "EXPLAIN_LAST_OUTCOME", "withOutcome"],
  ["pq deu negativo", "EXPLAIN_LAST_OUTCOME", "withOutcome"],
  ["pq o resultado ficou negativo?", "EXPLAIN_LAST_OUTCOME", "withOutcome"],
  ["o que significa esse numero", "EXPLAIN_LAST_OUTCOME", "withOutcome"],
  ["esse saldo ta certo? me parece errado", ["EXPLAIN_LAST_OUTCOME", "ASK_CASHFLOW"], "withOutcome"],
  ["de onde saiu esse valor de saida?", "EXPLAIN_LAST_OUTCOME", "withOutcome"],
];

const NEXT_STEP_CASES: PersonaCase[] = [
  ["e agora, o que eu faço?", "ASK_NEXT_STEP", "withOutcome"],
  ["oq eu faço com isso", "ASK_NEXT_STEP", "withOutcome"],
  ["qual o proximo passo", "ASK_NEXT_STEP", "withOutcome"],
  ["o que vc recomenda?", ["ASK_NEXT_STEP", "EXPLAIN_LAST_OUTCOME"], "withOutcome"],
  ["onde eu corto custo?", ["ASK_NEXT_STEP", "EXPLAIN_LAST_OUTCOME"], "withOutcome"],
];

const MONTHLY_CASES: PersonaCase[] = [
  ["quero a analise do mes", "ASK_MONTHLY_ANALYSIS"],
  ["quero ver a dre", "ASK_MONTHLY_ANALYSIS"],
  ["me manda o relatorio mensal", "ASK_MONTHLY_ANALYSIS"],
  ["fecha o mes pra mim", ["ASK_MONTHLY_ANALYSIS", "ASK_CASHFLOW"]],
];

const CONFIRM_NEGATE_CASES: PersonaCase[] = [
  ["sim", "CONFIRMATION"],
  ["pode ser", "CONFIRMATION"],
  ["blz", "CONFIRMATION"],
  ["ok pode mandar", "CONFIRMATION"],
  ["vamos", "CONFIRMATION"],
  ["manda", "CONFIRMATION"],
  ["nao", "NEGATION"],
  ["agora nao", "NEGATION"],
  ["depois eu vejo", "NEGATION"],
  ["deixa pra depois", "NEGATION"],
];

const HUMAN_SUPPORT_CASES: PersonaCase[] = [
  ["quero falar com uma pessoa", "HUMAN_SUPPORT"],
  ["tem alguem do time ai?", "HUMAN_SUPPORT"],
  ["prefiro falar com um consultor", "HUMAN_SUPPORT"],
  ["quero falar com o suporte", "HUMAN_SUPPORT"],
];

const STATUS_CASES: PersonaCase[] = [
  ["meu plano ta ativo?", "ASK_STATUS"],
  ["minha conta ta vinculada?", "ASK_STATUS"],
  ["qual plano eu tenho?", "ASK_STATUS"],
  ["isso ta incluso no programa?", ["ASK_STATUS", "CAPABILITIES_HELP"]],
];

const SOCIAL_CASES: PersonaCase[] = [
  ["obrigado!", "SOCIAL_ACK"],
  ["valeu, ajudou demais", "SOCIAL_ACK"],
  ["show, ficou otimo", "SOCIAL_ACK"],
  ["perfeito", ["SOCIAL_ACK", "CONFIRMATION"]],
  ["mesmo assim obrigado", "SOCIAL_ACK"],
];

const OUT_OF_SCOPE_CASES: PersonaCase[] = [
  ["voce faz a contabilidade da minha empresa?", ["UNKNOWN", "CAPABILITIES_HELP"]],
  ["consegue emitir nota fiscal?", ["UNKNOWN", "CAPABILITIES_HELP"]],
  ["voce paga boleto?", "UNKNOWN"],
];

// Falsos positivos de substring corrigidos em 2026-06-11: "foi"→"oi",
// "negativo"→"ativo", "mesmo"→"mes", "depois"→"oi".
const SUBSTRING_TRAP_CASES: PersonaCase[] = [
  ["vou pensar e te falo depois", ["NEGATION", "UNKNOWN"]],
  ["o resultado deu negativo, certo?", ["EXPLAIN_LAST_OUTCOME", "ASK_CASHFLOW"], "withOutcome"],
];

const SUITES: [name: string, cases: PersonaCase[]][] = [
  ["saudações", GREETING_CASES],
  ["capacidades", CAPABILITIES_CASES],
  ["envio de extrato", STATEMENT_CASES],
  ["caixa com vocabulário de dono", CASHFLOW_CASES],
  ["explicação de resultado", EXPLAIN_CASES],
  ["próximo passo", NEXT_STEP_CASES],
  ["análise mensal", MONTHLY_CASES],
  ["confirmação e negação", CONFIRM_NEGATE_CASES],
  ["suporte humano", HUMAN_SUPPORT_CASES],
  ["status e plano", STATUS_CASES],
  ["social", SOCIAL_CASES],
  ["fora de escopo", OUT_OF_SCOPE_CASES],
  ["armadilhas de substring", SUBSTRING_TRAP_CASES],
];

describe("intent classifier — persona aluno (sócio/CEO de PME R$1M+/ano)", () => {
  for (const [name, cases] of SUITES) {
    describe(name, () => {
      it.each(cases)("%s → %s", (text, expected, ctx) => {
        const state = ctx === "withOutcome" ? withOutcomeState() : freshState();
        const { intent } = classifyWaIntent(textMsg(text), state);
        const expectedArr = Array.isArray(expected) ? expected : [expected];
        expect(expectedArr).toContain(intent);
      });
    });
  }

  it("EXPLAIN_LAST_OUTCOME com outcome na sessão tem confidence high", () => {
    const withCtx = classifyWaIntent(textMsg("não entendi"), withOutcomeState());
    expect(withCtx.intent).toBe("EXPLAIN_LAST_OUTCOME");
    expect(withCtx.confidence).toBe("high");

    const withoutCtx = classifyWaIntent(textMsg("não entendi"), freshState());
    expect(withoutCtx.intent).toBe("EXPLAIN_LAST_OUTCOME");
    expect(withoutCtx.confidence).toBe("medium");
  });
});
