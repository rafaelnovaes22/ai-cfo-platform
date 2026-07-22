import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/observability/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

import { classifyWaIntent } from "@/channels/whatsapp/conversation-graph/intent-classifier.js";
import { decideWhatsappConversation } from "@/channels/whatsapp/conversation-graph/index.js";
import {
  buildPostCashflowState,
  encodeOutcomeMetrics,
  formatDeterministicCashflowExplanation,
  type CashflowMetrics,
} from "@/channels/whatsapp/conversation-graph/explanation.js";
import type { WaIncomingMessage } from "@/channels/whatsapp/types.js";
import type { WaConversationState } from "@/channels/whatsapp/conversation-graph/state.js";

// Espelha o extrato da screenshot: entradas 45.593,73 / saídas 90.593,73 / resultado -45.000,00
function negativeMetrics(): CashflowMetrics {
  return {
    creditsCents: 4_559_373,
    debitsCents: 9_059_373,
    resultCents: -4_500_000,
    creditCount: 28,
    debitCount: 24,
    closingBalanceCents: null,
    startDate: "2026-02-27",
    endDate: "2026-05-20",
  };
}

function textMsg(text: string): WaIncomingMessage {
  return {
    messageId: `msg-${text}`,
    from: "5511999999999",
    timestamp: "2026-06-09T12:00:00.000Z",
    type: "text",
    text,
  };
}

function baseState(
  overrides: Partial<WaConversationState> = {},
): WaConversationState {
  return {
    phoneE164: "5511999999999",
    tenantId: "tenant-1",
    userName: "Rafael De Novaes",
    plan: "lite",
    stage: "READY_FOR_INPUT",
    mode: "active",
    updatedAt: "2026-06-09T12:00:00.000Z",
    ...overrides,
  };
}

