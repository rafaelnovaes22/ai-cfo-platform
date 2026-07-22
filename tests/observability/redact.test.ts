import { describe, it, expect } from "vitest";
import { redactPii } from "@/observability/redact.js";

describe("redactPii — mascara identificadores pessoais (ADR-021)", () => {
  it("mascara CPF formatado e cru", () => {
    expect(redactPii("titular 123.456.789-01 pagou")).toBe("titular [cpf] pagou");
    expect(redactPii("doc 12345678901 ok")).toBe("doc [cpf] ok");
  });

  it("mascara CNPJ formatado e cru (sem ser quebrado pelo CPF)", () => {
    expect(redactPii("emitente 12.345.678/0001-99")).toBe("emitente [cnpj]");
    expect(redactPii("cnpj 12345678000199 fim")).toBe("cnpj [cnpj] fim");
  });

  it("mascara e-mail", () => {
    expect(redactPii("contato joao.silva@empresa.com.br aqui")).toBe("contato [email] aqui");
  });

  it("mascara telefone BR com DDD e formatação", () => {
    expect(redactPii("ligar (11) 98765-4321")).toBe("ligar [telefone]");
    expect(redactPii("whats +55 11 98765-4321")).toBe("whats [telefone]");
  });

  it("NÃO redige valores monetários (dado de negócio)", () => {
    const txt = "Receita de R$ 1.234.567,89 no mês; custo 45.000,00";
    expect(redactPii(txt)).toBe(txt);
  });

  it("preserva o restante do texto e é idempotente", () => {
    const once = redactPii("Pgto fornecedor, CPF 111.222.333-44, valor R$ 500,00");
    expect(once).toBe("Pgto fornecedor, CPF [cpf], valor R$ 500,00");
    expect(redactPii(once)).toBe(once);
  });

  it("lida com string vazia", () => {
    expect(redactPii("")).toBe("");
  });
});
