import { Annotation, END, START, StateGraph } from "@langchain/langgraph"

import type { WaIncomingMessage } from "../types.js"
import { classifyWaIntent, type WaIntentClassification } from "./intent-classifier.js"
import {
  formatContextualFallback,
  formatContinuePrompt,
  formatConversationalWelcome,
  formatHumanSupportHint,
  formatLegacyMenuChoiceHint,
  formatSlmDisabledExplanation,
  formatStatementHowTo,
  formatStatementRequest,
} from "./responses.js"
import type { WaConversationState, WaIntent } from "./state.js"

export type WaConversationRoute =
  | "SEND_TEXT"
  | "HANDLE_DOCUMENT"
  | "STATUS"
  | "MONTHLY_ANALYSIS"
  | "NEED_SLM"

export interface WaConversationDecision {
  intent: WaIntent
  route: WaConversationRoute
  responseText?: string
  conversation: WaConversationState
  usedSlm: boolean
}

interface GraphState {
  msg: WaIncomingMessage
  conversation: WaConversationState
  classification?: WaIntentClassification
  intent?: WaIntent
  route?: WaConversationRoute
  responseText?: string
  usedSlm?: boolean
}

const WhatsAppConversationAnnotation = Annotation.Root({
  msg: Annotation<WaIncomingMessage>(),
  conversation: Annotation<WaConversationState>(),
  classification: Annotation<WaIntentClassification | undefined>(),
  intent: Annotation<WaIntent | undefined>(),
  route: Annotation<WaConversationRoute | undefined>(),
  responseText: Annotation<string | undefined>(),
  usedSlm: Annotation<boolean | undefined>(),
})

function classifyIntentNode(state: GraphState): Partial<GraphState> {
  const classification = classifyWaIntent(state.msg, state.conversation)
  return { classification, intent: classification.intent }
}

function routeDeterministicNode(state: GraphState): Partial<GraphState> {
  const intent = state.intent ?? "UNKNOWN"
  const conversation = {
    ...state.conversation,
    lastIntent: intent,
    updatedAt: new Date().toISOString(),
  }

  switch (intent) {
    case "DOCUMENT_RECEIVED":
      return {
        conversation: { ...conversation, stage: "INGESTING_STATEMENT", pendingAction: "wait_ingest" },
        route: "HANDLE_DOCUMENT",
        usedSlm: false,
      }

    case "GREETING":
      return {
        conversation: { ...conversation, stage: "AWAITING_STATEMENT", pendingAction: "send_statement" },
        route: "SEND_TEXT",
        responseText: formatConversationalWelcome(conversation.userName),
        usedSlm: false,
      }

    case "SEND_STATEMENT_HELP":
      return {
        conversation: { ...conversation, stage: "AWAITING_STATEMENT", pendingAction: "send_statement" },
        route: "SEND_TEXT",
        responseText: formatStatementHowTo(),
        usedSlm: false,
      }

    case "ASK_CASHFLOW":
      return {
        conversation: { ...conversation, stage: "AWAITING_STATEMENT", pendingAction: "send_statement" },
        route: "SEND_TEXT",
        responseText: formatStatementRequest(),
        usedSlm: false,
      }

    case "ASK_NEXT_STEP":
    case "CONFIRMATION":
      return {
        conversation: { ...conversation, pendingAction: conversation.pendingAction ?? "send_statement" },
        route: "SEND_TEXT",
        responseText: formatContinuePrompt(conversation),
        usedSlm: false,
      }

    case "ASK_STATUS":
      return { conversation, route: "STATUS", usedSlm: false }

    case "ASK_MONTHLY_ANALYSIS":
      return { conversation, route: "MONTHLY_ANALYSIS", usedSlm: false }

    case "HUMAN_SUPPORT":
      return {
        conversation,
        route: "SEND_TEXT",
        responseText: formatHumanSupportHint(),
        usedSlm: false,
      }

    case "EXPLAIN_LAST_OUTCOME":
      if (state.classification?.requiresSlm && process.env.WHATSAPP_CONVERSATION_SLM_ENABLED === "true") {
        return { conversation, route: "NEED_SLM", usedSlm: false }
      }
      return {
        conversation,
        route: "SEND_TEXT",
        responseText: formatSlmDisabledExplanation(conversation),
        usedSlm: false,
      }

    case "NEGATION":
      return {
        conversation: { ...conversation, pendingAction: undefined },
        route: "SEND_TEXT",
        responseText: `Tudo bem. Quando quiser calcular seu caixa, é só me enviar um extrato em PDF, Excel ou CSV.`,
        usedSlm: false,
      }

    case "UNKNOWN":
    case "AUTH_HELP":
    default:
      return {
        conversation: { ...conversation, stage: "AWAITING_STATEMENT", pendingAction: "send_statement" },
        route: "SEND_TEXT",
        responseText: formatContextualFallback(conversation),
        usedSlm: false,
      }
  }
}

function slmPlaceholderNode(state: GraphState): Partial<GraphState> {
  // Phase 1: o grafo já separa o caminho SLM, mas não consome tokens ainda.
  // Phase 2 trocará este placeholder por chamada controlada ao SLM com budget.
  return {
    route: "SEND_TEXT",
    responseText: formatSlmDisabledExplanation(state.conversation),
    usedSlm: false,
  }
}

function routeAfterDeterministic(state: GraphState): "slm" | typeof END {
  return state.route === "NEED_SLM" ? "slm" : END
}

export function buildWhatsappConversationGraph() {
  return new StateGraph(WhatsAppConversationAnnotation)
    .addNode("classify", classifyIntentNode)
    .addNode("deterministic", routeDeterministicNode)
    .addNode("slm", slmPlaceholderNode)
    .addEdge(START, "classify")
    .addEdge("classify", "deterministic")
    .addConditionalEdges("deterministic", routeAfterDeterministic, { slm: "slm", [END]: END })
    .addEdge("slm", END)
    .compile()
}

let compiledGraph: ReturnType<typeof buildWhatsappConversationGraph> | null = null

export async function decideWhatsappConversation(
  msg: WaIncomingMessage,
  conversation: WaConversationState,
): Promise<WaConversationDecision> {
  compiledGraph ??= buildWhatsappConversationGraph()
  const result = await compiledGraph.invoke({ msg, conversation })
  return {
    intent: result.intent ?? "UNKNOWN",
    route: result.route ?? "SEND_TEXT",
    responseText: result.responseText,
    conversation: result.conversation,
    usedSlm: result.usedSlm === true,
  }
}

export function isLegacyNumericChoice(text: string | undefined): boolean {
  return text === "1" || text === "2"
}

export { formatLegacyMenuChoiceHint }
