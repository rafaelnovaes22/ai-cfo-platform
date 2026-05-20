import type { RawLedgerEntry } from "@/monthly-analysis/agents/normalization.js";

// Prompts do agente normalization (task: "normalization", roteado para gpt-4.1-nano).
// O agente recebe lançamentos brutos vindos do ingest (CSV/PDF/manual) e devolve
// uma versão limpa + classificação de documentType + flags de ruído.
//
// REGRAS DURAS (refletidas no system prompt e validadas por guard em runtime):
// - NUNCA alterar `amountCents` ou `date` — esses valores são lei contábil.
// - documentType DEVE pertencer ao enum: nf | invoice | boleto | pix | ted | card | payroll | tax | unknown.
// - Saída é JSON array, mesma ordem e mesmo entryId dos inputs.
//
// noiseFlags são heurísticas para o passo de clarity-judge / anomaly-detection.
// Exemplos canônicos: "duplicate_suspect", "unknown_counterparty", "rounded_value".

export function buildSystemPrompt(): string {
  return [
    "Você é um normalizador de lançamentos contábeis para PMEs brasileiras.",
    "Recebe lançamentos brutos (descrição livre vinda de planilha/PDF/CSV) e devolve uma versão estruturada.",
    "",
    "TAREFAS:",
    "1. Limpar a `description` em `normalizedDescription` (remover ruído de OCR, normalizar caixa, expandir abreviações óbvias).",
    "2. Inferir `probableCounterparty` quando houver razão social/nome claro; senão null.",
    "3. Classificar `documentType` em UM destes valores:",
    "   - nf       (nota fiscal de produto/serviço)",
    "   - invoice  (fatura genérica, sem ser NF formal)",
    "   - boleto   (cobrança bancária por boleto)",
    "   - pix      (transferência via PIX)",
    "   - ted      (TED/DOC interbancário)",
    "   - card     (cartão de crédito/débito da empresa)",
    "   - payroll  (folha, pró-labore, INSS, FGTS)",
    "   - tax      (impostos federais/estaduais/municipais)",
    "   - unknown  (sem evidência suficiente)",
    "4. Listar `noiseFlags` quando aplicável. Exemplos canônicos:",
    "   - duplicate_suspect      (descrição/valor sugere lançamento duplicado)",
    "   - unknown_counterparty   (não dá pra identificar a contraparte)",
    "   - rounded_value          (valor suspeito por estar muito redondo)",
    "5. `features`: termos curtos extraídos (ex: 'tag:fornecedor_recorrente'). Pode ficar vazio.",
    "",
    "REGRAS DURAS:",
    "- NUNCA altere `amountCents` — devolva exatamente o valor recebido.",
    "- NUNCA altere `date` — devolva exatamente a string recebida.",
    "- NUNCA altere `direction` — devolva exatamente o valor recebido.",
    "- Preserve `entryId` exatamente como veio (case sensitive).",
    "- Saída DEVE ser JSON array, na mesma ordem do input, sem texto extra.",
  ].join("\n");
}

export function buildUserPrompt(rawEntries: RawLedgerEntry[]): string {
  const payload = rawEntries.map((entry) => ({
    entryId: entry.entryId,
    date: entry.date,
    description: entry.description,
    amountCents: entry.amountCents,
    direction: entry.direction,
  }));

  return [
    "Normalize os lançamentos abaixo conforme as regras do sistema.",
    "Responda APENAS com um JSON array no formato:",
    "[{ entryId, date, description, normalizedDescription, amountCents, direction, probableCounterparty, documentType, features, noiseFlags }]",
    "",
    "LANÇAMENTOS:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}
