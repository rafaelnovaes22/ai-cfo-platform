import { describe, it, expect } from "vitest";
import {
  EXPORTABLE_STATUS,
  isExportableStatus,
  isSafeReferenceMonth,
  sanitizeReferenceMonth,
  buildExportFilename,
  decideExport,
} from "@/export/predicates.js";

describe("export/predicates — C4 status gate", () => {
  it("EXPORTABLE_STATUS contém apenas delivered e approved", () => {
    expect([...EXPORTABLE_STATUS].sort()).toEqual(["approved", "delivered"]);
  });

  it("isExportableStatus reconhece status válidos", () => {
    expect(isExportableStatus("delivered")).toBe(true);
    expect(isExportableStatus("approved")).toBe(true);
  });

  it("isExportableStatus rejeita status intermediários — tenant SHADOW não exporta", () => {
    expect(isExportableStatus("pending")).toBe(false);
    expect(isExportableStatus("generating")).toBe(false);
    expect(isExportableStatus("ready")).toBe(false); // ready = SHADOW pré-revisão
    expect(isExportableStatus("")).toBe(false);
    expect(isExportableStatus("DELIVERED")).toBe(false); // case-sensitive
  });
});

describe("export/predicates — C8 filename sanitization", () => {
  it("aceita YYYY-MM válido", () => {
    expect(isSafeReferenceMonth("2026-04")).toBe(true);
    expect(isSafeReferenceMonth("2026-12")).toBe(true);
  });

  it("rejeita formatos divergentes", () => {
    expect(isSafeReferenceMonth("2026-4")).toBe(false); // sem zero
    expect(isSafeReferenceMonth("2026/04")).toBe(false); // separador errado
    expect(isSafeReferenceMonth("26-04")).toBe(false); // ano truncado
    expect(isSafeReferenceMonth("")).toBe(false);
  });

  it("rejeita tentativas de injection", () => {
    expect(isSafeReferenceMonth("../../etc/passwd")).toBe(false);
    expect(isSafeReferenceMonth("2026-04.pdf\"; cat /etc/passwd")).toBe(false);
    expect(isSafeReferenceMonth("2026-04/../../escape")).toBe(false);
  });

  it("sanitizeReferenceMonth devolve 'invalid' quando perigoso", () => {
    expect(sanitizeReferenceMonth("../etc")).toBe("invalid");
    expect(sanitizeReferenceMonth("2026-04")).toBe("2026-04");
  });

  it("buildExportFilename usa sanitized + tipo + .pdf", () => {
    expect(buildExportFilename("2026-04", "monthly")).toBe("aicfo-2026-04-monthly.pdf");
    expect(buildExportFilename("2026-04", "investors")).toBe("aicfo-2026-04-investors.pdf");
    expect(buildExportFilename("2026-04", "partners")).toBe("aicfo-2026-04-partners.pdf");
  });

  it("buildExportFilename substitui referenceMonth perigoso por 'invalid'", () => {
    expect(buildExportFilename("../escape", "monthly")).toBe("aicfo-invalid-monthly.pdf");
  });
});

describe("export/predicates — decideExport", () => {
  it("null/undefined → not_found", () => {
    expect(decideExport(null).status).toBe("not_found");
    expect(decideExport(undefined).status).toBe("not_found");
  });

  it("status intermediário → status_gate (preserva valor original)", () => {
    const r = decideExport({ status: "ready", dreJson: { receitaBruta: 100 } });
    expect(r.status).toBe("status_gate");
    if (r.status === "status_gate") {
      expect(r.analysisStatus).toBe("ready");
    }
  });

  it("delivered sem dreJson → dre_missing", () => {
    expect(decideExport({ status: "delivered", dreJson: null }).status).toBe("dre_missing");
  });

  it("approved sem dreJson → dre_missing", () => {
    expect(decideExport({ status: "approved", dreJson: undefined }).status).toBe("dre_missing");
  });

  it("delivered + dreJson → ok", () => {
    expect(decideExport({ status: "delivered", dreJson: { x: 1 } }).status).toBe("ok");
  });

  it("approved + dreJson → ok", () => {
    expect(decideExport({ status: "approved", dreJson: { x: 1 } }).status).toBe("ok");
  });

  it("status_gate tem prioridade sobre dre_missing (C4 antes de C6)", () => {
    // Se analysis estiver com status errado E dre vazio, retornamos status_gate primeiro.
    // Razão: o cliente não deveria nem saber se a DRE existe quando o gate fecha.
    const r = decideExport({ status: "ready", dreJson: null });
    expect(r.status).toBe("status_gate");
  });
});
