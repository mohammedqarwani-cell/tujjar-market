-- The short-lived "Lead" request replaced by a full purchase order
DROP TABLE IF EXISTS "Lead";
DROP TYPE IF EXISTS "LeadStatus";

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'CONFIRMED', 'DONE', 'CANCELLED');
CREATE TYPE "Fulfillment" AS ENUM ('DELIVERY', 'PICKUP');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'CASH_AT_SHOP', 'TRANSFER');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "ref" SERIAL NOT NULL,
    "storeId" TEXT NOT NULL,
    "productId" TEXT,
    "buyerId" TEXT,
    "productTitle" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'SYP',
    "total" INTEGER,
    "fulfillment" "Fulfillment" NOT NULL DEFAULT 'DELIVERY',
    "governorateId" TEXT,
    "address" TEXT,
    "payment" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    "note" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "deliveryFee" INTEGER,
    "merchantNote" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_ref_key" ON "Order"("ref");
CREATE INDEX "Order_storeId_status_createdAt_idx" ON "Order"("storeId", "status", "createdAt");
CREATE INDEX "Order_buyerId_createdAt_idx" ON "Order"("buyerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_governorateId_fkey" FOREIGN KEY ("governorateId") REFERENCES "Governorate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
