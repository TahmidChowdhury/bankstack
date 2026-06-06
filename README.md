# BankStack

BankStack is a personal finance workspace centered on a practical weekly loop:

1. Update account balances and payment metadata in Accounts.
2. Work from the Dashboard calendar to execute required payments.
3. Use advanced tools only when needed.

## Current UX Direction

Primary surfaces:

- Dashboard
- Accounts

Secondary surfaces (reachable from Dashboard "Advanced Tools"):

- Transactions
- Payoff Calculator
- Debt Plan

## Stack

- Backend: NestJS + Prisma + PostgreSQL
- Frontend: Angular
- Bank connectivity: Plaid (optional, sandbox/development)

## Quick Start

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Configure environment

Create a root `.env` and set at least:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/bankstack
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENV=sandbox
```

### 3. Run migrations

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

### 4. Start the app

```bash
npm run dev
```

This starts:

- Backend: http://localhost:3000
- Frontend: http://localhost:4200

Use HTTP for local frontend access (not HTTPS).

## Common Commands

Root:

```bash
npm run dev
npm run start
npm run start:backend
npm run start:frontend
```

Backend:

```bash
cd backend
npm run dev
npm run build
npm run test
npx prisma generate
```

Frontend:

```bash
cd frontend
npm run start
npm run build
npm run test
```

## Canonical Docs

Use these as source of truth:

- Architecture and operational map: APP_ARCHITECTURE.md
- Product simplification roadmap: docs/SIMPLIFICATION_INITIATIVE.md

Local-only notes (gitignored):

- notes/

## Notes

- Snapshot-based debt progress is available from backend snapshots.
- Manual account updates can still drive progress tracking via snapshot capture.
- Recurring monthly obligations remain backend-first through recurring-expense and cashflow logic.
