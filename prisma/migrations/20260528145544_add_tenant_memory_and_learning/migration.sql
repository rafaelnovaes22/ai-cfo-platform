-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "learningAutonomyState" JSONB NOT NULL DEFAULT '{"classification":"needs_review","narrative":"needs_review","action":"needs_review"}';

-- CreateTable
CREATE TABLE "TenantMemoryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "evidenceRefs" JSONB NOT NULL DEFAULT '[]',
    "clientEdited" BOOLEAN NOT NULL DEFAULT false,
    "dismissedAt" TIMESTAMP(3),
    "dismissalReason" TEXT,
    "contributesToGlobal" BOOLEAN NOT NULL DEFAULT false,
    "globalSignalId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalSignal" (
    "id" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "contributorCount" INTEGER NOT NULL DEFAULT 0,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "GlobalSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationMetric" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "confidenceBand" TEXT,
    "signal" TEXT NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValidationMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalRetention" (
    "id" TEXT NOT NULL,
    "originalTenantId" TEXT NOT NULL,
    "cnpj" TEXT,
    "retainedData" JSONB NOT NULL,
    "retentionUntil" TIMESTAMP(3) NOT NULL,
    "forgottenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "termAcceptedHash" TEXT NOT NULL,

    CONSTRAINT "LegalRetention_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantMemoryItem_tenantId_kind_idx" ON "TenantMemoryItem"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "TenantMemoryItem_globalSignalId_idx" ON "TenantMemoryItem"("globalSignalId");

-- CreateIndex
CREATE INDEX "GlobalSignal_segment_kind_idx" ON "GlobalSignal"("segment", "kind");

-- CreateIndex
CREATE INDEX "ValidationMetric_tenantId_agentName_observedAt_idx" ON "ValidationMetric"("tenantId", "agentName", "observedAt");

-- CreateIndex
CREATE INDEX "LegalRetention_retentionUntil_idx" ON "LegalRetention"("retentionUntil");

-- AddForeignKey
ALTER TABLE "TenantMemoryItem" ADD CONSTRAINT "TenantMemoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationMetric" ADD CONSTRAINT "ValidationMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
