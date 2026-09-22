-- Failed sign-ins per (phone, address), replacing the account-wide lock
CREATE TABLE "LoginFailure" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginFailure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginFailure_phone_ip_createdAt_idx" ON "LoginFailure"("phone", "ip", "createdAt");
CREATE INDEX "LoginFailure_phone_createdAt_idx" ON "LoginFailure"("phone", "createdAt");
CREATE INDEX "LoginFailure_createdAt_idx" ON "LoginFailure"("createdAt");
