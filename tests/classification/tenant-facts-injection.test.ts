import { describe, it, expect } from "vitest";
import { buildUserPrompt, type EntryForClassification, type TenantFact } from "@/classification/prompts.js";

const sampleEntries: EntryForClassification[] = [
  {
    entryId: "e1",
    date: "2026-04-01",
    description: "PAGAMENTO FORNECEDOR ABC",
    amountCents: 50000,
    direction: "debit",
  },
];

describe("buildUserPrompt — tenant facts injection (ADR-011 Etapa 4)", () => {
  it("não inclui bloco REGRAS APRENDIDAS quando tenantFacts é undefined", () => {
    const prompt = buildUserPrompt(sampleEntries, undefined, undefined);
    expect(prompt).not.toContain("REGRAS APRENDIDAS");
  });

  it("inclui bloco REGRAS APRENDIDAS com fatos no formato correto quando tenantFacts é fornecido", () => {
    const facts: TenantFact[] = [
      { description: "PIX JOAO SILVA SOCIO", category: "prolabore" },
      { description: "NF 1234 CLIENTE XPTO", category: "receita_bruta" },
    ];
    const prompt = buildUserPrompt(sampleEntries, undefined, facts);
    expect(prompt).toContain("REGRAS APRENDIDAS DESTE TENANT");
    expect(prompt).toContain(`"PIX JOAO SILVA SOCIO" → prolabore`);
    expect(prompt).toContain(`"NF 1234 CLIENTE XPTO" → receita_bruta`);
  });

  it("não inclui bloco REGRAS APRENDIDAS quando tenantFacts é array vazio", () => {
    const prompt = buildUserPrompt(sampleEntries, undefined, []);
    expect(prompt).not.toContain("REGRAS APRENDIDAS");
  });

  it("gera uma linha por entrada quando há múltiplos fatos", () => {
    const facts: TenantFact[] = [
      { description: "SALARIO FUNC", category: "despesas_pessoal" },
      { description: "ALUGUEL SALA COMERCIAL", category: "despesas_administrativas" },
      { description: "MENSALIDADE SOFTWARE", category: "despesas_administrativas" },
    ];
    const prompt = buildUserPrompt(sampleEntries, undefined, facts);
    const factLines = facts.map((f) => `- "${f.description}" → ${f.category}`);
    for (const line of factLines) {
      expect(prompt).toContain(line);
    }
    // Confirm three separate lines (three occurrences of " → ")
    const occurrences = (prompt.match(/ → /g) ?? []).length;
    expect(occurrences).toBe(3);
  });
});

describe("buildUserPrompt — contexto de lançamentos já classificados", () => {
  it("não inclui bloco de contexto quando contextEntries é undefined/vazio", () => {
    expect(buildUserPrompt(sampleEntries, undefined, undefined, undefined, undefined))
      .not.toContain("JÁ CLASSIFICADOS");
    expect(buildUserPrompt(sampleEntries, undefined, undefined, undefined, []))
      .not.toContain("JÁ CLASSIFICADOS");
  });

  it("injeta os lançamentos determinísticos como contexto (não como batch a classificar)", () => {
    const ctx: TenantFact[] = [
      { description: "aluguel escritorio", category: "despesas_administrativas" },
      { description: "salario equipe", category: "despesas_pessoal" },
    ];
    const prompt = buildUserPrompt(sampleEntries, undefined, undefined, undefined, ctx);
    expect(prompt).toContain("JÁ CLASSIFICADOS");
    expect(prompt).toContain("NÃO reclassifique");
    expect(prompt).toContain(`"aluguel escritorio" → despesas_administrativas`);
    expect(prompt).toContain(`"salario equipe" → despesas_pessoal`);
    // O contexto precede a instrução de classificar o batch.
    expect(prompt.indexOf("JÁ CLASSIFICADOS")).toBeLessThan(prompt.indexOf("Classifique os seguintes"));
  });
});
