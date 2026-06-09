import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/observability/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

import { classifyWaIntent } from "@/channels/whatsapp/conversation-graph/intent-classifier.js"
import { decideWhatsappConversation } from "@/channels/whatsapp/conversation-graph/index.js"
import type { WaIncomingMessage } from "@/channels/whatsapp/types.js"
import type { WaConversationState } from "@/channels/whatsapp/conversation-graph/state.js"

function textMsg(text: string): WaIncomingMessage {
  return {
    messageId: `msg-${text}`,
    from: "5511999999999",
    timestamp: "2026-06-09T12:00:00.000Z",
    type: "text",
    text,
  }
}

function baseState(overrides: Partial<WaConversationState> = {}): WaConversationState {
  return {
    phoneE164: "5511999999999",
    tenantId: "tenant-1",
    userName: "Rafael De Novaes",
    plan: "lite",
    stage: "READY_FOR_INPUT",
    mode: "active",
    updatedAt: "2026-06-09T12:00:00.000Z",
    ...overrides,
  }
}

describe("whatsapp conversation graph — deterministic zero-token UX", () => {
  it("interpreta escolha legada '1' como pedido de caixa, mas pede extrato em vez de menu/caixa zerado", async () => {
    const decision = await decideWhatsappConversation(textMsg("1"), baseState())

    expect(decision.intent).toBe("ASK_CASHFLOW")
    expect(decision.usedSlm).toBe(false)
    expect(decision.route).toBe("SEND_TEXT")
    expect(decision.responseText?.toLowerCase()).toContain("extrato")
    expect(decision.responseText?.toLowerCase()).not.toContain("caixa de hoje")
    expect(decision.responseText?.toLowerCase()).not.toContain("r$ 0")
  })

  it("responde 'vc não continua?' com continuação contextual sem reenviar menu", async () => {
    const decision = await decideWhatsappConversation(
      textMsg("Vc nao continua a conversa?"),
      baseState({ stage: "AWAITING_STATEMENT", pendingAction: "send_statement" }),
    )

    expect(decision.intent).toBe("ASK_NEXT_STEP")
    expect(decision.usedSlm).toBe(false)
    expect(decision.responseText?.toLowerCase()).toContain("continuo sim")
    expect(decision.responseText?.toLowerCase()).toContain("extrato")
    expect(decision.responseText?.toLowerCase()).not.toContain("1️⃣")
  })

  it("pergunta explicativa não consome SLM quando a flag está desligada", async () => {
    vi.stubEnv("WHATSAPP_CONVERSATION_SLM_ENABLED", "false")

    const decision = await decideWhatsappConversation(
      textMsg("me explica esse resultado"),
      baseState({
        lastOutcome: {
          type: "cashflow_statement",
          summary: "Resultado positivo de R$ 6.450 no extrato.",
          createdAt: "2026-06-09T12:00:00.000Z",
        },
      }),
    )

    expect(decision.intent).toBe("EXPLAIN_LAST_OUTCOME")
    expect(decision.usedSlm).toBe(false)
    expect(decision.responseText).toContain("Resultado positivo de R$ 6.450")
  })

  it("classificador marca pergunta aberta explicativa como candidata a SLM só quando há contexto", () => {
    const withoutContext = classifyWaIntent(textMsg("isso está bom?"), baseState())
    const withContext = classifyWaIntent(
      textMsg("isso está bom?"),
      baseState({ passiveContext: { source: "daily_cashflow", summary: "Caixa diário enviado", createdAt: "2026-06-09T12:00:00.000Z", expiresAt: "2026-06-10T12:00:00.000Z" } }),
    )

    expect(withoutContext.requiresSlm).toBe(false)
    expect(withContext.requiresSlm).toBe(true)
  })
})
