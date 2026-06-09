import type { WaConversationState } from "./state.js"

export function firstName(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? ""
}

export function formatConversationalWelcome(name: string | undefined): string {
  const greeting = firstName(name)
  return (
    `Olá${greeting ? `, *${greeting}*` : ""}! 👋\n` +
    `Sou o Aicfo, seu CFO-IA.\n\n` +
    `Para começar, me envie um *extrato* da conta em PDF, Excel ou CSV. ` +
    `Eu calculo seu fluxo de caixa do período e te explico o resultado.\n\n` +
    `Se preferir, pode me perguntar algo como:\n` +
    `• “como envio o extrato?”\n` +
    `• “quero saber meu caixa”\n` +
    `• “me explica o resultado”`
  )
}

export function formatCapabilitiesHelp(name: string | undefined): string {
  const greeting = firstName(name)
  return (
    `${greeting ? `*${greeting}*, ` : ""}é simples falar comigo. 💬\n` +
    `Sou o Aicfo, seu CFO-IA, e funciono direto por aqui no WhatsApp.\n\n` +
    `O que eu faço:\n` +
    `• Calculo seu *fluxo de caixa* a partir de um extrato (PDF, Excel ou CSV)\n` +
    `• Mostro entradas, saídas e resultado do período\n` +
    `• Explico o resultado e indico o próximo passo\n\n` +
    `Você fala comigo em linguagem natural, sem comando decorado. Pode escrever, por exemplo:\n` +
    `• “quero ver meu caixa”\n` +
    `• “como envio o extrato?”\n` +
    `• “me explica esse resultado”\n\n` +
    `Para começar agora, me envie um extrato da sua conta aqui no chat. 📎`
  )
}

export function formatStatementRequest(): string {
  return (
    `Consigo te ajudar com o fluxo de caixa.\n\n` +
    `Para calcular com dados reais, me envie um *extrato* da conta em PDF, Excel ou CSV. ` +
    `Assim eu leio entradas, saídas e resultado do período automaticamente.`
  )
}

export function formatStatementHowTo(): string {
  return (
    `É só anexar aqui um extrato em *PDF, Excel ou CSV*. 📎\n\n` +
    `Quando eu receber o arquivo, calculo o fluxo de caixa do período: entradas, saídas e resultado.`
  )
}

export function formatContinuePrompt(conversation?: WaConversationState | null): string {
  if (conversation?.pendingAction === "wait_ingest") {
    return `Continuo sim. Já recebi o arquivo e estou processando. Assim que terminar, te devolvo o fluxo de caixa do período.`
  }

  if (conversation?.lastOutcome?.summary) {
    return (
      `Continuo sim. O último ponto foi: ${conversation.lastOutcome.summary}\n\n` +
      `Posso te ajudar a explicar o resultado ou indicar o próximo passo.`
    )
  }

  if (conversation?.passiveContext?.summary) {
    return (
      `Continuo sim. Sobre a última atualização: ${conversation.passiveContext.summary}\n\n` +
      `Se quiser, posso explicar ou orientar o próximo passo.`
    )
  }

  return (
    `Continuo sim. O próximo passo é você me enviar um *extrato* da conta por aqui.\n` +
    `Com ele eu calculo o fluxo de caixa real e te devolvo entradas, saídas e resultado do período.`
  )
}

export function formatLegacyMenuChoiceHint(): string {
  return (
    `Pra calcular seu caixa agora, preciso de um extrato.\n\n` +
    `Me envie um PDF, Excel ou CSV por aqui que eu calculo o período automaticamente.`
  )
}

export function formatContextualFallback(conversation?: WaConversationState | null): string {
  if (conversation?.pendingAction === "send_statement" || conversation?.stage === "AWAITING_STATEMENT") {
    return formatContinuePrompt(conversation)
  }

  if (conversation?.lastOutcome || conversation?.passiveContext) {
    return formatContinuePrompt(conversation)
  }

  return formatStatementRequest()
}

export function formatHumanSupportHint(): string {
  return (
    `Posso te orientar por aqui. Se precisar de suporte humano, acesse o app ou fale com o time Acme.\n\n` +
    `Enquanto isso, se quiser calcular o caixa, me envie um extrato em PDF, Excel ou CSV.`
  )
}

export function formatSlmDisabledExplanation(conversation?: WaConversationState | null): string {
  if (conversation?.lastOutcome?.summary) {
    return (
      `${conversation.lastOutcome.summary}\n\n` +
      `Para uma explicação mais completa, posso analisar esse resultado em seguida. Por ora, o próximo passo recomendado é conferir entradas, saídas e resultado do período.`
    )
  }
  return formatStatementRequest()
}
