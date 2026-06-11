import { describe, it, expect } from "vitest";
import { z } from "zod";
import { CashflowQuerySchema } from "@/cashflow/schema.js";

// Hardening de validação (auditoria 2026-06-11): bounds de range de datas e
// padrão uuid nos params. Ver docs/security/2026-06-11-input-validation-audit.md.

describe("cashflow query — bounds de range", () => {
  const base = { startDate: "2026-01-01", endDate: "2026-03-31" };

  it("range legítimo passa", () => {
    expect(CashflowQuerySchema.safeParse(base).success).toBe(true);
  });

  it("rejeita range de décadas (full scan)", () => {
    const q = { startDate: "1920-01-01", endDate: "2026-01-01" };
    expect(CashflowQuerySchema.safeParse(q).success).toBe(false);
  });

  it("aceita até 60 meses", () => {
    const q = { startDate: "2021-07-01", endDate: "2026-06-01" };
    expect(CashflowQuerySchema.safeParse(q).success).toBe(true);
  });

  it("rejeita category gigante", () => {
    const q = { ...base, category: "x".repeat(101) };
    expect(CashflowQuerySchema.safeParse(q).success).toBe(false);
  });
});

describe("params uuid — padrão dos módulos", () => {
  // O padrão aplicado em workspace/tenant-config/classification/dre-narrative/
  // action-plan: ids de rota são uuid, não string livre.
  const params = z.object({ analysisId: z.string().uuid() });

  it("uuid válido passa", () => {
    expect(params.safeParse({ analysisId: "62d492f9-f8be-4e37-b971-9a853556d717" }).success).toBe(true);
  });

  it("string livre é rejeitada", () => {
    for (const bad of ["abc", "1; DROP TABLE", "../../etc/passwd", "0".repeat(500)]) {
      expect(params.safeParse({ analysisId: bad }).success, bad).toBe(false);
    }
  });
});
