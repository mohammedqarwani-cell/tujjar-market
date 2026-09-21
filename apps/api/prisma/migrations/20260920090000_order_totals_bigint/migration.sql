-- Order totals can exceed Int32 (a line reaches 2,000,000,000 × 9999)
ALTER TABLE "Order" ALTER COLUMN "total" SET DATA TYPE BIGINT;
ALTER TABLE "OrderItem" ALTER COLUMN "lineTotal" SET DATA TYPE BIGINT;
