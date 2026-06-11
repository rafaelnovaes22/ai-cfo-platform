import { describe, it, expect } from "vitest";
import {
  normalizeDate,
  normalizeAmountCents,
  normalizeDirection,
  resolveDirection,
  detectColumns,
  inferDirectionFromDescription,
} from "@/ingest/normalize.js";

describe("ingest/normalize — datas", () => {
  it("parseia DD/MM/YYYY", () => {
    expect(normalizeDate("30/04/2026")).toBe("2026-04-30");
  });

  it("aceita DD-MM-YYYY e DD.MM.YYYY", () => {
    expect(normalizeDate("01-12-2026")).toBe("2026-12-01");
    expect(normalizeDate("15.07.2026")).toBe("2026-07-15");
  });

  it("aceita YYYY-MM-DD ISO", () => {
    expect(normalizeDate("2026-04-30")).toBe("2026-04-30");
  });

  it("normaliza dia/mês com 1 dígito", () => {
    expect(normalizeDate("5/4/2026")).toBe("2026-04-05");
  });

  it("rejeita data inválida", () => {
    expect(normalizeDate("31/02/2026")).toBeNull(); // 31 de fevereiro
    expect(normalizeDate("texto livre")).toBeNull();
    expect(normalizeDate("")).toBeNull();
  });
});

describe("ingest/normalize — valores monetários BR", () => {
  it("converte R$ 1.234,56 para centavos", () => {
    expect(normalizeAmountCents("R$ 1.234,56")).toBe(123456);
  });

  it("aceita valor sem R$ no formato BR", () => {
    expect(normalizeAmountCents("1.234,56")).toBe(123456);
  });

  it("aceita number direto", () => {
    expect(normalizeAmountCents(1234.56)).toBe(123456);
  });

  it("preserva o sinal de number negativo (célula -900 do Excel é débito)", () => {
    expect(normalizeAmountCents(-900)).toBe(-90000);
    expect(normalizeAmountCents(-1234.56)).toBe(-123456);
  });

  it("trata parênteses como negativo (formato contábil)", () => {
    expect(normalizeAmountCents("(500,00)")).toBe(-50000);
  });

  it("rejeita string inválida", () => {
    expect(normalizeAmountCents("abc")).toBeNull();
  });

  it("zero é válido", () => {
    expect(normalizeAmountCents("0,00")).toBe(0);
  });

  it("valor grande no padrão BR", () => {
    expect(normalizeAmountCents("999.999.999,99")).toBe(99999999999);
  });
});

describe("ingest/normalize — direction", () => {
  it("infere credit a partir de token explícito", () => {
    expect(normalizeDirection("C", 100)).toBe("credit");
    expect(normalizeDirection("crédito", 100)).toBe("credit");
    expect(normalizeDirection("entrada", 100)).toBe("credit");
  });

  it("infere debit a partir de token explícito", () => {
    expect(normalizeDirection("D", 100)).toBe("debit");
    expect(normalizeDirection("saída", 100)).toBe("debit");
  });

  it("fallback pelo sinal do valor quando token ausente", () => {
    expect(normalizeDirection(null, 100)).toBe("credit");
    expect(normalizeDirection(null, -100)).toBe("debit");
    expect(normalizeDirection(undefined, -50)).toBe("debit");
  });
});

