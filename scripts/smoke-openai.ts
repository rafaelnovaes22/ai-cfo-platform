import { callOpenAI } from "@/llm/adapters/openai.js";

const CANDIDATES = ["gpt-5-nano", "gpt-5-mini", "gpt-4.1-nano", "gpt-4.1-mini", "gpt-4o-mini"];

async function main(): Promise<void> {
  for (const model of CANDIDATES) {
    const t0 = Date.now();
    try {
      const res = await callOpenAI(
        { provider: "openai", model },
        {
          task: "dre-classification",
          systemPrompt: "Você é um assistente. Responda em JSON.",
          userPrompt: 'Retorne {"ok":true}.',
          tenantId: "smoke",
          jsonMode: true,
        },
      );
      console.log(`✅ ${model.padEnd(20)}  ${(Date.now() - t0).toString().padStart(5)}ms  tokens=${res.inputTokens}→${res.outputTokens}  preview="${res.content.slice(0, 80)}"`);
    } catch (err) {
      console.log(`❌ ${model.padEnd(20)}  ${(Date.now() - t0).toString().padStart(5)}ms  err=${err instanceof Error ? err.message.slice(0, 200) : String(err)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
