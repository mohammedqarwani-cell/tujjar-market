-- PostgreSQL only allows a new enum value to be used after the transaction that adds it
-- commits, so the new roles get their own migration before "role" defaults to BUYER.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MODERATOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'FIELD_AGENT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BUYER';
