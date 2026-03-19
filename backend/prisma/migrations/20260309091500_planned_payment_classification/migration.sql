-- AlterTable
ALTER TABLE "PlannedPayment"
ADD COLUMN "type" TEXT,
ALTER COLUMN "status" SET DEFAULT 'PLANNED';

-- Backfill type for existing rows before making it required
UPDATE "PlannedPayment"
SET "type" = 'PAYCHECK_PLAN'
WHERE "type" IS NULL;

-- Make type required
ALTER TABLE "PlannedPayment"
ALTER COLUMN "type" SET NOT NULL;

-- Normalize existing status values
UPDATE "PlannedPayment"
SET "status" = UPPER("status");
