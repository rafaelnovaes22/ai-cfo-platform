import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must be declared before imports that depend on them.

const tenantMemoryCreateMock = vi.fn();
const validationMetricCreateMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/persistence/prisma.js", () => ({
  getPrisma: () => ({
    $transaction: transactionMock,
    tenantMemoryItem: {
      create: tenantMemoryCreateMock,
    },
    validationMetric: {
      create: validationMetricCreateMock,
    },
  }),
}));

// BullMQ Worker is not needed for unit testing handler functions directly.
vi.mock("bullmq", () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

// Gate de autonomia é testado separadamente em autonomy-gate.test.ts
vi.mock("@/learning/autonomy-gate.js", () => ({
  evaluateAutonomyGate: vi.fn().mockResolvedValue("needs_review"),
  updateTenantAutonomy: vi.fn().mockResolvedValue(undefined),
}));

// Promoter global é testado separadamente em global-signal-promoter.test.ts
vi.mock("@/learning/global-signal-promoter.js", () => ({
  checkAndPromoteToGlobal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/observability/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  handleClassificationCorrected,
  handleClassificationValidated,
} from "@/learning/self-harness-worker.js";
import type { HarnessJobCorrected, HarnessJobValidated } from "@/queue/index.js";

beforeEach(() => {
  tenantMemoryCreateMock.mockReset();
  validationMetricCreateMock.mockReset();
  transactionMock.mockReset();
  // $transaction receives an array of Prisma promises — execute them to capture the calls
  transactionMock.mockImplementation(async (ops: Promise<unknown>[]) => {
    return Promise.all(ops);
  });
  tenantMemoryCreateMock.mockResolvedValue({ id: "mem-1" });
  validationMetricCreateMock.mockResolvedValue({ id: "val-1" });
});

describe("self-harness-worker — handleClassificationCorrected", () => {
  it("cria TenantMemoryItem e ValidationMetric negative com confidenceBand easy quando confidence=0.9", async () => {
    const job: HarnessJobCorrected = {
      type: "classification.corrected",
      tenantId: "tenant-1",
      entryId: "entry-1",
      description: "Aluguel do galpão",
      predictedCategory: "outras_despesas",
      correctedCategory: "custo_fixo",
      confidence: 0.9,
      segment: "servicos-b2b",
    };

    await handleClassificationCorrected(job);

    expect(transactionMock).toHaveBeenCalledOnce();
    expect(tenantMemoryCreateMock).toHaveBeenCalledOnce();
    expect(validationMetricCreateMock).toHaveBeenCalledOnce();

    const memoryArg = tenantMemoryCreateMock.mock.calls[0]?.[0];
    expect(memoryArg.data.tenantId).toBe("tenant-1");
    expect(memoryArg.data.kind).toBe("fact");
    expect(memoryArg.data.confidence).toBe(1.0);
    expect(memoryArg.data.content).toMatchObject({
      description: "Aluguel do galpão",
      category: "custo_fixo",
      originalPrediction: "outras_despesas",
      source: "client_correction",
    });

    const metricArg = validationMetricCreateMock.mock.calls[0]?.[0];
    expect(metricArg.data.tenantId).toBe("tenant-1");
    expect(metricArg.data.agentName).toBe("classification");
    expect(metricArg.data.signal).toBe("negative");
    expect(metricArg.data.refType).toBe("ledger_entry");
    expect(metricArg.data.refId).toBe("entry-1");
    expect(metricArg.data.confidenceBand).toBe("easy");
  });

  it("confidenceBand hard quando confidence=0.7", async () => {
    const job: HarnessJobCorrected = {
      type: "classification.corrected",
      tenantId: "tenant-2",
      entryId: "entry-2",
      description: "Pix fornecedor",
      predictedCategory: "receita_bruta",
      correctedCategory: "custo_variavel",
      confidence: 0.7,
      segment: "geral",
    };

    await handleClassificationCorrected(job);

    const metricArg = validationMetricCreateMock.mock.calls[0]?.[0];
    expect(metricArg.data.confidenceBand).toBe("hard");
  });

  it("confidenceBand null quando confidence=null", async () => {
    const job: HarnessJobCorrected = {
      type: "classification.corrected",
      tenantId: "tenant-3",
      entryId: "entry-3",
      description: "Transferência interna",
      predictedCategory: null,
      correctedCategory: "nao_classificado",
      confidence: null,
      segment: "geral",
    };

    await handleClassificationCorrected(job);

    const metricArg = validationMetricCreateMock.mock.calls[0]?.[0];
    expect(metricArg.data.confidenceBand).toBeNull();
  });

  it("content.originalPrediction é null quando predictedCategory é null", async () => {
    const job: HarnessJobCorrected = {
      type: "classification.corrected",
      tenantId: "tenant-4",
      entryId: "entry-4",
      description: "Saldo inicial",
      predictedCategory: null,
      correctedCategory: "receita_bruta",
      confidence: 0.95,
      segment: "saas",
    };

    await handleClassificationCorrected(job);

    const memoryArg = tenantMemoryCreateMock.mock.calls[0]?.[0];
    expect(memoryArg.data.content.originalPrediction).toBeNull();
  });
});

describe("self-harness-worker — handleClassificationValidated", () => {
  it("cria apenas ValidationMetric com signal positive", async () => {
    const job: HarnessJobValidated = {
      type: "classification.validated",
      tenantId: "tenant-5",
      entryId: "entry-5",
      confidence: 0.95,
    };

    await handleClassificationValidated(job);

    // $transaction não deve ser chamado — a validated path usa create diretamente
    expect(transactionMock).not.toHaveBeenCalled();
    expect(tenantMemoryCreateMock).not.toHaveBeenCalled();
    expect(validationMetricCreateMock).toHaveBeenCalledOnce();

    const metricArg = validationMetricCreateMock.mock.calls[0]?.[0];
    expect(metricArg.data.signal).toBe("positive");
    expect(metricArg.data.agentName).toBe("classification");
    expect(metricArg.data.refType).toBe("ledger_entry");
    expect(metricArg.data.refId).toBe("entry-5");
  });

  it("confidenceBand easy quando confidence >= 0.85", async () => {
    const job: HarnessJobValidated = {
      type: "classification.validated",
      tenantId: "tenant-6",
      entryId: "entry-6",
      confidence: 0.92,
    };

    await handleClassificationValidated(job);

    const metricArg = validationMetricCreateMock.mock.calls[0]?.[0];
    expect(metricArg.data.confidenceBand).toBe("easy");
  });
});
