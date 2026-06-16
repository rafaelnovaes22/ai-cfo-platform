-- AlterEnum
ALTER TYPE "SubscriptionPlan" ADD VALUE 'student';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappOptInAt" TIMESTAMP(3),
ADD COLUMN     "whatsappPhone" TEXT;
