import { callGoogle } from "@/llm/adapters/google.js";
import { resolveRoute } from "@/llm/router.js";
import type { LlmTask } from "@/llm/types.js";

const TASKS: { task: LlmTask; jsonMode: boolean; userPrompt: string }[] = [
  {
    task: "classification",
    jsonMode: true,
    userPrompt: 'Classifique a entrada {"descricao":"Aluguel","valor":3500} no DRE. Responda JSON: {"category":"..."}.',
  },
  {
    task: "dre-narrative",
    jsonMode: false,
    userPrompt: "Em 1 frase, o que é margem de contribuição?",
  },
  {
    task: "action-plan",
    jsonMode: false,
    userPrompt: "Em 1 frase, dê uma ação financeira de curto prazo para uma PME com caixa apertado.",
  },
];

async function main(): Promise<void> {
  const results: { task: string; ok: boolean; model: string; ms: number; costCents: number; tokens: string; err?: string }[] = [];

  // Candidatos extras: modelos a validar para substituir gemini-2.0-flash (descontinuado)
  const CANDIDATES: { label: string; model: string }[] = [
    { label: "classification-candidate-A", model: "gemini-2.5-flash-lite" },
    { label: "classification-candidate-B", model: "gemini-flash-lite-latest" },
  ];

  for (const { label, model } of CANDIDATES) {
    const t0 = Date.now();
    try {
      const res = await callGoogle(
        { provider: "google", model },
        {
          task: "classification",
          systemPrompt: "Você é um assistente financeiro. Seja conciso.",
          userPrompt: 'Classifique a entrada {"descricao":"Aluguel","valor":3500} no DRE. Responda JSON: {"category":"..."}.',
          tenantId: "smoke-test",
          jsonMode: true,
        },
      );
      results.push({
        task: label,
        ok: true,
        model,
        ms: Date.now() - t0,
        costCents: res.costCents,
        tokens: `${res.inputTokens}→${res.outputTokens}`,
      });
    } catch (err) {
      results.push({
        task: label,
        ok: false,
        model,
        ms: Date.now() - t0,
        costCents: 0,
        tokens: "-",
        err: err instanceof Error ? err.message.slice(0, 120) : String(err),
      });
    }
  }

  for (const { task, jsonMode, userPrompt } of TASKS) {
    const route = resolveRoute(task);
    const t0 = Date.now();
    try {
      const res = await callGoogle(route, {
        task,
        systemPrompt: "Você é um assistente financeiro. Seja conciso.",
        userPrompt,
        tenantId: "smoke-test",
        jsonMode,
      });
      results.push({
        task,
        ok: true,
        model: route.model,
        ms: Date.now() - t0,
        costCents: res.costCents,
        tokens: `${res.inputTokens}→${res.outputTokens}`,
      });
    } catch (err) {
      results.push({
        task,
        ok: false,
        model: route.model,
        ms: Date.now() - t0,
        costCents: 0,
        tokens: "-",
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.table(results);
  const allOk = results.every((r) => r.ok);
  const totalCostCents = results.reduce((s, r) => s + r.costCents, 0);
  console.log(`\nTotal cost: R$ ${(totalCostCents / 100).toFixed(4)}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
