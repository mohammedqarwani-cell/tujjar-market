-- CreateEnum
CREATE TYPE "GovernorateStatus" AS ENUM ('ACTIVE', 'COMING_SOON');

-- CreateEnum
CREATE TYPE "GeofenceStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Governorate" ADD COLUMN     "status" "GovernorateStatus" NOT NULL DEFAULT 'COMING_SOON';

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "geofenceStatus" "GeofenceStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Governorates that already have stores stay open; the rest start as "coming soon"
UPDATE "Governorate" g SET "status" = 'ACTIVE'
WHERE EXISTS (SELECT 1 FROM "Store" s WHERE s."governorateId" = g."id");

-- CreateTable
CREATE TABLE "MerchantInterest" (
    "id" TEXT NOT NULL,
    "governorateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "storeName" TEXT,
    "categoryId" TEXT,
    "contactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MerchantInterest_governorateId_createdAt_idx" ON "MerchantInterest"("governorateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantInterest_governorateId_phone_key" ON "MerchantInterest"("governorateId", "phone");

-- AddForeignKey
ALTER TABLE "MerchantInterest" ADD CONSTRAINT "MerchantInterest_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "Governorate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantInterest" ADD CONSTRAINT "MerchantInterest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