describe("whatsapp conversation graph — deterministic zero-token UX", () => {
  it("interpreta escolha legada '1' como pedido de caixa, mas pede extrato em vez de menu/caixa zerado", async () => {
    const decision = await decideWhatsappConversation(
      textMsg("1"),
      baseState(),
    );

    expect(decision.intent).toBe("ASK_CASHFLOW");
    expect(decision.usedSlm).toBe(false);
    expect(decision.route).toBe("SEND_TEXT");
    expect(decision.responseText?.toLowerCase()).toContain("extrato");
    expect(decision.responseText?.toLowerCase()).not.toContain("caixa de hoje");
    expect(decision.responseText?.toLowerCase()).not.toContain("r$ 0");
  });

  it("'como está meu caixa?' mostra o resultado já calculado em vez de pedir extrato de novo", async () => {
    const decision = await decideWhatsappConversation(
      textMsg("Como está meu caixa?"),
      baseState({
        lastOutcome: {
          type: "cashflow_statement",
          summary: "Resultado negativo de -R$ 45.000,00",
          dataRef: encodeOutcomeMetrics(negativeMetrics()),
          createdAt: "2026-06-09T12:00:00.000Z",
        },
      }),
    );

    expect(decision.intent).toBe("ASK_CASHFLOW");
    expect(decision.usedSlm).toBe(false);
    expect(decision.route).toBe("SEND_TEXT");
    // Mostra os números do caixa (entradas, saídas, resultado), não o pedido de extrato
    expect(decision.responseText).toContain("45.593,73");
    expect(decision.responseText).toContain("90.593,73");
    expect(decision.responseText).toContain("Resultado");
    // Oferece a leitura sem ser a leitura completa em si
    expect(decision.responseText?.toLowerCase()).toContain("me explica");
  });

  it("'como está meu caixa?' SEM resultado calculado ainda pede o extrato (regressão)", async () => {
    const decision = await decideWhatsappConversation(
      textMsg("Como está meu caixa?"),
      baseState(),
    );

    expect(decision.intent).toBe("ASK_CASHFLOW");
    expect(decision.responseText?.toLowerCase()).toContain("extrato");
  });

  it("responde 'vc não continua?' com continuação contextual sem reenviar menu", async () => {
    const decision = await decideWhatsappConversation(
      textMsg("Vc nao continua a conversa?"),
      baseState({
        stage: "AWAITING_STATEMENT",
        pendingAction: "send_statement",
      }),
    );

    expect(decision.intent).toBe("ASK_NEXT_STEP");
    expect(decision.usedSlm).toBe(false);
    expect(decision.responseText?.toLowerCase()).toContain("continuo sim");
    expect(decision.responseText?.toLowerCase()).toContain("extrato");
    expect(decision.responseText?.toLowerCase()).not.toContain("1️⃣");
  });

  it("trata 'como consigo interagir com você?' como ajuda de capacidades, sem repetir o menu", async () => {
    const decision = await decideWhatsappConversation(
      textMsg("como consigo interagir com você?"),
      baseState(),
    );

    expect(decision.intent).toBe("CAPABILITIES_HELP");
    expect(decision.usedSlm).toBe(false);
    expect(decision.route).toBe("SEND_TEXT");
    expect(decision.responseText?.toLowerCase()).toContain("fluxo de caixa");
    expect(decision.responseText).not.toContain("1️⃣");
  });

  it("reconhece 'o que você faz?' e 'como funciona' como capacidades", () => {
    expect(
      classifyWaIntent(textMsg("o que você faz?"), baseState()).intent,
    ).toBe("CAPABILITIES_HELP");
    expect(
      classifyWaIntent(textMsg("como funciona isso?"), baseState()).intent,
    ).toBe("CAPABILITIES_HELP");
  });

  it("não confunde 'como envio o extrato?' (continua send-statement-help)", () => {
    expect(
      classifyWaIntent(textMsg("como envio o extrato?"), baseState()).intent,
    ).toBe("SEND_STATEMENT_HELP");
  });

  it("reconhece 'como está meu resultado?' e 'avalie meu resultado' como EXPLAIN_LAST_OUTCOME", () => {
    expect(
      classifyWaIntent(textMsg("Como está meu resultado?"), baseState()).intent,
    ).toBe("EXPLAIN_LAST_OUTCOME");
    expect(
      classifyWaIntent(textMsg("Como está o resultado?"), baseState()).intent,
    ).toBe("EXPLAIN_LAST_OUTCOME");
    expect(
      classifyWaIntent(textMsg("avalie meu resultado"), baseState()).intent,
    ).toBe("EXPLAIN_LAST_OUTCOME");
    expect(
      classifyWaIntent(textMsg("analise meu resultado"), baseState()).intent,
    ).toBe("EXPLAIN_LAST_OUTCOME");
    expect(
      classifyWaIntent(textMsg("analise o caixa"), baseState()).intent,
    ).toBe("EXPLAIN_LAST_OUTCOME");
    expect(classifyWaIntent(textMsg("analise"), baseState()).intent).toBe(
      "ASK_MONTHLY_ANALYSIS",
    );
  });

  it("'me explica o resultado' devolve leitura determinística com os números reais, sem ecoar saudação", async () => {
    const decision = await decideWhatsappConversation(
      textMsg("me explica o resultado"),
      baseState({
        plan: "student",
        lastOutcome: {
          type: "cashflow_statement",
          summary: "Resultado negativo de -R$ 45.000,00",
          dataRef: encodeOutcomeMetrics(negativeMetrics()),
          createdAt: "2026-06-09T12:00:00.000Z",
        },
      }),
    );

    expect(decision.intent).toBe("EXPLAIN_LAST_OUTCOME");
    expect(decision.usedSlm).toBe(false);
    expect(decision.route).toBe("SEND_TEXT");
    // Explica de verdade: comenta o resultado negativo e os valores
    // (toLocaleString usa espaço non-breaking após "R$", por isso checamos só os dígitos)
    expect(decision.responseText?.toLowerCase()).toContain("negativo");
    expect(decision.responseText).toContain("45.000,00");
    expect(decision.responseText).toContain("90.593,73");
    // Não ecoa a saudação (bug corrigido)
    expect(decision.responseText).not.toContain("Olá");
  });

  it("leitura determinística comenta resultado negativo (saídas vs entradas) e positivo", () => {
    const negativo = formatDeterministicCashflowExplanation(
      negativeMetrics(),
      "Rafael De Novaes",
    );
    expect(negativo.toLowerCase()).toContain("negativo");
    expect(negativo.toLowerCase()).toContain("dobro");
    expect(negativo).toContain("Rafael");

    const positivo = formatDeterministicCashflowExplanation({
      ...negativeMetrics(),
      debitsCents: 1_000_000,
      resultCents: 3_559_373,
    });
    expect(positivo.toLowerCase()).toContain("positivo");
    expect(positivo.toLowerCase()).toContain("sobrou");
  });

  it("pergunta explicativa não consome SLM quando a flag está desligada", async () => {
    vi.stubEnv("WHATSAPP_CONVERSATION_SLM_ENABLED", "false");

    const decision = await decideWhatsappConversation(
      textMsg("me explica esse resultado"),
      baseState({
        lastOutcome: {
          type: "cashflow_statement",
          summary: "Resultado positivo de R$ 6.450 no extrato.",
          createdAt: "2026-06-09T12:00:00.000Z",
        },
      }),
    );

    expect(decision.intent).toBe("EXPLAIN_LAST_OUTCOME");
    expect(decision.usedSlm).toBe(false);
    expect(decision.responseText).toContain("Resultado positivo de R$ 6.450");
  });

  it("após o ingest terminar, o estado encerra o processamento (não fica preso em wait_ingest)", () => {
    const before = baseState({
      stage: "INGESTING_STATEMENT",
      pendingAction: "wait_ingest",
    });

    const after = buildPostCashflowState(before, negativeMetrics(), "2026-06-11T10:56:00.000Z");

    expect(after.stage).toBe("SHOWING_CASHFLOW");
    expect(after.pendingAction).toBe("choose_next_step");
    expect(after.lastOutcome?.type).toBe("cashflow_statement");
    expect(after.lastOutcome?.dataRef).toBe(encodeOutcomeMetrics(negativeMetrics()));
  });

  it("pergunta seguinte ao resultado ('o que mais?') não responde que ainda está processando", async () => {
    // Reproduz o bug visto em produção (2026-06-11): após entregar o caixa, uma
    // pergunta aberta caía no formatContinuePrompt e respondia "estou processando".
    const postIngest = buildPostCashflowState(
      baseState({ stage: "INGESTING_STATEMENT", pendingAction: "wait_ingest" }),
      negativeMetrics(),
    );

    const decision = await decideWhatsappConversation(textMsg("o que mais?"), postIngest);

    expect(decision.responseText?.toLowerCase()).not.toContain("processando");
    // Oferece o caminho real: explicar o resultado ou próximo passo.
    expect(decision.responseText?.toLowerCase()).toContain("resultado");
  });

  it("estado inconsistente da race (caixa pronto + pendingAction wait_ingest) ainda devolve o caixa", async () => {
    // Bug real do print (2026-06-15): o ingest roda em background e mensagens em
    // rajada sobrescrevem a sessão, deixando lastOutcome com métricas E o
    // pendingAction preso em "wait_ingest". A continuação deve mostrar o caixa,
    // nunca "estou processando".
    const inconsistent = baseState({
      stage: "INGESTING_STATEMENT",
      pendingAction: "wait_ingest",
      lastOutcome: {
        type: "cashflow_statement",
        summary: "Resultado negativo de -R$ 45.000,00",
        dataRef: encodeOutcomeMetrics(negativeMetrics()),
        createdAt: "2026-06-15T10:56:00.000Z",
      },
    });

    const decision = await decideWhatsappConversation(textMsg("o que mais?"), inconsistent);

    expect(decision.responseText?.toLowerCase()).not.toContain("processando");
    // Snapshot do caixa: entradas, saídas e resultado.
    expect(decision.responseText?.toLowerCase()).toContain("entradas");
    expect(decision.responseText?.toLowerCase()).toContain("saídas");
    expect(decision.responseText?.toLowerCase()).toContain("resultado");
    expect(decision.conversation.pendingAction).toBe("choose_next_step");
  });

  it("'sim'/confirmação após o caixa entregue devolve o caixa, não 'processando'", async () => {
    const inconsistent = baseState({
      stage: "INGESTING_STATEMENT",
      pendingAction: "wait_ingest",
      lastOutcome: {
        type: "cashflow_statement",
        summary: "Resultado negativo de -R$ 45.000,00",
        dataRef: encodeOutcomeMetrics(negativeMetrics()),
        createdAt: "2026-06-15T10:56:00.000Z",
      },
    });

    const decision = await decideWhatsappConversation(textMsg("sim"), inconsistent);

    expect(decision.responseText?.toLowerCase()).not.toContain("processando");
    expect(decision.responseText?.toLowerCase()).toContain("resultado");
  });

  it("classificador marca pergunta aberta explicativa como candidata a SLM só quando há contexto", () => {
    const withoutContext = classifyWaIntent(
      textMsg("isso está bom?"),
      baseState(),
    );
    const withContext = classifyWaIntent(
      textMsg("isso está bom?"),
      baseState({
        passiveContext: {
          source: "daily_cashflow",
          summary: "Caixa diário enviado",
          createdAt: "2026-06-09T12:00:00.000Z",
          expiresAt: "2026-06-10T12:00:00.000Z",
        },
      }),
    );

    expect(withoutContext.requiresSlm).toBe(false);
    expect(withContext.requiresSlm).toBe(true);
  });
});
