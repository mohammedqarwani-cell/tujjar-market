-- CreateTable
CREATE TABLE "StorePromotion" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorePromotion_isActive_sortOrder_idx" ON "StorePromotion"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "StorePromotion_storeId_idx" ON "StorePromotion"("storeId");

-- AddForeignKey
ALTER TABLE "StorePromotion" ADD CONSTRAINT "StorePromotion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
