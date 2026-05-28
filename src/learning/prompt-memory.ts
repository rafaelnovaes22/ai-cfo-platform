// ADR-011 §7 — Bandit de prompts via Thompson Sampling.
// Seleciona a variante de prompt com melhor desempenho esperado a partir de
// histórico de ValidationMetrics (positivo/negativo) acumuladas por variante.
//
// Estado em memória por processo. Em deploy multi-instância, persistir alpha/beta
// em Redis ou na tabela GlobalSignal antes de ativar múltiplos workers.
// C8: lógica data-driven — sem if(tenantId) nem if(variantId === 'X').

export interface VariantStats {
  id: string;
  alpha: number; // outcomes positivos (cliente não corrigiu / aprovou)
  beta: number;  // outcomes negativos (cliente corrigiu / rejeitou)
}

// ── Thompson Sampling ─────────────────────────────────────────────────────

// Amostra da distribuição Beta(alpha, beta) via método de Johnk.
// Funciona corretamente para alpha ≥ 1 e beta ≥ 1 (nosso caso — prior uniforme).
function sampleBeta(alpha: number, beta: number): number {
  for (let i = 0; i < 1000; i++) {
    const x = Math.pow(Math.random(), 1 / alpha);
    const y = Math.pow(Math.random(), 1 / beta);
    if (x + y <= 1) return x / (x + y);
  }
  return alpha / (alpha + beta); // fallback para a média (não deve ocorrer)
}

// Seleciona a variante com a maior amostra da distribuição Beta — explora variantes
// menos testadas e explota as mais promissoras conforme o histórico cresce.
export function selectVariantByBandit(variants: VariantStats[]): VariantStats {
  if (variants.length === 0) throw new Error("selectVariantByBandit: nenhuma variante fornecida");
  if (variants.length === 1) return variants[0];

  let best = variants[0];
  let bestSample = sampleBeta(Math.max(best.alpha, 1), Math.max(best.beta, 1));

  for (let i = 1; i < variants.length; i++) {
    const v = variants[i];
    const sample = sampleBeta(Math.max(v.alpha, 1), Math.max(v.beta, 1));
    if (sample > bestSample) {
      best = v;
      bestSample = sample;
    }
  }

  return best;
}

// ── Estado em memória ──────────────────────────────────────────────────────

const _store = new Map<string, VariantStats>();

function storeKey(agentName: string, variantId: string): string {
  return `${agentName}::${variantId}`;
}

export function getOrInitVariant(agentName: string, variantId: string): VariantStats {
  const key = storeKey(agentName, variantId);
  if (!_store.has(key)) {
    _store.set(key, { id: variantId, alpha: 1, beta: 1 }); // prior uniforme Beta(1,1)
  }
  return _store.get(key)!;
}

// Registra o resultado de um outcome para uma variante.
// Chamado pelo SelfHarnessWorker quando um ValidationMetric é escrito.
export function recordVariantOutcome(agentName: string, variantId: string, positive: boolean): void {
  const stats = getOrInitVariant(agentName, variantId);
  if (positive) {
    stats.alpha += 1;
  } else {
    stats.beta += 1;
  }
}

// Retorna o ID da variante com maior amostra Beta entre as fornecidas.
// `variantIds` deve conter as variantes conhecidas para o agente.
export function selectBestVariant(agentName: string, variantIds: string[]): string {
  if (variantIds.length === 0) throw new Error("selectBestVariant: nenhum variantId fornecido");
  const variants = variantIds.map((id) => getOrInitVariant(agentName, id));
  return selectVariantByBandit(variants).id;
}

// Retorna snapshot do estado atual — útil para monitoramento/debug.
export function getVariantStats(agentName: string, variantId: string): VariantStats {
  return getOrInitVariant(agentName, variantId);
}

// Para testes — reseta o estado em memória.
export function _resetStore(): void {
  _store.clear();
}
