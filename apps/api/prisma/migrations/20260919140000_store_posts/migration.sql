-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('POST', 'REEL', 'STORY');
CREATE TYPE "PostStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'UNDER_REVIEW');

-- CreateTable
CREATE TABLE "StorePost" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" "PostKind" NOT NULL DEFAULT 'POST',
    "text" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videoUrl" TEXT,
    "productId" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StorePost_status_createdAt_idx" ON "StorePost"("status", "createdAt");
CREATE INDEX "StorePost_storeId_kind_createdAt_idx" ON "StorePost"("storeId", "kind", "createdAt");
CREATE INDEX "StorePost_kind_expiresAt_idx" ON "StorePost"("kind", "expiresAt");

-- AddForeignKey
ALTER TABLE "StorePost" ADD CONSTRAINT "StorePost_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorePost" ADD CONSTRAINT "StorePost_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A report can be about a published post
ALTER TABLE "Report" ADD COLUMN "postId" TEXT;
ALTER TABLE "Report" ADD CONSTRAINT "Report_postId_fkey" FOREIGN KEY ("postId") REFERENCES "StorePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
