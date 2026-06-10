import { describe, it, expect } from "vitest";
import { parseCsv } from "@/ingest/parsers/csv.js";

const buf = (s: string): Buffer => Buffer.from(s, "utf-8");

describe("ingest/parsers/csv — datas BR (regressão issue #161)", () => {
  it("interpreta DD/MM/YYYY como padrão BR, mesmo com dia <= 12 (o caso ambíguo)", () => {
    const r = parseCsv(
      buf(
        [
          "Data,Descricao,Valor",
          "02/06/2026,Venda PIX cliente A,1500.00",
          "05/06/2026,Pagamento fornecedor ABC,-800.00",
          "10/06/2026,Mensalidade software,-200.00",
        ].join("\n"),
      ),
    );

    expect(r.orphanCount).toBe(0);
    expect(r.entries.map((e) => e.date)).toEqual(["2026-06-02", "2026-06-05", "2026-06-10"]);
  });

  it("preserva o sinal negativo de valores numéricos (débito não vira crédito)", () => {
    const r = parseCsv(buf(["Data,Descricao,Valor", "02/06/2026,Tarifa,-200.00"].join("\n")));
    expect(r.entries[0]).toMatchObject({ amountCents: 20_000, direction: "debit" });
  });

  it("classifica entrada positiva como crédito", () => {
    const r = parseCsv(buf(["Data,Descricao,Valor", "02/06/2026,Recebimento,1500.00"].join("\n")));
    expect(r.entries[0]).toMatchObject({ amountCents: 150_000, direction: "credit" });
  });

  it("aceita YYYY-MM-DD sem alteração", () => {
    const r = parseCsv(buf(["Data,Descricao,Valor", "2026-06-02,Venda,100.00"].join("\n")));
    expect(r.entries[0]?.date).toBe("2026-06-02");
  });

  it("conta órfão em data inválida (31/02) sem derrubar a linha válida", () => {
    const r = parseCsv(
      buf(["Data,Descricao,Valor", "31/02/2026,Inexistente,100.00", "10/06/2026,Valido,200.00"].join("\n")),
    );
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]?.date).toBe("2026-06-10");
    expect(r.orphanCount).toBe(1);
  });
});

describe("ingest/parsers/csv — separadores e formatos", () => {
  it("detecta separador ';' com valores BR (1.234,56)", () => {
    const r = parseCsv(
      buf(["Data;Historico;Valor", "02/06/2026;Pix recebido;1.234,56", "03/06/2026;Boleto;-300,00"].join("\n")),
    );
    expect(r.entries[0]).toMatchObject({ date: "2026-06-02", amountCents: 123_456, direction: "credit" });
    expect(r.entries[1]).toMatchObject({ date: "2026-06-03", amountCents: 30_000, direction: "debit" });
  });

  it("respeita aspas com o separador dentro do campo de descrição", () => {
    const r = parseCsv(
      buf(["Data,Descricao,Valor", '02/06/2026,"Pagamento, parcela 1/3",-500.00'].join("\n")),
    );
    expect(r.entries[0]).toMatchObject({
      description: "Pagamento, parcela 1/3",
      amountCents: 50_000,
      direction: "debit",
    });
  });

  it("usa coluna explícita de direção (Tipo C/D) quando presente", () => {
    const r = parseCsv(
      buf(["Data,Historico,Valor,Tipo", "02/06/2026,Pix,1500.00,C", "03/06/2026,Boleto,300.00,D"].join("\n")),
    );
    expect(r.entries[0]).toMatchObject({ date: "2026-06-02", direction: "credit" });
    expect(r.entries[1]).toMatchObject({ date: "2026-06-03", direction: "debit" });
  });

  it("colunas separadas de crédito/débito (extrato Itaú)", () => {
    const r = parseCsv(
      buf(
        [
          "Data;Descricao;Credito (R$);Debito (R$)",
          "20/05/2026;PIX RECEBIDO;1.000,00;",
          "20/05/2026;PIX ENVIADO;;-1.000,00",
        ].join("\n"),
      ),
    );
    expect(r.entries).toEqual([
      { date: "2026-05-20", description: "PIX RECEBIDO", amountCents: 100_000, direction: "credit", directionSource: "explicit" },
      { date: "2026-05-20", description: "PIX ENVIADO", amountCents: 100_000, direction: "debit", directionSource: "explicit" },
    ]);
  });

  it("pula metadados antes do cabeçalho real", () => {
    const r = parseCsv(
      buf(
        [
          "EXTRATO DE CONTA",
          "Periodo de 01/06/2026 a 30/06/2026",
          "Data,Descricao,Valor",
          "02/06/2026,Pix,100.00",
        ].join("\n"),
      ),
    );
    expect(r.entries).toEqual([
      { date: "2026-06-02", description: "Pix", amountCents: 10_000, direction: "credit", directionSource: "fallback" },
    ]);
  });

  it("remove BOM UTF-8 do início (export do Excel BR)", () => {
    const r = parseCsv(buf("﻿Data,Descricao,Valor\n02/06/2026,Pix,100.00"));
    expect(r.entries[0]?.date).toBe("2026-06-02");
  });

  it("ignora linhas em branco no meio", () => {
    const r = parseCsv(
      buf(["Data,Descricao,Valor", "02/06/2026,Pix,100.00", "", "", "03/06/2026,Boleto,200.00"].join("\n")),
    );
    expect(r.entries).toHaveLength(2);
    expect(r.orphanCount).toBe(0);
  });
});

