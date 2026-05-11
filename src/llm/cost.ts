// Preços em USD por milhão de tokens. Câmbio: R$5,70/USD.
// Atualizar quando modelos ou preços mudarem (hook unit-economics-recalc).

const BRL_PER_USD = 5.7;

const PRICE_TABLE: Record<string, { inputUsdPerMTok: number; outputUsdPerMTok: number }> = {
  "gemini-2.0-flash":      { inputUsdPerMTok: 0.075, outputUsdPerMTok: 0.30 },
  "gemini-2.5-flash":      { inputUsdPerMTok: 0.15,  outputUsdPerMTok: 0.60 },
  "claude-haiku-4-5":      { inputUsdPerMTok: 0.80,  outputUsdPerMTok: 4.00 },
  "claude-sonnet-4-6":     { inputUsdPerMTok: 3.00,  outputUsdPerMTok: 15.00 },
  "local":                 { inputUsdPerMTok: 0,      outputUsdPerMTok: 0 },
};

export function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const prices = PRICE_TABLE[model] ?? PRICE_TABLE["claude-sonnet-4-6"];
  const usd =
    (inputTokens / 1_000_000) * prices.inputUsdPerMTok +
    (outputTokens / 1_000_000) * prices.outputUsdPerMTok;
  return Math.ceil(usd * BRL_PER_USD * 100); // centavos BRL
}
