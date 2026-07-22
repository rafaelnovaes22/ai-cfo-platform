// src/learning/tenant-context.ts
//
// C5 (Three-tier context): este módulo é L1 — lê dados do Tenant e sua memória acumulada.
// NUNCA leia dados de análise individual (L2) aqui.
// C8: nenhum if/switch por tenantId — toda lógica é data-driven.
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";

export interface TenantMemoryContext {
  facts: Array<{ content: unknown; confidence: number }>;
  preferences: Array<{ content: unknown }>;
  patterns: Array<{ content: unknown; confidence: number }>;
  globalSignals: Array<{ content: unknown }>;
}

const MAX_MEMORY_ITEMS = 50; // limite para não estourar contexto do LLM
const MIN_GLOBAL_CONTRIBUTORS = 5; // k-anonimidade mínima (LGPD — não revelar padrões de poucos tenants)

export async function buildTenantContext(
  tenantId: string,
  segment: string,
): Promise<TenantMemoryContext> {
  const db = getPrisma();

  const [memoryItems, globalSignals] = await Promise.all([
    db.tenantMemoryItem.findMany({
      where: {
        tenantId,
        dismissedAt: null, // excluir items descartados pelo cliente
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { kind: true, content: true, confidence: true },
      orderBy: { createdAt: "desc" },
      take: MAX_MEMORY_ITEMS,
    }),
    db.globalSignal.findMany({
      where: {
        segment,
        retiredAt: null,
        contributorCount: { gte: MIN_GLOBAL_CONTRIBUTORS },
      },
      select: { content: true },
      take: 20,
    }),
  ]);

  const ctx: TenantMemoryContext = {
    facts: memoryItems
      .filter((m) => m.kind === "fact")
      .map((m) => ({ content: m.content, confidence: m.confidence })),
    preferences: memoryItems
      .filter((m) => m.kind === "preference")
      .map((m) => ({ content: m.content })),
    patterns: memoryItems
      .filter((m) => m.kind === "pattern")
      .map((m) => ({ content: m.content, confidence: m.confidence })),
    globalSignals: globalSignals.map((g) => ({ content: g.content })),
  };

  logger.debug(
    {
      tenantId,
      segment,
      factsCount: ctx.facts.length,
      preferencesCount: ctx.preferences.length,
      patternsCount: ctx.patterns.length,
      globalCount: ctx.globalSignals.length,
    },
    "learning.tenant-context: contexto montado",
  );

  return ctx;
}
