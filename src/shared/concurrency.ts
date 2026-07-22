// Pool de concorrência que preserva a ordem dos resultados (results[i] ↔ items[i]).
// Compartilhado entre o chunk-runner do LangGraph (PR #120) e o classifier BullMQ:
// no Vertex southamerica-east1 (throughput limitado, ADR-009) o wall-clock de N
// chamadas LLM cai para o lote mais lento em vez da soma.
export async function mapWithConcurrency<A, B>(
  items: A[],
  limit: number,
  fn: (item: A, index: number) => Promise<B>,
): Promise<B[]> {
  const results = new Array<B>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]!, i);
    }
  }
  const pool = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(pool);
  return results;
}
