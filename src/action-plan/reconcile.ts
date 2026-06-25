// Reconciliação do plano estável incremental (ADR-011). A cada regeneração da análise
// canônica do tenant, o LLM propõe um plano novo sobre TODO o histórico. Em vez de
// apagar e recriar (que zerava aprovação e status de execução da cliente), casamos por
// (matchKey, horizonte):
//   - alavanca já existente  -> atualiza o conteúdo, PRESERVA clientApproved/status/comentário
//   - alavanca nova          -> cria item pending
//   - alavanca que sumiu      -> mantém se a cliente está executando/aprovou; senão, superseded
//
// Função pura: não toca no banco nem no relógio. Devolve as operações; o finalize aplica.
import { buildMatchKey } from "@/action-plan/levers.js";

// Status em que a cliente está agindo sobre o item: nunca remover por regeneração.
const ACTIVE_EXECUTION_STATUSES = new Set(["in_progress", "blocked", "done"]);

export interface ExistingPlanItem {
  id: string;
  matchKey: string;
  horizon: string;
  status: string;
  clientApproved: boolean | null;
  supersededAt: Date | null;
}

export interface DraftAction {
  horizon: "short" | "medium" | "long";
  leverKey?: string;
  title: string;
  description: string;
  effortLevel: string;
  riskLevel: string;
  impactCents: number;
  deadlineDays?: number | null;
  doneWhen: string;
}

export interface ReconciledContent {
  leverKey: string;
  matchKey: string;
  horizon: string;
  title: string;
  description: string;
  effortLevel: string;
  riskLevel: string;
  impactCents: number;
  deadlineDays: number | null;
  doneWhen: string;
}

export interface ReconcilePlan {
  toCreate: ReconciledContent[];        // alavancas novas
  toUpdate: { id: string; content: ReconciledContent }[]; // existentes: refresh de conteúdo, estado preservado
  toSupersede: string[];                // ids que somem da lista ativa
}

function contentOf(a: DraftAction): ReconciledContent {
  const leverKey = a.leverKey ?? "other";
  return {
    leverKey,
    matchKey: buildMatchKey(leverKey, a.title),
    horizon: a.horizon,
    title: a.title,
    description: a.description,
    effortLevel: a.effortLevel,
    riskLevel: a.riskLevel,
    impactCents: a.impactCents,
    deadlineDays: a.deadlineDays ?? null,
    doneWhen: a.doneWhen,
  };
}

function shouldKeepWhenDropped(item: ExistingPlanItem): boolean {
  return ACTIVE_EXECUTION_STATUSES.has(item.status) || item.clientApproved === true;
}

export function reconcileActionPlan(
  existing: ExistingPlanItem[],
  draftActions: DraftAction[],
): ReconcilePlan {
  const existingByKey = new Map<string, ExistingPlanItem>();
  for (const item of existing) existingByKey.set(`${item.matchKey}|${item.horizon}`, item);

  const toCreate: ReconciledContent[] = [];
  const toUpdate: { id: string; content: ReconciledContent }[] = [];
  const matchedKeys = new Set<string>();
  const seenDraftKeys = new Set<string>();

  for (const action of draftActions) {
    const content = contentOf(action);
    const key = `${content.matchKey}|${content.horizon}`;
    // LLM pode emitir duplicata da mesma alavanca/horizonte — colidiria na constraint
    // única. Mantém a primeira ocorrência.
    if (seenDraftKeys.has(key)) continue;
    seenDraftKeys.add(key);

    const match = existingByKey.get(key);
    if (match) {
      toUpdate.push({ id: match.id, content });
      matchedKeys.add(key);
    } else {
      toCreate.push(content);
    }
  }

  const toSupersede: string[] = [];
  for (const [key, item] of existingByKey) {
    if (matchedKeys.has(key)) continue;          // reproposto: tratado em toUpdate
    if (shouldKeepWhenDropped(item)) continue;   // cliente executando/aprovou: mantém
    if (item.supersededAt != null) continue;     // já fora da lista ativa
    toSupersede.push(item.id);
  }

  return { toCreate, toUpdate, toSupersede };
}