describe("ingest/parsers/csv — origem da direção", () => {
  it("positivo sem coluna de direção → 'fallback'; negativo → 'sign'", () => {
    const r = parseCsv(
      buf(
        [
          "Data,Descricao,Valor",
          "02/06/2026,Venda PIX cliente A,1500.00",
          "05/06/2026,Pagamento fornecedor ABC,-800.00",
        ].join("\n"),
      ),
    );
    expect(r.entries[0]).toMatchObject({ direction: "credit", directionSource: "fallback" });
    expect(r.entries[1]).toMatchObject({ direction: "debit", directionSource: "sign" });
  });

  it("coluna Tipo C/D preenchida → 'explicit'", () => {
    const r = parseCsv(
      buf(["Data,Historico,Valor,Tipo", "02/06/2026,Pix,1500.00,C", "03/06/2026,Boleto,300.00,D"].join("\n")),
    );
    expect(r.entries[0]?.directionSource).toBe("explicit");
    expect(r.entries[1]?.directionSource).toBe("explicit");
  });

  it("coluna Tipo presente mas vazia + positivo → 'fallback' (regressão CID & CID)", () => {
    const r = parseCsv(
      buf(["Data,Descricao,Valor,Tipo", "20/04/2026,DAS Simples Nacional,3870.00,"].join("\n")),
    );
    expect(r.entries[0]).toMatchObject({ direction: "credit", directionSource: "fallback" });
  });
});

describe("ingest/parsers/csv — robustez e segurança", () => {
  it("buffer vazio devolve resultado vazio sem throw", () => {
    expect(parseCsv(Buffer.alloc(0))).toEqual({ entries: [], orphanCount: 0 });
  });

  it("rejeita buffer > 20MB (mitigação alinhada à ADR-003)", () => {
    expect(() => parseCsv(Buffer.alloc(21 * 1024 * 1024))).toThrow(/csv-file-too-large/);
  });

  it("não recebe nem retorna tenantId — isolamento via service.ts (C8)", () => {
    const r = parseCsv(buf(["Data,Descricao,Valor", "02/06/2026,Pix,100.00"].join("\n")));
    expect(r).not.toHaveProperty("tenantId");
    expect(r.entries[0]).not.toHaveProperty("tenantId");
  });
});
