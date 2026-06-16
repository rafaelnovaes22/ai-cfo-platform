import { getSessionStore } from "../session-manager.js"
import type { WaSession } from "../types.js"
import { buildConversationState, withConversationState, type WaPassiveContext } from "./state.js"

export function buildPassiveContext(
  source: WaPassiveContext["source"],
  summary: string,
  ttlMinutes = 60 * 24,
): WaPassiveContext {
  const createdAt = new Date()
  return {
    source,
    summary,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + ttlMinutes * 60_000).toISOString(),
  }
}

export async function storePassiveContext(params: {
  phoneE164: string
  tenantId: string
  source: WaPassiveContext["source"]
  summary: string
  ttlMinutes?: number
}): Promise<void> {
  const store = getSessionStore()
  const existing = await store.get(params.phoneE164)
  const now = new Date().toISOString()
  const session: WaSession = existing ?? {
    phoneE164: params.phoneE164,
    tenantId: params.tenantId,
    step: "MENU",
    context: {},
    createdAt: now,
    updatedAt: now,
  }
  const conversation = buildConversationState({ ...session, tenantId: params.tenantId }, {
    id: params.tenantId,
    name: "",
    plan: "trial",
  })
  const updated = withConversationState(session, {
    ...conversation,
    tenantId: params.tenantId,
    mode: "passive",
    passiveContext: buildPassiveContext(params.source, params.summary, params.ttlMinutes),
    pendingAction: "choose_next_step",
    updatedAt: now,
  })
  await store.set({ ...updated, step: "MENU", tenantId: params.tenantId })
}
