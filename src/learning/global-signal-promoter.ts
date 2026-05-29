// ADR-011 §2 — Promoção de sinal per-tenant para pool global.
// Um fact só sobe quando ≥5 tenants independentes do mesmo segmento convergem.
// C8: nenhum if(tenantId) — lógica é data-driven sobre TenantMemoryItem.
import { getPrisma } from "@/persistence/prisma.js";
import { logger } from "@/observability/logger.js";

export const MIN_GLOBAL_CONTRIBUTORS = 5; // k-anonimidade mínima (LGPD)

// Verifica se um novo fact tem concordância suficiente para subir ao pool global.
// Busca todos os facts de kind="fact" do mesmo segmento e filtra por description+category.
// Se ≥5 tenants distintos convergiram: cria ou atualiza GlobalSignal e marca os TenantMemoryItems.
export async function checkAndPromoteToGlobal(
  tenantId: string,
  segment: string,
  description: string,
  category: string,
): Promise<void> {
  const db = getPrisma();
  const normalizedDesc = description.toLowerCase().trim();

  // Carrega todos os facts não-descartados do mesmo segmento (volume baixo em PILOT)
  const candidateFacts = await db.tenantMemoryItem.findMany({
    where: {
      kind: "fact",
      dismissedAt: null,
      tenant: { industrySegment: segment },
    },
    select: { id: true, tenantId: true, content: true, contributesToGlobal: true, globalSignalId: true },
  });

  // Filtra por description + category em memória (evita JSON-path queries não-portáveis)
  const matchingFacts = candidateFacts.filter((f) => {
    const c = f.content as Record<string, unknown>;
    return (
      typeof c.description === "string" &&
      c.description.toLowerCase().trim() === normalizedDesc &&
      c.category === category
    );
  });

  const distinctTenants = new Set(matchingFacts.map((f) => f.tenantId));

  if (distinctTenants.size < MIN_GLOBAL_CONTRIBUTORS) return; // k-anonimidade não atingida

  // Verifica se já existe um GlobalSignal para este padrão
  const existingSignalId = matchingFacts.find((f) => f.globalSignalId !== null)?.globalSignalId ?? null;

  let signalId: string;

  if (existingSignalId) {
    await db.globalSignal.update({
      where: { id: existingSignalId },
      data: { contributorCount: distinctTenants.size },
    });
    signalId = existingSignalId;
  } else {
    const signal = await db.globalSignal.create({
      data: {
        segment,
        kind: "fact",
        content: { description: normalizedDesc, category },
        contributorCount: distinctTenants.size,
      },
    });
    signalId = signal.id;

    logger.info(
      { signalId, segment, category, contributorCount: distinctTenants.size },
      "global-signal: novo sinal promovido ao pool global",
    );
  }

  // Marca todos os facts correspondentes como contribuintes
  const idsToLink = matchingFacts
    .filter((f) => !f.contributesToGlobal || f.globalSignalId !== signalId)
    .map((f) => f.id);

  if (idsToLink.length > 0) {
    await db.tenantMemoryItem.updateMany({
      where: { id: { in: idsToLink } },
      data: { contributesToGlobal: true, globalSignalId: signalId },
    });
  }
}

// Chamado antes de deletar um tenant (LGPD). Verifica quais GlobalSignals ficariam
// abaixo do limiar k=5 e os retira do pool (C7: buildTenantContext ignora retiredAt != null).
export async function retireGlobalSignalsForTenant(tenantId: string): Promise<void> {
  const db = getPrisma();

  const contributedItems = await db.tenantMemoryItem.findMany({
    where: { tenantId, contributesToGlobal: true, globalSignalId: { not: null } },
    select: { globalSignalId: true },
  });

  const signalIds = [...new Set(contributedItems.map((i) => i.globalSignalId!))];
  if (signalIds.length === 0) return;

  for (const signalId of signalIds) {
    // Conta contribuintes restantes excluindo este tenant
    const remainingCount = await db.tenantMemoryItem.count({
      where: {
        globalSignalId: signalId,
        tenantId: { not: tenantId },
        dismissedAt: null,
      },
    });

    if (remainingCount < MIN_GLOBAL_CONTRIBUTORS) {
      await db.globalSignal.update({
        where: { id: signalId },
        data: { retiredAt: new Date(), contributorCount: remainingCount },
      });
      logger.warn(
        { signalId, remainingCount },
        "global-signal: retirado — k-anonimidade não mantida após remoção de tenant",
      );
    } else {
      await db.globalSignal.update({
        where: { id: signalId },
        data: { contributorCount: remainingCount },
      });
    }
  }
}
