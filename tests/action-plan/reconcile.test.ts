import { describe, expect, it } from "vitest";
import { reconcileActionPlan, type DraftAction, type ExistingPlanItem } from "@/action-plan/reconcile.js";
import { buildMatchKey, LEVER_KEYS } from "@/action-plan/levers.js";

function draft(over: Partial<DraftAction> = {}): DraftAction {
  return {
    horizon: "short",
    leverKey: "renegotiate_direct_costs",
    title: "Renegocie custos diretos",
    description: "Levante os 3 maiores fornecedores e cote 2 concorrentes para cada.",
    effortLevel: "medium",
    riskLevel: "low",
    impactCents: 100_000,
    deadlineDays: 30,
    doneWhen: "Contrato com redução >= R$ 1.000/mês.",
    ...over,
  };
}

function existing(over: Partial<ExistingPlanItem> = {}): ExistingPlanItem {
  return {
    id: "item-1",
    matchKey: "renegotiate_direct_costs",
    horizon: "short",
    status: "pending",
    clientApproved: null,
    supersededAt: null,
    ...over,
  };
}

describe("buildMatchKey", () => {
  it("usa o leverKey direto para alavancas conhecidas", () => {
    expect(buildMatchKey("adjust_pricing", "Reajuste preços")).toBe("adjust_pricing");
  });

  it("para 'other' cai no slug do título (sem acento, kebab-case)", () => {
    expect(buildMatchKey("other", "Revise Contrato à Vista")).toBe("other:revise-contrato-a-vista");
  });

  it("dois 'other' com títulos diferentes geram matchKeys distintos", () => {
    expect(buildMatchKey("other", "Ação A")).not.toBe(buildMatchKey("other", "Ação B"));
  });
});

describe("reconcileActionPlan", () => {
  it("alavanca repetida (mesmo matchKey+horizonte) vai para toUpdate, não toCreate", () => {
    const plan = reconcileActionPlan([existing()], [draft({ title: "Renegocie custos diretos com fornecedores" })]);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toUpdate[0]!.id).toBe("item-1");
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.toSupersede).toHaveLength(0);
    // conteúdo é refrescado com o título novo
    expect(plan.toUpdate[0]!.content.title).toBe("Renegocie custos diretos com fornecedores");
  });

  it("alavanca nova cria item", () => {
    const plan = reconcileActionPlan([], [draft({ leverKey: "adjust_pricing", title: "Reajuste preços" })]);
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0]!.matchKey).toBe("adjust_pricing");
    expect(plan.toUpdate).toHaveLength(0);
  });

  it("mesma alavanca em horizonte diferente é item distinto (cria, não casa)", () => {
    const plan = reconcileActionPlan(
      [existing({ horizon: "short" })],
      [draft({ horizon: "medium" })],
    );
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
    // o short antigo sumiu da proposta e estava pending → superseded
    expect(plan.toSupersede).toEqual(["item-1"]);
  });

  it("item que sumiu mas está em execução (in_progress) é mantido, não superseded", () => {
    const plan = reconcileActionPlan(
      [existing({ status: "in_progress" })],
      [draft({ leverKey: "adjust_pricing", title: "Reajuste preços" })],
    );
    expect(plan.toSupersede).toHaveLength(0);
  });

  it("item que sumiu mas foi aprovado pela cliente é mantido", () => {
    const plan = reconcileActionPlan(
      [existing({ clientApproved: true })],
      [draft({ leverKey: "adjust_pricing", title: "Reajuste preços" })],
    );
    expect(plan.toSupersede).toHaveLength(0);
  });

  it("item pending sem aprovação que sumiu é superseded", () => {
    const plan = reconcileActionPlan(
      [existing()],
      [draft({ leverKey: "adjust_pricing", title: "Reajuste preços" })],
    );
    expect(plan.toSupersede).toEqual(["item-1"]);
  });

  it("item já superseded não é re-superseded", () => {
    const plan = reconcileActionPlan(
      [existing({ supersededAt: new Date("2026-01-01") })],
      [draft({ leverKey: "adjust_pricing", title: "Reajuste preços" })],
    );
    expect(plan.toSupersede).toHaveLength(0);
  });

  it("draft duplicado na mesma alavanca/horizonte é deduplicado (constraint única)", () => {
    const plan = reconcileActionPlan([], [draft(), draft({ title: "Outra redação mesma alavanca" })]);
    expect(plan.toCreate).toHaveLength(1);
  });

  it("leverKey ausente cai em 'other' e usa slug do título como identidade", () => {
    const plan = reconcileActionPlan([], [draft({ leverKey: undefined, title: "Faça algo específico" })]);
    expect(plan.toCreate[0]!.leverKey).toBe("other");
    expect(plan.toCreate[0]!.matchKey).toBe("other:faca-algo-especifico");
  });

  it("status 'done' que sumiu é preservado (cliente concluiu)", () => {
    const plan = reconcileActionPlan(
      [existing({ status: "done" })],
      [draft({ leverKey: "adjust_pricing", title: "Reajuste preços" })],
    );
    expect(plan.toSupersede).toHaveLength(0);
  });

  it("taxonomia inclui 'other' e as alavancas de CFO esperadas", () => {
    expect(LEVER_KEYS).toContain("other");
    expect(LEVER_KEYS).toContain("build_cash_reserve");
    expect(LEVER_KEYS).toContain("diversify_revenue");
  });
});
