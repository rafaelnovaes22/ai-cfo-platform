import { describe, it, expect } from "vitest";
import { classifyByRule, isDiscriminativeDescription } from "@/classification/rule-classifier.js";

describe("classifyByRule — pré-classificador determinístico", () => {
  it("classifica termos inequívocos de despesa", () => {
    expect(classifyByRule("Aluguel escritório", "debit")?.category).toBe("despesas_administrativas");
    expect(classifyByRule("Pró-labore sócios", "debit")?.category).toBe("prolabore");
    expect(classifyByRule("Salários equipe", "debit")?.category).toBe("despesas_pessoal");
    expect(classifyByRule("DAS Simples Nacional", "debit")?.category).toBe("simples_nacional");
    expect(classifyByRule("Meta Ads - campanha maio", "debit")?.category).toBe("despesas_comerciais");
    expect(classifyByRule("Honorários contador", "debit")?.category).toBe("despesas_juridicas");
    expect(classifyByRule("Energia elétrica", "debit")?.category).toBe("despesas_administrativas");
    expect(classifyByRule("Tarifas bancárias", "debit")?.category).toBe("despesas_financeiras");
  });

  it("confiança é sempre 1.0 (determinística)", () => {
    expect(classifyByRule("Aluguel escritório", "debit")?.confidence).toBe(1);
  });

  it("devolve null para descrição genérica/ambígua de receita (vai ao LLM)", () => {
    expect(classifyByRule("Contrato mensal - Loja Vértice", "credit")).toBeNull();
    expect(classifyByRule("Projeto site - Faculdade Unileste", "credit")).toBeNull();
    expect(classifyByRule("Assessoria - Maravilha Móveis", "credit")).toBeNull();
    expect(classifyByRule("TED 1200", "credit")).toBeNull();
  });

  it("NÃO casa 'das' como artigo em português (anti-falso-positivo)", () => {
    // "pagamento das comissões" não pode virar Simples Nacional.
    expect(classifyByRule("Pagamento das comissões", "debit")).toBeNull();
    expect(classifyByRule("Reembolso das despesas de viagem", "debit")).toBeNull();
  });

  it("guarda de natureza: categoria de despesa contra direção CONFIÁVEL de entrada → null", () => {
    // Um crédito confiável não pode virar despesa por keyword; deixa o LLM decidir.
    expect(classifyByRule("Aluguel recebido", "credit")).toBeNull();
  });

  it("direção 'unknown' (inferida) não aciona a guarda de natureza", () => {
    expect(classifyByRule("Aluguel escritório", "unknown")?.category).toBe("despesas_administrativas");
  });

  it("devolve null quando duas categorias casam (ambíguo)", () => {
    // "contador" (jurídica) + "salario" (pessoal) na mesma descrição → ambíguo.
    expect(classifyByRule("Salário do contador interno", "debit")).toBeNull();
  });

  it("classifica aquisição de equipamento durável como capex", () => {
    expect(classifyByRule("Microfone Shure novo - Mercado Livre", "debit")?.category).toBe("capex");
    expect(classifyByRule("Computador novo escritório", "debit")?.category).toBe("capex");
    expect(classifyByRule("Câmera Sony A7", "debit")?.category).toBe("capex");
  });

  it("NÃO classifica como capex quando é manutenção/aluguel/serviço sobre o equipamento", () => {
    expect(classifyByRule("Manutenção câmera - assistência técnica", "debit")).toBeNull();
    expect(classifyByRule("Aluguel de notebook para evento", "debit")).toBeNull();
    expect(classifyByRule("Conserto do microfone", "debit")).toBeNull();
    expect(classifyByRule("Frete equipamento devolvido", "debit")).toBeNull();
  });

  it("guarda de natureza: equipamento com direção de ENTRADA confiável → null (venda, não compra)", () => {
    expect(classifyByRule("Venda câmera usada", "credit")).toBeNull();
  });
});

describe("isDiscriminativeDescription — guarda do flywheel", () => {
  it("rejeita descrições genéricas de meio/movimento (não memorizáveis)", () => {
    expect(isDiscriminativeDescription("Pagamento")).toBe(false);
    expect(isDiscriminativeDescription("PIX")).toBe(false);
    expect(isDiscriminativeDescription("TED 500")).toBe(false);
    expect(isDiscriminativeDescription("PIX 1200")).toBe(false);
    expect(isDiscriminativeDescription("Transferência")).toBe(false);
    expect(isDiscriminativeDescription("Recebimento")).toBe(false);
  });

  it("aceita descrições com token de conteúdo (transferíveis)", () => {
    expect(isDiscriminativeDescription("Aluguel escritório")).toBe(true);
    expect(isDiscriminativeDescription("PIX João Silva sócio")).toBe(true);
    expect(isDiscriminativeDescription("Pagamento fornecedor materiais")).toBe(true);
    expect(isDiscriminativeDescription("Microfone Shure")).toBe(true);
  });
});