describe("ingest/normalize — resolveDirection (origem da direção)", () => {
  it("token explícito → source 'explicit'", () => {
    expect(resolveDirection("C", 100)).toEqual({ direction: "credit", source: "explicit" });
    expect(resolveDirection("despesa", 100)).toEqual({ direction: "debit", source: "explicit" });
    expect(resolveDirection("credit", -100)).toEqual({ direction: "credit", source: "explicit" });
  });

  it("valor negativo sem token → source 'sign'", () => {
    expect(resolveDirection(null, -100)).toEqual({ direction: "debit", source: "sign" });
    expect(resolveDirection("", -50)).toEqual({ direction: "debit", source: "sign" });
  });

  it("positivo sem token → source 'fallback' (credit é chute, não fato)", () => {
    expect(resolveDirection(null, 100)).toEqual({ direction: "credit", source: "fallback" });
    expect(resolveDirection("", 100)).toEqual({ direction: "credit", source: "fallback" });
  });

  it("token não reconhecido cai na regra de sinal", () => {
    expect(resolveDirection("boleto", 100)).toEqual({ direction: "credit", source: "fallback" });
    expect(resolveDirection("boleto", -100)).toEqual({ direction: "debit", source: "sign" });
  });

  it("normalizeDirection permanece compatível (wrapper)", () => {
    expect(normalizeDirection("C", -100)).toBe("credit");
    expect(normalizeDirection(null, -100)).toBe("debit");
  });
});

describe("ingest/normalize — detectColumns", () => {
  it("identifica colunas em header BR padrão", () => {
    const cols = detectColumns(["Data", "Histórico", "Valor", "D/C"]);
    expect(cols.dateIdx).toBe(0);
    expect(cols.descIdx).toBe(1);
    expect(cols.amountIdx).toBe(2);
    expect(cols.dirIdx).toBe(3);
  });

  it("dirIdx é null se não houver coluna de direção", () => {
    const cols = detectColumns(["Data", "Descrição", "Valor"]);
    expect(cols.dirIdx).toBeNull();
  });

  it("retorna -1 quando coluna não encontrada", () => {
    const cols = detectColumns(["A", "B", "C"]);
    expect(cols.dateIdx).toBe(-1);
    expect(cols.descIdx).toBe(-1);
    expect(cols.amountIdx).toBe(-1);
  });
});

describe("ingest/normalize — inferDirectionFromDescription", () => {
  it("despesas inequívocas que toda empresa paga viram débito", () => {
    const despesas = [
      "Energia eletrica Light",
      "ALUGUEL ESTUDIO IMOBILIARIA VIEIRA",
      "DAS Simples Nacional - abril",
      "Pró-labore Cid Moreira",
      "Vivo internet/telefone",
      "Assinatura Adobe Creative Cloud",
      "Tarifa bancária - manutenção conta",
      "Uber - deslocamento cobertura",
      "Água mineral + copa escritório",
      "Honorários contábeis - Contabilidade Exata",
      "bolsa estagiario maio",
      "Pagamento freelancer repórter - João P.",
    ];
    for (const d of despesas) {
      expect(inferDirectionFromDescription(d), d).toBe("debit");
    }
  });

  it("entradas inequívocas viram crédito", () => {
    expect(inferDirectionFromDescription("recebimento cliente")).toBe("credit");
    expect(inferDirectionFromDescription("Venda de produto")).toBe("credit");
    expect(inferDirectionFromDescription("PIX recebido - fulano")).toBe("credit");
  });

  it("acento e caixa são normalizados (pró-labore, ÁGUA)", () => {
    expect(inferDirectionFromDescription("PRÓ-LABORE sócia")).toBe("debit");
    expect(inferDirectionFromDescription("Conta de ÁGUA - Sabesp")).toBe("debit");
  });

  it("serviços ambíguos por ramo ficam null (preservam o fallback)", () => {
    // A produtora PRESTA esses serviços (são receita dela), mas para outra empresa
    // seriam despesa. Sem contexto de ramo, não se decide pela descrição.
    expect(inferDirectionFromDescription("Cobertura evento corporativo - Sicoob")).toBeNull();
    expect(inferDirectionFromDescription("Assessoria mensal - Loja Maravilha")).toBeNull();
    expect(inferDirectionFromDescription("Pagamento")).toBeNull();
  });

  it("termos de ambos os lados resolvem para null", () => {
    expect(inferDirectionFromDescription("recebimento de fornecedor")).toBeNull();
  });
});
