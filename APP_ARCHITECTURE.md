# BankStack Architecture Notes

This file is the short, practical map of the app.
Use it as the first stop before exploring the full codebase.

## Golden Path

1. Run from root with `npm run dev`.
2. Frontend talks to backend at http://localhost:3000.
3. Backend reads and writes Postgres through Prisma.
4. Most planning quality depends on account metadata completeness.

## What Runs Where

- Backend app: `backend/src/main.ts`
- Backend modules: `backend/src/*`
- Frontend app routes: `frontend/src/app/app.routes.ts`
- Shared API typing on frontend: `frontend/src/app/services/api.service.ts`

## Primary User Surfaces

- `/dashboard`: operational decision surface
- `/accounts`: account metadata quality control
- `/transactions`: activity history
- `/debt-plan`: longer-range payoff simulation
- `/payoff-calculator`: strategy sandbox

## Current Account Balance Rules

Credit accounts:

- `creditLimit` is the editable allowance.
- `currentBalance` is what is owed now.
- `availableBalance` is derived in UI save flow when `creditLimit` is present:
  - `availableBalance = creditLimit - currentBalance`
- Utilization uses limit first, then fallback estimate when needed.

Depository accounts:

- Difference between current and available is shown as pending/holds insight.

## Canonical Schema and Migrations

- Runtime schema: `backend/prisma/schema.prisma`
- Migration history: `backend/prisma/migrations/`
- Keep root `prisma/schema.prisma` aligned if it is used by tooling/docs.

When schema changes:

1. Add migration.
2. Apply migration.
3. Run Prisma generate in backend.

## Why Accounts Sometimes "Fail To Load"

Most likely causes:

1. Backend is not running on port 3000.
2. Prisma client is stale after schema changes.
3. Frontend is up, backend is down.

Fast check:

- `curl http://localhost:3000/accounts`

If compile errors mention unknown Prisma fields, run:

- `cd backend && npx prisma generate`

## Keep It Simple Rules

- Prefer one blessed command per workflow.
- If a field is derived, render it read-only.
- Avoid introducing abstraction unless duplication appears repeatedly.
- Prioritize clarity in labels over adding controls.
- Add tests only around business rules that can regress.

## Near-Term Risk Areas

- Two schema files can drift.
- Plaid enrichment for debt fields can be partial by institution.
- Incomplete account metadata weakens planning confidence.

## Minimal Weekly Hygiene

1. Confirm root `npm run dev` still starts both services.
2. Verify `/accounts` edits persist correctly.
3. Run one quick API check: `GET /accounts`.
4. Keep this file updated when behavior changes.
