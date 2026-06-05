-- CreateEnum
CREATE TYPE "WaMsgDirection" AS ENUM ('outbound', 'inbound');

-- CreateEnum
CREATE TYPE "WaMsgKind" AS ENUM ('daily_cashflow', 'cashflow_from_statement', 'analysis_ready', 'reply', 'other');

-- CreateEnum
CREATE TYPE "WaMsgStatus" AS ENUM ('sent', 'delivered', 'read', 'failed', 'skipped_disabled');

-- CreateTable
CREATE TABLE "WhatsappMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "direction" "WaMsgDirection" NOT NULL,
    "kind" "WaMsgKind" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "WaMsgStatus" NOT NULL,
    "providerMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappMessage_tenantId_createdAt_idx" ON "WhatsappMessage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsappMessage_providerMessageId_idx" ON "WhatsappMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsappMessage_createdAt_idx" ON "WhatsappMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
