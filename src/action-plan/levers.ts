// Taxonomia fechada de alavancas de CFO. É a CHAVE ESTÁVEL que permite reconciliar
// itens do plano entre regenerações: a cada nova análise sobre todo o histórico, um
// item com a mesma alavanca + horizonte é o "mesmo" item, então preserva aprovação e
// status de execução que a cliente já marcou (ADR-011, plano estável incremental).
//
// É config-level (constante), não tem nada por-tenant (C8). O LLM emite leverKey por
// ação; quando nenhuma alavanca conhecida encaixa, usa "other" e a identidade cai no
// slug do título (ver buildMatchKey).
import { z } from "zod";

export const LEVER_KEYS = [
  "renegotiate_direct_costs",   // renegociar custos diretos / fornecedores de CMV
  "adjust_pricing",             // reajuste / reposicionamento de preço de venda
  "reduce_admin_expenses",      // cortar despesas administrativas não essenciais
  "reduce_legal_accounting",    // renegociar jurídico/contábil
  "reduce_payroll",             // reestruturar folha / pró-labore
  "reduce_financial_expenses",  // reduzir juros/tarifas/dívida cara
  "diversify_revenue",          // diversificar clientes/produtos, reduzir concentração
  "improve_receivables",        // acelerar recebíveis / reduzir inadimplência
  "manage_inventory",           // girar estoque / reduzir capital parado
  "build_cash_reserve",         // criar reserva / proteger runway
  "optimize_process",           // redesenhar processo de produção/serviço
  "tax_efficiency",             // otimização tributária dentro do regime
  "reinvest_growth",            // realocar lucro em crescimento
  "other",                      // fora da taxonomia — identidade pelo slug do título
] as const;

export type LeverKey = (typeof LEVER_KEYS)[number];

export const LeverKeySchema = z.enum(LEVER_KEYS);

function slugifyTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Identidade de reconciliação de um item do plano. Itens com o mesmo matchKey +
 * horizonte são o mesmo item entre regenerações. Para alavancas conhecidas é o
 * próprio leverKey; para "other" cai no slug do título (evita colisão na constraint
 * única quando há mais de um item fora da taxonomia).
 */
export function buildMatchKey(leverKey: string, title: string): string {
  return leverKey === "other" ? `other:${slugifyTitle(title)}` : leverKey;
}
