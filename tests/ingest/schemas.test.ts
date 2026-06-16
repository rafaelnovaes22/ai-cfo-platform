import { describe, it, expect } from "vitest";
import {
  ClipboardBody,
  ManualBody,
  MAX_CLIPBOARD_CHARS,
  MAX_MANUAL_ENTRIES,
} from "@/ingest/schemas.js";

// Payloads reais vistos em produção (2026-06-11): fileira de zeros no campo
// Valor, data lixo, texto/arrays sem limite. Estes testes são o contrato de que
// a borda HTTP rejeita ANTES de chegar em parser/Prisma.

const validEntry = {
  date: "2026-06-11",
  description: "Energia elétrica",
  amount: 1510.0,
  direction: "debit" as const,
};

function manualBody(entry: Omit<Partial<typeof validEntry>, "amount"> & { amount?: unknown }) {
  return { referenceMonth: "2026-06", entries: [{ ...validEntry, ...entry }] };
}

describe("ingest/schemas — ManualBody (payloads maliciosos)", () => {
  it("payload legítimo passa", () => {
    expect(ManualBody.safeParse(manualBody({})).success).toBe(true);
    expect(ManualBody.safeParse(manualBody({ amount: "1.510,00" })).success).toBe(true);
  });

  it("rejeita fileira de zeros gigante como string (caso de prod)", () => {
    const zeros = "0".repeat(60);
    expect(ManualBody.safeParse(manualBody({ amount: zeros })).success).toBe(false);
  });

  it("rejeita números absurdos: 1e22, 1e308, Infinity, > R$20M", () => {
    expect(ManualBody.safeParse(manualBody({ amount: 1e22 })).success).toBe(false);
    expect(ManualBody.safeParse(manualBody({ amount: 1e308 })).success).toBe(false);
    expect(ManualBody.safeParse(manualBody({ amount: Infinity })).success).toBe(false);
    expect(ManualBody.safeParse(manualBody({ amount: 20_000_001 })).success).toBe(false);
  });

  it("rejeita valor zero e negativo", () => {
    expect(ManualBody.safeParse(manualBody({ amount: 0 })).success).toBe(false);
    expect(ManualBody.safeParse(manualBody({ amount: -100 })).success).toBe(false);
  });

  it("rejeita data fora de YYYY-MM-DD", () => {
    for (const date of ["000000", "xyz", "11/06/2026", "2026-6-1", ""]) {
      expect(ManualBody.safeParse(manualBody({ date })).success, date).toBe(false);
    }
  });

  it("rejeita descrição gigante", () => {
    const description = "x".repeat(201);
    expect(ManualBody.safeParse(manualBody({ description })).success).toBe(false);
  });

  it("rejeita lote acima do máximo de entries", () => {
    const entries = Array.from({ length: MAX_MANUAL_ENTRIES + 1 }, () => validEntry);
    expect(ManualBody.safeParse({ referenceMonth: "2026-06", entries }).success).toBe(false);
  });
});

describe("ingest/schemas — ClipboardBody", () => {
  it("texto legítimo passa", () => {
    const body = { referenceMonth: "2026-06", text: "01/06\tCliente\t1.000,00" };
    expect(ClipboardBody.safeParse(body).success).toBe(true);
  });

  it("rejeita texto acima do limite", () => {
    const body = { referenceMonth: "2026-06", text: "x".repeat(MAX_CLIPBOARD_CHARS + 1) };
    expect(ClipboardBody.safeParse(body).success).toBe(false);
  });
});
