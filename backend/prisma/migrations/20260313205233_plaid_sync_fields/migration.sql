-- AlterTable
ALTER TABLE "PlaidItem" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "syncCursor" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "pending" BOOLEAN NOT NULL DEFAULT false;
