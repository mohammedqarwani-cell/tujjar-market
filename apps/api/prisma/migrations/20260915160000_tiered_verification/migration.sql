-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('REGISTERED', 'IDENTITY', 'LOCATION', 'PREMIUM');

-- CreateEnum
CREATE TYPE "VerificationKind" AS ENUM ('IDENTITY', 'LOCATION');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GeoCheck" AS ENUM ('INSIDE', 'OUTSIDE', 'NO_GEOFENCE');

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "radiusMeters" INTEGER;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "attestedAt" TIMESTAMP(3),
ADD COLUMN     "badgeRestoredAt" TIMESTAMP(3),
ADD COLUMN     "badgeSuspendedAt" TIMESTAMP(3),
ADD COLUMN     "earnedLevel" "VerificationLevel" NOT NULL DEFAULT 'REGISTERED',
ADD COLUMN     "verificationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "verificationLevel" "VerificationLevel" NOT NULL DEFAULT 'REGISTERED';

-- Stores verified under the old yes/no flag keep a verified-shop badge until their first yearly renewal
UPDATE "Store"
SET "verificationLevel" = 'LOCATION', "earnedLevel" = 'LOCATION', "verificationExpiresAt" = NOW() + INTERVAL '1 year'
WHERE "isVerified" = true;

-- AlterTable
ALTER TABLE "Store" DROP COLUMN "isVerified";

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "VerificationKind" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "files" JSONB NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3),
    "geoCheck" "GeoCheck",
    "distanceMeters" INTEGER,
    "rejectReason" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationRequest_status_kind_createdAt_idx" ON "VerificationRequest"("status", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationRequest_storeId_createdAt_idx" ON "VerificationRequest"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Store_status_verificationLevel_idx" ON "Store"("status", "verificationLevel");

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
