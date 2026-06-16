// Formata dados financeiros do Aicfo para envio via WhatsApp (texto simples).
// WhatsApp suporta: *negrito*, _itálico_, `código` — sem HTML, sem headers Markdown.
// C8 — nenhuma customização por tenant; formatação determinística.

import type { CashflowSummaryDay } from "../../cashflow/types.js"

// ── Helpers internos ──────────────────────────────────────────────────────────

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })
}

function formatDate(iso: string): string {
  // Aceita YYYY-MM-DD ou ISO 8601 completo
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function formatBalance(cents: number | null): string {
  return cents === null ? "—" : formatBRL(cents)
}

// ── Funções exportadas ────────────────────────────────────────────────────────

/**
 * Formata o resumo diário de caixa para WhatsApp.
 *
 * Exemplo:
 * 📊 *Caixa de hoje — 29/05/2026*
 *
 * 💰 Saldo: R$ 10.000,00
 * ⬆️ Entradas: R$ 3.600,00 (9 lançamentos)
 * ⬇️ Saídas: R$ 6.040,00 (30 lançamentos)
 *
 * _Aicfo · Dados até agora_
 */
export function formatCashflowSummary(data: CashflowSummaryDay): string {
  const lines: string[] = [
    `📊 *Caixa de hoje — ${formatDate(data.date)}*`,
    "",
    `💰 Saldo: ${formatBalance(data.balanceCents)}`,
    `⬆️ Entradas: ${formatBRL(data.creditsCents)}`,
    `⬇️ Saídas: ${formatBRL(data.debitsCents)}`,
    "",
    "_Aicfo · Dados até agora_",
  ]
  return lines.join("\n")
}

/**
 * Formata resumo de período (7 dias, mês, trimestre).
 * Recebe o body do GET /cashflow.
 */
export function formatCashflowPeriod(data: {
  period: { startDate: string; endDate: string; granularity: string }
  summary: {
    openingBalanceCents: number | null
    closingBalanceCents: number | null
    totalCreditsCents: number
    totalDebitsCents: number
    creditCount: number
    debitCount: number
  }
}): string {
  const { period, summary } = data
  const start = formatDate(period.startDate)
  const end = formatDate(period.endDate)

  const lines: string[] = [
    `📊 *Fluxo de caixa — ${start} a ${end}*`,
    "",
    `💰 Saldo inicial: ${formatBalance(summary.openingBalanceCents)}`,
    `💰 Saldo final: ${formatBalance(summary.closingBalanceCents)}`,
    `⬆️ Entradas: ${formatBRL(summary.totalCreditsCents)} (${summary.creditCount} lançamentos)`,
    `⬇️ Saídas: ${formatBRL(summary.totalDebitsCents)} (${summary.debitCount} lançamentos)`,
    "",
    "_Aicfo · Resumo do período_",
  ]
  return lines.join("\n")
}

/**
 * Formata mensagem de boas-vindas / menu principal.
 * Plano "student" recebe menu reduzido; "lite", "pro" e "business" recebem menu completo.
 */
export function formatWelcomeMenu(tenantName: string, plan: string): string {
  const isBasic = plan === "student"

  const header = `Olá, *${tenantName}*! 👋\nSou o Aicfo, seu CFO-IA.\n`

  if (isBasic) {
    // Free tier do aluno é baseado em extrato pontual (não há dado contínuo).
    // "Caixa de hoje"/"semana" voltariam R$ 0,00, então o menu é centrado no extrato.
    return (
      header +
      "Me envie um *extrato* da sua conta (PDF, Excel ou CSV) e eu calculo o seu " +
      "*fluxo de caixa* na hora: entradas, saídas e resultado do período.\n\n" +
      "_É só enviar o arquivo aqui._ 📎"
    )
  }

  return (
    header +
    "O que posso fazer por você?\n\n" +
    "1️⃣ Ver caixa de hoje\n" +
    "2️⃣ Resumo dos últimos 7 dias\n" +
    "3️⃣ Ver análise do mês\n\n" +
    "Ou envie um extrato / planilha (PDF, Excel ou CSV) para importar lançamentos.\n\n" +
    "_Responda com o número da opção._"
  )
}

/**
 * Dica para o aluno (free tier) que pede caixa/semana: o canal não tem dado
 * contínuo, o caixa vem do extrato enviado. Evita devolver R$ 0,00 confuso.
 */
export function formatStudentCashflowHint(): string {
  return (
    "📎 Pra ver seu fluxo de caixa, me envie um *extrato* da sua conta (PDF, Excel ou CSV).\n\n" +
    "Eu calculo entradas, saídas e resultado do período na hora."
  )
}

/**
 * Formata mensagem de erro amigável para o usuário final.
 */
export function formatError(
  code: "NOT_FOUND" | "NO_DATA" | "PLAN_LIMIT" | "GENERIC",
): string {
  const messages: Record<typeof code, string> = {
    NOT_FOUND:
      "⚠️ Não encontrei sua conta Aicfo.\nCadastre-se em aicfo.ai e volte aqui.",
    NO_DATA:
      "⚠️ Sem dados financeiros para o período.\nImporte seus lançamentos pelo app ou envie um arquivo aqui.",
    PLAN_LIMIT:
      "⚠️ Esta função não está disponível no seu plano atual.\nAcesse aicfo.ai para fazer upgrade.",
    GENERIC:
      "⚠️ Ocorreu um erro inesperado.\nTente novamente em instantes ou acesse aicfo.ai para suporte.",
  }
  return messages[code]
}

/**
 * Formata confirmação de recebimento de arquivo para ingest.
 */
export function formatIngestReceived(filename: string, studentPlan = false): string {
  // Canal reativo: NÃO prometer notificação proativa (ela está desligada). O usuário
  // pede "análise" aqui ou acessa o app para ver quando ficar pronta.
  const body = studentPlan
    ? "Já estou lendo seus lançamentos e calculando o fluxo de caixa do extrato. Um instante…"
    : "Estou processando os lançamentos. Quando a análise ficar pronta, peça *análise* aqui ou acesse o app para ver."
  return `✅ *Arquivo recebido!*\n\n📄 ${filename}\n\n${body}`
}

/**
 * Formata o fluxo de caixa calculado a partir de um extrato enviado pelo aluno.
 * Usa o período real (range de datas) dos lançamentos do arquivo, não um mês fixo.
 * Mostra o resultado do período (entradas − saídas), sempre calculável; o saldo
 * final só aparece quando há saldo inicial conhecido.
 */
export function formatCashflowStatement(data: {
  period: { startDate: string; endDate: string }
  summary: {
    closingBalanceCents: number | null
    totalCreditsCents: number
    totalDebitsCents: number
    creditCount: number
    debitCount: number
  }
}): string {
  const { period, summary } = data
  const resultCents = summary.totalCreditsCents - summary.totalDebitsCents

  const lines: string[] = [
    `📊 *Fluxo de caixa do extrato*`,
    `🗓️ ${formatDate(period.startDate)} a ${formatDate(period.endDate)}`,
    "",
    `⬆️ Entradas: ${formatBRL(summary.totalCreditsCents)} (${summary.creditCount} lançamentos)`,
    `⬇️ Saídas: ${formatBRL(summary.totalDebitsCents)} (${summary.debitCount} lançamentos)`,
    `${resultCents >= 0 ? "🟢" : "🔴"} Resultado: ${formatBRL(resultCents)}`,
  ]

  if (summary.closingBalanceCents !== null) {
    lines.push(`💰 Saldo final: ${formatBRL(summary.closingBalanceCents)}`)
  }

  lines.push("", "_Aicfo · Calculado a partir do seu extrato_")
  return lines.join("\n")
}

/**
 * Formata notificação de análise financeira pronta.
 * @param referenceMonth - mês de referência no formato YYYY-MM ou nome legível (ex: "maio/2026")
 */
export function formatAnalysisReady(referenceMonth: string): string {
  return (
    `✅ *Análise pronta — ${referenceMonth}*\n\n` +
    "Sua análise financeira mensal está disponível.\n" +
    "Acesse o app para ver o DRE, os cards de leitura e seu Plano de Ação.\n\n" +
    "_Aicfo · CFO-IA_"
  )
}
