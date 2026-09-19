-- An order now carries several lines, so a buyer fills one basket per shop
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "unitPrice" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineTotal" INTEGER,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing single-product orders become one-line orders
INSERT INTO "OrderItem" ("id", "orderId", "productId", "title", "unitPrice", "quantity", "lineTotal")
SELECT md5(random()::text || clock_timestamp()::text), "id", "productId", "productTitle", "unitPrice", "quantity", "total"
FROM "Order";

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_productId_fkey";
ALTER TABLE "Order" DROP COLUMN "productId",
                   DROP COLUMN "productTitle",
                   DROP COLUMN "quantity",
                   DROP COLUMN "unitPrice";
