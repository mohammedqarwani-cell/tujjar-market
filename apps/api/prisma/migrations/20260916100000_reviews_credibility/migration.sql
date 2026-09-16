-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PUBLISHED', 'UNDER_REVIEW', 'HIDDEN');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "ratingAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reportingBlockedUntil" TIMESTAMP(3),
ADD COLUMN     "reportsConfirmed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reportsDismissed" INTEGER NOT NULL DEFAULT 0;

-- Reporters keep the credibility they already earned from decided reports
UPDATE "User" u SET
  "reportsConfirmed" = (SELECT count(*) FROM "Report" r WHERE r."reporterId" = u."id" AND r."status" = 'RESOLVED'),
  "reportsDismissed" = (SELECT count(*) FROM "Report" r WHERE r."reporterId" = u."id" AND r."status" = 'DISMISSED');

-- CreateTable
CREATE TABLE "StoreContact" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "firstContactAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastContactAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contacts" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StoreContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "moderationNote" TEXT,
    "merchantReply" TEXT,
    "merchantRepliedAt" TIMESTAMP(3),
    "flagOpen" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "flaggedAt" TIMESTAMP(3),
    "moderatedById" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreContact_buyerId_idx" ON "StoreContact"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreContact_storeId_buyerId_key" ON "StoreContact"("storeId", "buyerId");

-- CreateIndex
CREATE INDEX "Review_storeId_status_createdAt_idx" ON "Review"("storeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_storeId_buyerId_key" ON "Review"("storeId", "buyerId");

-- AddForeignKey
ALTER TABLE "StoreContact" ADD CONSTRAINT "StoreContact_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreContact" ADD CONSTRAINT "StoreContact_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
