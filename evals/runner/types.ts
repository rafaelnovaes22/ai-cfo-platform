export type SourceMode = "real" | "synthetic" | "edge" | "adversarial";

export interface CaseFrontmatter {
  caseId: string;
  module: string;
  outcome: string;
  sourceMode: SourceMode;
  priority?: string;
  createdAt?: string;
}

export interface CaseFile extends CaseFrontmatter {
  filePath: string;
  body: string;
}

export interface ClassificationInput {
  description: string;
  amountCents: number;
  // "unknown" = arquivo de origem sem marcação de sentido (PR #164)
  direction: "credit" | "debit" | "unknown";
  date: string;
  tenantContext?: Record<string, unknown>;
}

export interface ClassificationGroundTruth {
  expectedCategory: string;
  expectedConfidenceMin?: number;
  expectedConfidenceMax?: number;
  acceptableAlternatives: string[];
}

export interface CaseResult {
  caseId: string;
  outcome: string;
  sourceMode: string;
  passed: boolean;
  predicted: string | null;
  expected: string | null;
  confidence: number | null;
  reason: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

export interface BucketSummary {
  total: number;
  passed: number;
  passRate: number;
  threshold?: number;
  thresholdMet?: boolean;
}

export interface RunSummary {
  module: string;
  evalMethod: string;
  promptHash: string;
  model: string;
  provider: string;
  totalCases: number;
  attemptedCases: number;
  passed: number;
  failed: number;
  passRate: number;
  passRateThreshold: number;
  passRatePerOutcome?: Record<string, number>;
  thresholdMet: boolean;
  totalCostCents: number;
  totalLatencyMs: number;
  startedAt: string;
  finishedAt: string;
  byOutcome: Record<string, BucketSummary>;
  bySourceMode: Record<string, BucketSummary>;
  cases: CaseResult[];
}
