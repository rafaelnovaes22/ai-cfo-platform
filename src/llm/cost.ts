// Preços em USD por milhão de tokens. Câmbio: R$5,70/USD.
// Atualizar quando modelos ou preços mudarem (hook unit-economics-recalc).

const BRL_PER_USD = 5.7;

const PRICE_TABLE: Record<string, { inputUsdPerMTok: number; outputUsdPerMTok: number }> = {
  "gemini-2.0-flash":      { inputUsdPerMTok: 0.075, outputUsdPerMTok: 0.30 },
  "gemini-2.5-flash-lite": { inputUsdPerMTok: 0.10,  outputUsdPerMTok: 0.40 },
  "gemini-2.5-flash":      { inputUsdPerMTok: 0.15,  outputUsdPerMTok: 0.60 },
  "claude-haiku-4-5":      { inputUsdPerMTok: 0.80,  outputUsdPerMTok: 4.00 },
  "claude-sonnet-4-6":     { inputUsdPerMTok: 3.00,  outputUsdPerMTok: 15.00 },
  // OpenAI — preços aproximados (verificar com painel de billing após primeira run)
  "gpt-4o-mini":           { inputUsdPerMTok: 0.15,  outputUsdPerMTok: 0.60 },
  "gpt-4.1-mini":          { inputUsdPerMTok: 0.40,  outputUsdPerMTok: 1.60 },
  "gpt-4.1-nano":          { inputUsdPerMTok: 0.10,  outputUsdPerMTok: 0.40 },
  "gpt-5-mini":            { inputUsdPerMTok: 0.25,  outputUsdPerMTok: 2.00 },
  "gpt-5-nano":            { inputUsdPerMTok: 0.05,  outputUsdPerMTok: 0.40 },
  "local":                 { inputUsdPerMTok: 0,      outputUsdPerMTok: 0 },
};

const DEFAULT_PRICES = { inputUsdPerMTok: 3.0, outputUsdPerMTok: 15.0 }; // fallback Sonnet 4.6.

export function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const prices = PRICE_TABLE[model] ?? PRICE_TABLE["claude-sonnet-4-6"] ?? DEFAULT_PRICES;
  const usd =
    (inputTokens / 1_000_000) * prices.inputUsdPerMTok +
    (outputTokens / 1_000_000) * prices.outputUsdPerMTok;
  return Math.ceil(usd * BRL_PER_USD * 100); // centavos BRL
}
