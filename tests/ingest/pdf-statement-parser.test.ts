import { describe, it, expect } from "vitest";
import { parseStatementText } from "@/ingest/parsers/pdf-statement.js";

// Texto representativo extraído de um extrato Santander (conta corrente):
// DATA  DESCRIÇÃO  DOCTO  CRÉDITO/DÉBITO  SALDO
const SANTANDER = `Internet Banking
EXTRATO DE CONTA CORRENTE
RAFAEL DE NOVAES Agência e Conta: 0696 / 02008597-4
Data Descrição Docto Situação Crédito (R$) Débito (R$) Saldo (R$)
20/05/2026 PIX ENVIADO OPEN FINANCE Rafael De Novaes 000000 -1.000,00 0,00
20/05/2026 PIX RECEBIDO VALDINEIA AQUINO M ANDRIO 000000 1.000,00 1.000,00
10/04/2026 TED RECEBIDA VALDINEIA AQUINO DA MATTA 000000 10.000,00 10.000,00
30/03/2026 PAGAMENTO IPVA-CANAIS INTERNET LICENCIAMENTO EL 000000 -1.880,60 119,40
10/03/2026 REMUNERACAO APLICACAO AUTOMATICA 000000 0,21 0,21
02/03/2026 PIX ENVIADO Josina de Aquino da Matta 000000 -40.669,92 6.450,08
12/03/2026 PAGAMENTO A FORNECEDORES CNPJ 004814563000174 010312 2.000,00 2.000,21
Saldo anterior
21/02/2026 45.000,00
3/3`;

describe("parsePdfStatement — extrato bancário (Santander)", () => {
  const { entries } = parseStatementText(SANTANDER);

  it("extrai apenas as linhas de transação (ignora cabeçalho)", () => {
    expect(entries.length).toBe(7);
  });

  it("crédito (PIX RECEBIDO) com valor e direção corretos", () => {
    const e = entries.find((x) => x.description.includes("VALDINEIA AQUINO M ANDRIO"));
    expect(e).toBeDefined();
    expect(e!.direction).toBe("credit");
    expect(e!.amountCents).toBe(100000);
    expect(e!.date).toBe("2026-05-20");
  });

  it("débito (PIX ENVIADO) com sinal negativo vira debit", () => {
    const e = entries.find((x) => x.description.includes("OPEN FINANCE"));
    expect(e!.direction).toBe("debit");
    expect(e!.amountCents).toBe(100000);
  });

  it("usa o penúltimo valor (lançamento), não o saldo: IPVA = 1.880,60", () => {
    const e = entries.find((x) => x.description.includes("IPVA"));
    expect(e!.direction).toBe("debit");
    expect(e!.amountCents).toBe(188060);
  });

  it("valores grandes e centavos pequenos", () => {
    expect(entries.find((x) => x.description.includes("Josina"))!.amountCents).toBe(4066992);
    expect(entries.find((x) => x.description.includes("REMUNERACAO"))!.amountCents).toBe(21);
  });

  it("ignora Docto na descrição", () => {
    const e = entries.find((x) => x.description.includes("TED RECEBIDA"));
    expect(e!.description).not.toContain("000000");
    expect(e!.amountCents).toBe(1000000);
  });

  it("totais agregados batem (crédito vs débito)", () => {
    const credit = entries.filter((e) => e.direction === "credit").reduce((s, e) => s + e.amountCents, 0);
    const debit = entries.filter((e) => e.direction === "debit").reduce((s, e) => s + e.amountCents, 0);
    // Créditos: 1.000 + 10.000 + 0,21 + 2.000 = 13.000,21
    expect(credit).toBe(1300021);
    // Débitos: 1.000 + 1.880,60 + 40.669,92 = 43.550,52
    expect(debit).toBe(4355052);
  });
});

describe("parsePdfStatement — DRE não é confundida com extrato", () => {
  // Uma DRE (linhas de categoria, sem data no início) não deve gerar lançamentos.
  // Assim o roteador devolve 0 e, no fluxo do aluno, NÃO cai no parser LLM de DRE.
  const DRE = `DEMONSTRATIVO DE RESULTADO DO EXERCÍCIO
Período de competência: março/2026
Receita Bruta              50.000,00
(-) Deduções               5.000,00
= Receita Líquida          45.000,00
(-) Custos                 20.000,00
= Lucro Bruto              25.000,00
(-) Despesas Operacionais  10.000,00
= Lucro Líquido            15.000,00`;

  it("retorna 0 lançamentos para texto de DRE", () => {
    expect(parseStatementText(DRE).entries.length).toBe(0);
  });
});
