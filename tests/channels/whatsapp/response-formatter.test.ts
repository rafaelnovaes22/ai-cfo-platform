import { describe, it, expect } from "vitest";
import {
  formatCashflowStatement,
  formatIngestReceived,
  formatWelcomeMenu,
} from "@/channels/whatsapp/response-formatter.js";

describe("whatsapp/response-formatter — formatWelcomeMenu", () => {
  it("aluno (student): centrado no extrato, sem opção 'caixa de hoje' (voltaria vazio)", () => {
    const menu = formatWelcomeMenu("Acme", "student");
    expect(menu.toLowerCase()).not.toContain("caixa de hoje");
    expect(menu.toLowerCase()).not.toContain("últimos 7 dias");
    expect(menu.toLowerCase()).toContain("extrato");
    expect(menu.toLowerCase()).toContain("fluxo de caixa");
  });

  it("plano pago mantém as opções de menu", () => {
    const menu = formatWelcomeMenu("Empresa", "lite");
    expect(menu).toContain("Ver caixa de hoje");
    expect(menu).toContain("Ver análise do mês");
  });
});

// Período exato do extrato + resultado sempre calculável (entradas − saídas).
describe("whatsapp/response-formatter — formatCashflowStatement", () => {
  const base = {
    period: { startDate: "2026-05-03", endDate: "2026-05-28" },
    summary: {
      closingBalanceCents: null,
      totalCreditsCents: 30_100_00,
      totalDebitsCents: 23_650_00,
      creditCount: 84,
      debitCount: 112,
    },
  };

  it("mostra o período real do extrato (DD/MM a DD/MM)", () => {
    const text = formatCashflowStatement(base);
    expect(text).toContain("03/05/2026 a 28/05/2026");
    expect(text).toContain("Fluxo de caixa do extrato");
  });

  it("mostra entradas, saídas e contagem de lançamentos", () => {
    const text = formatCashflowStatement(base);
    expect(text).toContain("(84 lançamentos)");
    expect(text).toContain("(112 lançamentos)");
  });

  it("resultado positivo recebe indicador verde", () => {
    const text = formatCashflowStatement(base);
    // 30.100 − 23.650 = 6.450 → positivo
    expect(text).toContain("🟢 Resultado:");
  });

  it("resultado negativo recebe indicador vermelho", () => {
    const text = formatCashflowStatement({
      ...base,
      summary: { ...base.summary, totalCreditsCents: 1_000_00, totalDebitsCents: 5_000_00 },
    });
    expect(text).toContain("🔴 Resultado:");
  });

  it("omite saldo final quando não há saldo inicial conhecido", () => {
    expect(formatCashflowStatement(base)).not.toContain("Saldo final");
  });

  it("inclui saldo final quando disponível", () => {
    const text = formatCashflowStatement({
      ...base,
      summary: { ...base.summary, closingBalanceCents: 8_450_00 },
    });
    expect(text).toContain("Saldo final");
  });
});

describe("whatsapp/response-formatter — formatIngestReceived", () => {
  it("aluno (student): sinaliza cálculo automático do caixa, sem pedir comando", () => {
    const text = formatIngestReceived("extrato.xlsx", true);
    expect(text).toContain("Arquivo recebido");
    expect(text.toLowerCase()).toContain("fluxo de caixa");
    expect(text.toLowerCase()).not.toContain("envie");
  });

  it("plano pago: sinaliza processamento da análise", () => {
    const text = formatIngestReceived("dre.pdf", false);
    expect(text.toLowerCase()).toContain("análise");
  });
});
