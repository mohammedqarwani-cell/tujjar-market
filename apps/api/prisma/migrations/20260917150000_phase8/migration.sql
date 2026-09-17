-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'CHANGE_PHONE';

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "openingSchedule" JSONB;
