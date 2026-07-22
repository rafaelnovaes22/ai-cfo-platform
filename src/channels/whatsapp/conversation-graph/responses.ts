import type { WaConversationState } from "./state.js"

export function firstName(name: string | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? ""
}

// Voz do Aicfo no WhatsApp: CFO-IA, parceiro do dono de PME. Direto, adulto,
// confiante. A lista de formatos aceitos (PDF, Excel ou CSV) aparece só onde faz
// sentido no estágio (saudação inicial e how-to de envio), nunca em toda resposta
// — repetir "envie um extrato em PDF, Excel ou CSV" soa como bot travado.

export function formatConversationalWelcome(name: string | undefined): string {
  const greeting = firstName(name)
  return (
    `Olá${greeting ? `, *${greeting}*` : ""}! 👋\n` +
    `Sou o Aicfo, seu CFO-IA. Leio o extrato da sua conta e te mostro o caixa do período em segundos: quanto entrou, quanto saiu e o resultado.\n\n` +
    `Para começar, me envie um *extrato* em PDF, Excel ou CSV. 📎\n\n` +
    `Ou fale comigo do seu jeito, por exemplo:\n` +
    `• “como envio o extrato?”\n` +
    `• “quanto sobrou esse mês?”\n` +
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
    `Quando quiser começar, é só me mandar um extrato aqui no chat. 📎`
  )
}

export function formatStatementRequest(): string {
  // ASK_CASHFLOW sem dados na sessão. Menciona "extrato" (sem repetir os formatos,
  // que já aparecem na saudação e no how-to).
  return (
    `Te mostro o caixa na hora, mas preciso dos números primeiro. 📊\n\n` +
    `Me manda um *extrato* da conta aqui no chat e eu calculo entradas, saídas e resultado do período automaticamente.`
  )
}

export function formatStatementHowTo(): string {
  // O how-to é o lugar certo para listar os formatos aceitos.
  return (
    `É só anexar aqui um extrato em *PDF, Excel ou CSV*. 📎\n\n` +
    `Assim que o arquivo chegar, eu calculo o fluxo de caixa do período: entradas, saídas e resultado.`
  )
}

export function formatContinuePrompt(conversation?: WaConversationState | null): string {
  if (conversation?.pendingAction === "wait_ingest") {
    return `Continuo sim. Já recebi o arquivo e estou processando. Assim que terminar, te devolvo o caixa do período.`
  }

  if (conversation?.lastOutcome?.summary) {
    return (
      `Continuo sim. O último ponto foi: ${conversation.lastOutcome.summary}\n\n` +
      `Posso explicar o resultado ou indicar o próximo passo. É só dizer.`
    )
  }

  if (conversation?.passiveContext?.summary) {
    return (
      `Continuo sim. Sobre a última atualização: ${conversation.passiveContext.summary}\n\n` +
      `Se quiser, eu explico ou oriento o próximo passo.`
    )
  }

  return (
    `Continuo sim. O próximo passo é me enviar um *extrato* da conta por aqui.\n` +
    `Com ele eu calculo o caixa real e te devolvo entradas, saídas e resultado do período.`
  )
}

export function formatLegacyMenuChoiceHint(): string {
  return (
    `Para calcular seu caixa, eu preciso de um extrato.\n\n` +
    `Me envie um aqui pelo chat que eu processo o período automaticamente.`
  )
}

export function formatContextualFallback(conversation?: WaConversationState | null): string {
  if (conversation?.pendingAction === "send_statement" || conversation?.stage === "AWAITING_STATEMENT") {
    return formatContinuePrompt(conversation)
  }

  if (conversation?.lastOutcome || conversation?.passiveContext) {
    return formatContinuePrompt(conversation)
  }

  // Sem contexto e sem intenção reconhecida: assume que não entendeu, em vez de
  // despejar o pedido de extrato como se fosse resposta.
  return (
    `Não tenho certeza se peguei o que você quis dizer. 🤔\n\n` +
    `Eu sou bom em uma coisa: ler seu extrato e te mostrar o caixa do período. ` +
    `Se quiser, me manda um extrato, ou pergunta “o que você faz?” que eu te explico.`
  )
}

export function formatSocialAck(conversation?: WaConversationState | null): string {
  // Agradecimento/elogio não pode receber resposta robótica pedindo extrato.
  const name = firstName(conversation?.userName)
  return (
    `De nada${name ? `, *${name}*` : ""}! 👊\n` +
    `Estou por aqui quando precisar. É só chamar para ver o caixa, pedir a análise do mês ou tirar dúvida sobre um resultado.`
  )
}

export function formatNegationAck(): string {
  // NEGATION ("agora não", "depois eu vejo"). Sem empurrar formatos.
  return `Tranquilo. Quando quiser ver seu caixa, é só me chamar por aqui. 👍`
}

export function formatOutOfScope(): string {
  // Coisas que o Aicfo não faz (emitir nota, pagar boleto, contabilidade).
  // Reconhece com honestidade e redireciona para o outcome real. Sem listar formatos.
  return (
    `Isso aí foge do que eu faço. Emitir nota, pagar boleto e contabilidade ficam com seu contador. 🙂\n\n` +
    `O meu forte é o *caixa*: eu leio seu extrato e te mostro quanto entrou, quanto saiu e o resultado do período. ` +
    `Quer ver o seu?`
  )
}

export function formatHumanSupportHint(): string {
  return (
    `Posso resolver boa parte por aqui. 💬\n\n` +
    `Se precisar mesmo de uma pessoa do time, acesse o app ou fale com o suporte Novais Digital. ` +
    `Enquanto isso, me diz o que você quer saber do seu caixa que eu já adianto.`
  )
}

export function formatSlmDisabledExplanation(conversation?: WaConversationState | null): string {
  if (conversation?.lastOutcome?.summary) {
    return (
      `${conversation.lastOutcome.summary}\n\n` +
      `Posso destrinchar esse resultado com você. Por ora, vale conferir entradas, saídas e o resultado do período.`
    )
  }
  return formatStatementRequest()
}
