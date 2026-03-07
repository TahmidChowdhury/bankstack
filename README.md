# BankStack 🏦

A full-stack personal finance dashboard that aggregates credit card balances, bank accounts, and transactions to help track debt and calculate optimal payoff strategies.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS (Node.js + TypeScript) |
| Frontend | Angular 19 |
| Database | PostgreSQL |
| ORM | Prisma |
| Bank Integration | Plaid API (sandbox + development) |

## Repository Structure

```
bankstack/
├── backend/          # NestJS API server
│   ├── src/
│   │   ├── plaid/    # Plaid integration module
│   │   ├── debt/     # Debt engine + payoff calculator
│   │   ├── snapshot/ # Daily balance snapshot scheduler
│   │   └── prisma/   # Prisma service (database client)
│   ├── prisma/
│   │   └── schema.prisma
│   └── prisma.config.ts
├── frontend/         # Angular app
│   └── src/app/
│       ├── dashboard/          # Dashboard page
│       ├── accounts/           # Accounts page
│       ├── transactions/       # Transactions page
│       ├── payoff-calculator/  # Debt payoff calculator
│       ├── nav/                # Sidebar navigation
│       └── services/           # ApiService
└── prisma/
    └── schema.prisma   # Root-level Prisma schema reference
```

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- A [Plaid](https://dashboard.plaid.com) account (free sandbox available)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/TahmidChowdhury/bankstack.git
cd bankstack

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Configure Environment Variables

```bash
# From the project root
cp .env.example .env
# Or from the backend directory
cp backend/.env.example backend/.env
```

Edit the `.env` file and fill in:

```env
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PLAID_ENV=sandbox
DATABASE_URL=postgresql://postgres:password@localhost:5432/bankstack
```

Get your Plaid credentials at [https://dashboard.plaid.com](https://dashboard.plaid.com).

### 3. Set Up the Database

Make sure PostgreSQL is running, then create the database and run migrations:

```bash
cd backend
npx prisma migrate dev --name init
# Or to just push the schema (no migration history):
npx prisma db push
```

### 4. Start the Backend

```bash
cd backend
npm run start:dev
```

The NestJS server starts on **http://localhost:3000**.

### 5. Start the Frontend

```bash
cd frontend
npm start
```

The Angular app starts on **http://localhost:4200**.

---

## API Endpoints

### Plaid Integration

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/plaid/link-token` | Generate a Plaid Link token |
| `POST` | `/plaid/exchange-token` | Exchange public token for access token |
| `GET` | `/accounts` | List all connected accounts |
| `GET` | `/transactions?accountId=` | List transactions (optional account filter) |
| `POST` | `/refresh-balances` | Refresh balances from Plaid |

### Debt Engine

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/debt/summary` | Get total debt, cash, and net worth |
| `POST` | `/debt/payoff-strategy` | Calculate avalanche payoff strategy |

#### Example: Payoff Strategy Request

```json
POST /debt/payoff-strategy
{
  "monthlyPayment": 500
}
```

#### Example: Payoff Strategy Response

```json
{
  "totalDebt": 8500.00,
  "totalCash": 3200.00,
  "netWorth": -5300.00,
  "highestAprDebt": {
    "name": "Chase Freedom",
    "balance": 3200.00,
    "apr": 24.99
  },
  "avalancheOrder": [],
  "payoffDate": "2026-09-01T00:00:00.000Z",
  "totalInterestSaved": 1240.50,
  "monthlyPayment": 500
}
```

---

## Database Schema

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
}

model Account {
  id               String   @id @default(cuid())
  plaidAccountId   String   @unique
  name             String
  type             String
  subtype          String?
  institution      String
  currentBalance   Float
  availableBalance Float?
  apr              Float?
  transactions     Transaction[]
}

model Transaction {
  id           String   @id @default(cuid())
  accountId    String
  amount       Float
  date         DateTime
  merchantName String?
  category     String?
  description  String?
}

model BalanceSnapshot {
  id        String   @id @default(cuid())
  totalCash Float
  totalDebt Float
  netWorth  Float
  createdAt DateTime @default(now())
}
```

---

## Frontend Pages

| Route | Page | Features |
|-------|------|---------|
| `/dashboard` | Dashboard | Net worth summary cards, account balances overview |
| `/accounts` | Accounts | Connected accounts grouped by type, APR display |
| `/transactions` | Transactions | Transaction history with account filter |
| `/payoff-calculator` | Payoff Calculator | Avalanche strategy calculator, payoff timeline |

---

## Features

### Plaid Integration
- Securely connect bank accounts and credit cards via Plaid Link
- Fetch real-time balances and transaction history
- Supports sandbox mode for development/testing

### Debt Engine
- Calculates total credit card debt, available cash, and net worth
- Identifies the highest APR debt to target first
- Implements the **avalanche payoff strategy** (highest-APR-first)
- Estimates payoff date and total interest saved

### Daily Snapshots
- A scheduled cron job runs every night at midnight
- Records daily snapshots of total cash, debt, and net worth
- Enables historical charting of financial progress

---

## Security

- Plaid credentials are stored as environment variables only
- Bank login credentials are **never** stored — Plaid handles authentication
- Only Plaid access tokens are stored (passed per-request; extend to DB if needed)
- CORS is restricted to `http://localhost:4200` by default

---

## Development

### Backend Commands

```bash
cd backend
npm run start:dev    # Start with hot reload
npm run build        # Production build
npm run test         # Run unit tests
npx prisma studio    # Open Prisma database GUI
```

### Frontend Commands

```bash
cd frontend
npm start            # Start dev server (port 4200)
npm run build        # Production build
npm test             # Run unit tests
```

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `PLAID_CLIENT_ID` | Plaid API client ID | `abc123...` |
| `PLAID_SECRET` | Plaid API secret key | `xyz789...` |
| `PLAID_ENV` | Plaid environment | `sandbox` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
