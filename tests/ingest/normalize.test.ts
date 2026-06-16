import { describe, it, expect } from "vitest";
import {
  normalizeDate,
  normalizeAmountCents,
  normalizeDirection,
  resolveDirection,
  detectColumns,
  detectMonthFirst,
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

  it("aceita ano de 2 dígitos com / e - (assume século 2000)", () => {
    expect(normalizeDate("30/04/26")).toBe("2026-04-30");
    expect(normalizeDate("01-12-26")).toBe("2026-12-01");
  });

  it("código contábil com ponto (1.1.01) NÃO é tratado como data", () => {
    // Ano de 2 dígitos só com / ou -; ponto exige ano de 4 dígitos.
    expect(normalizeDate("1.1.01")).toBeNull();
    expect(normalizeDate("1.2.03")).toBeNull();
    expect(normalizeDate("15.07.2026")).toBe("2026-07-15"); // ponto + ano 4 dígitos ainda vale
  });

  it("DD/MM sem ano usa o defaultYear (ano do mês de referência)", () => {
    expect(normalizeDate("01/09", false, "2026")).toBe("2026-09-01");
    expect(normalizeDate("31-12", false, "2025")).toBe("2025-12-31");
    expect(normalizeDate("4/16", true, "2026")).toBe("2026-04-16"); // MM/DD americano sem ano
  });

  it("DD/MM sem ano e sem defaultYear continua null (não inventa ano)", () => {
    expect(normalizeDate("01/09")).toBeNull();
    expect(normalizeDate("01/09", false)).toBeNull();
  });

  it("defaultYear não sobrescreve ano presente no dado", () => {
    expect(normalizeDate("30/04/2024", false, "2026")).toBe("2024-04-30");
  });

  it("desambigua por campo > 12 dentro da própria linha", () => {
    // 2º campo 16 > 12 → só pode ser dia → 1º campo é mês (MM/DD)
    expect(normalizeDate("4/16/26")).toBe("2026-04-16");
    // 1º campo 16 > 12 → só pode ser dia (DD/MM)
    expect(normalizeDate("16/04/26")).toBe("2026-04-16");
  });

  it("data ambígua usa a orientação do arquivo (monthFirst)", () => {
    expect(normalizeDate("5/10/26", false)).toBe("2026-10-05"); // DD/MM (default BR)
    expect(normalizeDate("5/10/26", true)).toBe("2026-05-10"); // MM/DD (americano)
  });
});

describe("ingest/normalize — detectMonthFirst (orientação por lote)", () => {
  it("detecta MM/DD quando algum 2º campo > 12 e nenhum 1º campo > 12", () => {
    expect(detectMonthFirst(["5/10/26", "4/16/26", "5/20/26"])).toBe(true);
  });

  it("detecta DD/MM (false) quando algum 1º campo > 12", () => {
    expect(detectMonthFirst(["16/04/26", "5/10/26"])).toBe(false);
  });

  it("ambíguo (todos campos ≤ 12) → false (default BR)", () => {
    expect(detectMonthFirst(["5/10/26", "3/8/26"])).toBe(false);
  });

  it("ignora valores não-data e vazios", () => {
    expect(detectMonthFirst([null, undefined, "texto", "4/16/26"])).toBe(true);
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

  it("rejeita overflow: 1e308, Infinity e acima do teto (caso de prod 2026-06-11)", () => {
    expect(normalizeAmountCents("1e308")).toBeNull();
    expect(normalizeAmountCents(1e308)).toBeNull();
    expect(normalizeAmountCents(1e22)).toBeNull();
    expect(normalizeAmountCents(Infinity)).toBeNull();
    // Acima de MAX_AMOUNT_CENTS (R$20M) — antes estourava o Int4 do Postgres.
    expect(normalizeAmountCents("999.999.999,99")).toBeNull();
    expect(normalizeAmountCents(20_000_000.01)).toBeNull();
  });

  it("aceita até o teto de R$20M", () => {
    expect(normalizeAmountCents(20_000_000)).toBe(2_000_000_000);
    expect(normalizeAmountCents("19.999.999,99")).toBe(1_999_999_999);
  });

  it("fileira de zeros vira 0 (não overflow)", () => {
    expect(normalizeAmountCents("0".repeat(60))).toBe(0);
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

  it("despesas de viagem corporativa viram débito (bug 2026-06-15: caía no fallback credit)", () => {
    // "Diária viagem cobertura - Belo Horizonte" não tinha termo na lista → fallback
    // credit → caixa do WhatsApp contava como entrada, divergindo do web (despesa).
    expect(inferDirectionFromDescription("Diária viagem cobertura - Belo Horizonte")).toBe("debit");
    expect(inferDirectionFromDescription("Hospedagem hotel BH - 2 diárias")).toBe("debit");
    expect(inferDirectionFromDescription("Passagem aérea São Paulo")).toBe("debit");
  });

  it("viagem em receita de mídia continua null quando há termo de crédito", () => {
    // guard: "cobertura/viagem" só viram crédito junto de venda/recebimento — senão a
    // ambiguidade é resolvida para débito (deslocamento). Aqui há "recebimento" → null.
    expect(inferDirectionFromDescription("recebimento cobertura viagem cliente")).toBeNull();
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
