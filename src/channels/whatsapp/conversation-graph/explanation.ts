// explanation.ts — leitura determinística (zero-token) do resultado do extrato.
// Transforma os números reais do fluxo de caixa numa explicação de CFO sem LLM.
// É a base do modelo híbrido: free tier recebe esta leitura; planos pagos podem,
// numa fase futura, receber uma narrativa via SLM/LLM por cima destes mesmos dados.
// C8 — nenhuma customização por tenant; texto puramente derivado dos números.

import type { CashflowResponse } from "@/cashflow/types.js"
import { firstName } from "./responses.js"

export interface CashflowMetrics {
  creditsCents: number
  debitsCents: number
  resultCents: number
  creditCount: number
  debitCount: number
  closingBalanceCents: number | null
  startDate: string
  endDate: string
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function cashflowToMetrics(cf: CashflowResponse): CashflowMetrics {
  const creditsCents = cf.summary.totalCreditsCents
  const debitsCents = cf.summary.totalDebitsCents
  return {
    creditsCents,
    debitsCents,
    resultCents: creditsCents - debitsCents,
    creditCount: cf.summary.creditCount,
    debitCount: cf.summary.debitCount,
    closingBalanceCents: cf.summary.closingBalanceCents,
    startDate: cf.period.startDate,
    endDate: cf.period.endDate,
  }
}

/** Serializa as métricas para o campo dataRef do lastOutcome (Redis). */
export function encodeOutcomeMetrics(metrics: CashflowMetrics): string {
  return JSON.stringify(metrics)
}

/** Desserializa as métricas do dataRef. Retorna null se ausente ou inválido. */
export function decodeOutcomeMetrics(dataRef: string | undefined): CashflowMetrics | null {
  if (!dataRef) return null
  try {
    const parsed = JSON.parse(dataRef) as Partial<CashflowMetrics>
    if (typeof parsed.creditsCents !== "number" || typeof parsed.debitsCents !== "number") return null
    if (typeof parsed.resultCents !== "number") return null
    return parsed as CashflowMetrics
  } catch {
    return null
  }
}

/** Resumo curto do resultado, gravado em lastOutcome.summary (não ecoa saudação). */
export function buildCashflowOutcomeSummary(metrics: CashflowMetrics): string {
  const sinal = metrics.resultCents > 0 ? "positivo" : metrics.resultCents < 0 ? "negativo" : "neutro"
  return (
    `Resultado ${sinal} de ${formatBRL(metrics.resultCents)} de ${formatDate(metrics.startDate)} ` +
    `a ${formatDate(metrics.endDate)} (entradas ${formatBRL(metrics.creditsCents)}, ` +
    `saídas ${formatBRL(metrics.debitsCents)}).`
  ).slice(0, 180)
}

/**
 * Snapshot do caixa a partir das métricas já calculadas (zero-token).
 * Responde "como está meu caixa?" mostrando os números, quando a sessão já tem um
 * extrato processado — em vez de pedir o extrato de novo. Distinto da leitura
 * narrativa (formatDeterministicCashflowExplanation), acessível via "me explica".
 */
export function formatCashflowSnapshot(metrics: CashflowMetrics): string {
  const lines: string[] = [
    `📊 *Seu caixa*`,
    `🗓️ ${formatDate(metrics.startDate)} a ${formatDate(metrics.endDate)}`,
    "",
    `⬆️ Entradas: ${formatBRL(metrics.creditsCents)} (${metrics.creditCount} lançamentos)`,
    `⬇️ Saídas: ${formatBRL(metrics.debitsCents)} (${metrics.debitCount} lançamentos)`,
    `${metrics.resultCents >= 0 ? "🟢" : "🔴"} Resultado: ${formatBRL(metrics.resultCents)}`,
  ]

  if (metrics.closingBalanceCents !== null) {
    lines.push(`💰 Saldo final: ${formatBRL(metrics.closingBalanceCents)}`)
  }

  lines.push(
    "",
    `Quer que eu explique esse resultado? É só dizer *me explica*.`,
    `Para atualizar, envie um novo extrato. 📎`,
  )
  return lines.join("\n")
}

/** Frase que descreve quanto as saídas superaram as entradas (resultado negativo). */
function outflowRatioPhrase(creditsCents: number, debitsCents: number): string {
  if (creditsCents <= 0) return "não houve entradas no período, só saídas"
  const ratio = debitsCents / creditsCents
  const ratioStr = ratio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
  if (ratio >= 2) return `as saídas foram mais que o dobro das entradas (${ratioStr}x)`
  if (ratio >= 1.5) return `as saídas foram quase o dobro das entradas (${ratioStr}x)`
  return `as saídas superaram as entradas em ${ratioStr}x`
}

/**
 * Explicação determinística do resultado do extrato, em linguagem de CFO.
 * Sem LLM: deriva tudo dos números. É o que torna "me explica o resultado" útil
 * no free tier (zero custo de inferência).
 */
export function formatDeterministicCashflowExplanation(metrics: CashflowMetrics, name?: string): string {
  const periodo = `de ${formatDate(metrics.startDate)} a ${formatDate(metrics.endDate)}`
  const entradas = formatBRL(metrics.creditsCents)
  const saidas = formatBRL(metrics.debitsCents)
  const abs = formatBRL(Math.abs(metrics.resultCents))
  const greeting = firstName(name)
  const ola = greeting ? `*${greeting}*, ` : ""

  let body: string
  if (metrics.resultCents < 0) {
    const ratio = outflowRatioPhrase(metrics.creditsCents, metrics.debitsCents)
    body =
      `📉 *Leitura do resultado*\n\n` +
      `${ola}no período ${periodo} seu caixa fechou *negativo em ${abs}*.\n` +
      `Entraram ${entradas} e saíram ${saidas}, ou seja, ${ratio}.\n\n` +
      `Na prática, saiu mais dinheiro do que entrou. Se o ritmo se mantiver, o caixa fica pressionado.\n\n` +
      `👉 Próximo passo: revise as maiores saídas para cortar ou adiar o que for possível, ` +
      `e veja se há recebimentos que dá para antecipar.`
  } else if (metrics.resultCents > 0) {
    body =
      `📈 *Leitura do resultado*\n\n` +
      `${ola}no período ${periodo} seu caixa fechou *positivo em ${abs}*.\n` +
      `Entraram ${entradas} e saíram ${saidas}, então sobrou caixa no período.\n\n` +
      `👉 Próximo passo: bom momento para reservar parte do que sobrou e planejar os próximos gastos com folga.`
  } else {
    body =
      `⚖️ *Leitura do resultado*\n\n` +
      `${ola}no período ${periodo} entradas e saídas ficaram empatadas (${entradas} de cada lado), resultado zero.\n\n` +
      `👉 Próximo passo: qualquer gasto extra já joga o caixa para o negativo. Vale abrir uma folga.`
  }

  return `${body}\n\n_Aicfo · leitura automática do seu extrato_`
}
