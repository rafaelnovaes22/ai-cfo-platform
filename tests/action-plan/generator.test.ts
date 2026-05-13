import { describe, it, expect } from "vitest";
import { ActionSchema, PlanResponseSchema } from "@/action-plan/generator.js";

// Action de referência mínima válida — todos os testes derivam dela.
function action(overrides: Partial<{
  horizon: "short" | "medium" | "long";
  title: string;
  description: string;
  effortLevel: "low" | "medium" | "high";
  riskLevel: "low" | "medium" | "high";
  impactCents: number;
  doneWhen: string;
  deadlineDays?: number;
}> = {}) {
  return {
    horizon:     "short" as const,
    title:       "Reduzir CAC",
    description: "Renegociar contratos com fornecedores de mídia",
    effortLevel: "medium" as const,
    riskLevel:   "low" as const,
    impactCents: 100_000,
    doneWhen:    "CAC mensal < R$ 500 por 2 meses consecutivos",
    ...overrides,
  };
}

describe("ActionSchema — invariantes da spec §1", () => {
  it("aceita ação válida", () => {
    const r = ActionSchema.safeParse(action());
    expect(r.success).toBe(true);
  });

  it("rejeita sem doneWhen", () => {
    const a = action();
    // @ts-expect-error remoção intencional para teste
    delete a.doneWhen;
    expect(ActionSchema.safeParse(a).success).toBe(false);
  });

  it("rejeita doneWhen vazio (< 5 chars)", () => {
    const r = ActionSchema.safeParse(action({ doneWhen: "ok" }));
    expect(r.success).toBe(false);
  });

  it("rejeita title curto (< 3 chars)", () => {
    expect(ActionSchema.safeParse(action({ title: "X" })).success).toBe(false);
  });

  it("rejeita description curta (< 10 chars)", () => {
    expect(ActionSchema.safeParse(action({ description: "curto" })).success).toBe(false);
  });

  it("rejeita impactCents <= 0 (não-positivo)", () => {
    expect(ActionSchema.safeParse(action({ impactCents: 0 })).success).toBe(false);
    expect(ActionSchema.safeParse(action({ impactCents: -100 })).success).toBe(false);
  });

  it("rejeita impactCents float (precisa ser integer — centavos)", () => {
    expect(ActionSchema.safeParse(action({ impactCents: 100.5 })).success).toBe(false);
  });

  it("rejeita horizon fora do enum", () => {
    expect(ActionSchema.safeParse(action({ horizon: "imediato" as never })).success).toBe(false);
  });

  it("rejeita effortLevel fora do enum", () => {
    expect(ActionSchema.safeParse(action({ effortLevel: "extreme" as never })).success).toBe(false);
  });

  it("aceita deadlineDays opcional", () => {
    expect(ActionSchema.safeParse(action({ deadlineDays: 30 })).success).toBe(true);
    expect(ActionSchema.safeParse(action()).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PlanResponseSchema — mínimos por horizonte (refinement C2)

function plan(actions: ReturnType<typeof action>[]) {
  return { actions };
}

describe("PlanResponseSchema — mínimos por horizonte (C2)", () => {
  it("rejeita menos de 5 actions totais", () => {
    const r = PlanResponseSchema.safeParse(
      plan([action({ horizon: "short" }), action({ horizon: "medium" }), action({ horizon: "long" })]),
    );
    expect(r.success).toBe(false);
  });

  it("rejeita quando short < 3", () => {
    const r = PlanResponseSchema.safeParse(
      plan([
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "medium" }),
        action({ horizon: "medium" }),
        action({ horizon: "long" }),
      ]),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.includes("3 ações 'short'"))).toBe(true);
    }
  });

  it("rejeita quando medium = 0", () => {
    const r = PlanResponseSchema.safeParse(
      plan([
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "long" }),
        action({ horizon: "long" }),
      ]),
    );
    expect(r.success).toBe(false);
  });

  it("rejeita quando long = 0", () => {
    const r = PlanResponseSchema.safeParse(
      plan([
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "medium" }),
        action({ horizon: "medium" }),
      ]),
    );
    expect(r.success).toBe(false);
  });

  it("aceita combinação mínima (3 short + 1 medium + 1 long)", () => {
    const r = PlanResponseSchema.safeParse(
      plan([
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "medium" }),
        action({ horizon: "long" }),
      ]),
    );
    expect(r.success).toBe(true);
  });

  it("aceita acima do mínimo (4 short + 2 medium + 2 long)", () => {
    const r = PlanResponseSchema.safeParse(
      plan([
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "medium" }),
        action({ horizon: "medium" }),
        action({ horizon: "long" }),
        action({ horizon: "long" }),
      ]),
    );
    expect(r.success).toBe(true);
  });

  it("rejeita se qualquer ação individual falhar (composição da spec §1)", () => {
    const r = PlanResponseSchema.safeParse(
      plan([
        action({ horizon: "short" }),
        action({ horizon: "short" }),
        action({ horizon: "short", doneWhen: "ok" }), // doneWhen muito curto
        action({ horizon: "medium" }),
        action({ horizon: "long" }),
      ]),
    );
    expect(r.success).toBe(false);
  });
});
