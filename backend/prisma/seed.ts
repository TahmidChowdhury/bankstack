import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

type SeedItem = {
  plaidItemId: string;
  institution: string;
  accessToken: string;
};

type SeedAccount = {
  plaidAccountId: string;
  name: string;
  type: string;
  subtype?: string | null;
  institution: string;
  currentBalance: number;
  availableBalance?: number | null;
  minimumPayment?: number | null;
  dueDayOfMonth?: number | null;
  apr?: number | null;
};

type SeedTransaction = {
  plaidTransactionId: string;
  plaidAccountId: string;
  amount: number;
  date: string;
  merchantName?: string | null;
  category?: string | null;
  description?: string | null;
};

type SeedIncomeSource = {
  source: string;
  monthlyIncome: number;
  perPaycheckAmount: number;
  payDays: number[];
};

type SeedPayload = {
  item?: SeedItem | null;
  accounts: SeedAccount[];
  transactions: SeedTransaction[];
  incomeSources: SeedIncomeSource[];
  recurringExpenses: SeedRecurringExpense[];
};

type SeedRecurringExpense = {
  name: string;
  category: string;
  amount: number;
  dayOfMonth: number;
  plaidAccountId: string;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function requireString(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Invalid seed payload: "${fieldName}" must be a non-empty string.`);
  }
  return trimmed;
}

async function loadSeedPayload(): Promise<SeedPayload> {
  const dataPath = path.resolve(process.cwd(), 'prisma/seed-data.json');
  const raw = await readFile(dataPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<SeedPayload>;

  return {
    item: parsed.item ?? null,
    accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    incomeSources: Array.isArray(parsed.incomeSources) ? parsed.incomeSources : [],
    recurringExpenses: Array.isArray(parsed.recurringExpenses)
      ? parsed.recurringExpenses
      : [],
  };
}

async function main() {
  const wipeExisting = process.env.SEED_WIPE === 'true';
  const payload = await loadSeedPayload();

  let createdAccounts = 0;
  let updatedAccounts = 0;
  let createdTransactions = 0;
  let updatedTransactions = 0;
  let createdIncomeSources = 0;
  let updatedIncomeSources = 0;
  let createdRecurringExpenses = 0;
  let updatedRecurringExpenses = 0;

  await prisma.$transaction(async (tx) => {
    if (wipeExisting) {
      await tx.recurringExpense.deleteMany();
      await tx.transaction.deleteMany();
      await tx.account.deleteMany();
      await tx.plaidItem.deleteMany();
      await tx.incomeSource.deleteMany();
    }

    let plaidItemId: string | null = null;
    if (payload.item) {
      const item = payload.item;
      const existingItem = await tx.plaidItem.findUnique({
        where: { plaidItemId: requireString(item.plaidItemId, 'item.plaidItemId') },
        select: { id: true },
      });

      const upsertedItem = await tx.plaidItem.upsert({
        where: { plaidItemId: requireString(item.plaidItemId, 'item.plaidItemId') },
        update: {
          institution: requireString(item.institution, 'item.institution'),
          accessToken: requireString(item.accessToken, 'item.accessToken'),
        },
        create: {
          plaidItemId: requireString(item.plaidItemId, 'item.plaidItemId'),
          institution: requireString(item.institution, 'item.institution'),
          accessToken: requireString(item.accessToken, 'item.accessToken'),
        },
      });

      plaidItemId = upsertedItem.id;

      if (existingItem) {
        // no-op; included for symmetry with other upsert logging
      }
    }

    const accountIdByPlaidAccountId = new Map<string, string>();

    for (const account of payload.accounts) {
      const plaidAccountId = requireString(
        account.plaidAccountId,
        'accounts[].plaidAccountId',
      );

      const existingAccount = await tx.account.findUnique({
        where: { plaidAccountId },
        select: { id: true },
      });

      const upsertedAccount = await tx.account.upsert({
        where: { plaidAccountId },
        update: {
          plaidItemId,
          name: requireString(account.name, 'accounts[].name'),
          type: requireString(account.type, 'accounts[].type'),
          subtype: account.subtype ?? null,
          institution: requireString(account.institution, 'accounts[].institution'),
          currentBalance: account.currentBalance,
          availableBalance: account.availableBalance ?? null,
          minimumPayment: account.minimumPayment ?? null,
          dueDayOfMonth: account.dueDayOfMonth ?? null,
          apr: account.apr ?? null,
        },
        create: {
          plaidItemId,
          plaidAccountId,
          name: requireString(account.name, 'accounts[].name'),
          type: requireString(account.type, 'accounts[].type'),
          subtype: account.subtype ?? null,
          institution: requireString(account.institution, 'accounts[].institution'),
          currentBalance: account.currentBalance,
          availableBalance: account.availableBalance ?? null,
          minimumPayment: account.minimumPayment ?? null,
          dueDayOfMonth: account.dueDayOfMonth ?? null,
          apr: account.apr ?? null,
        },
      });

      if (existingAccount) {
        updatedAccounts += 1;
      } else {
        createdAccounts += 1;
      }

      accountIdByPlaidAccountId.set(plaidAccountId, upsertedAccount.id);
    }

    for (const txn of payload.transactions) {
      const plaidTransactionId = requireString(
        txn.plaidTransactionId,
        'transactions[].plaidTransactionId',
      );
      const plaidAccountId = requireString(
        txn.plaidAccountId,
        'transactions[].plaidAccountId',
      );

      const accountId =
        accountIdByPlaidAccountId.get(plaidAccountId) ??
        (
          await tx.account.findUnique({
            where: { plaidAccountId },
            select: { id: true },
          })
        )?.id;

      if (!accountId) {
        throw new Error(
          `Invalid seed payload: no account found for transactions[].plaidAccountId "${plaidAccountId}".`,
        );
      }

      const existingTxn = await tx.transaction.findUnique({
        where: { plaidTransactionId },
        select: { id: true },
      });

      await tx.transaction.upsert({
        where: { plaidTransactionId },
        update: {
          accountId,
          amount: txn.amount,
          date: new Date(txn.date),
          merchantName: txn.merchantName ?? null,
          category: txn.category ?? null,
          description: txn.description ?? null,
        },
        create: {
          plaidTransactionId,
          accountId,
          amount: txn.amount,
          date: new Date(txn.date),
          merchantName: txn.merchantName ?? null,
          category: txn.category ?? null,
          description: txn.description ?? null,
        },
      });

      if (existingTxn) {
        updatedTransactions += 1;
      } else {
        createdTransactions += 1;
      }
    }

    for (const incomeSource of payload.incomeSources) {
      const source = requireString(incomeSource.source, 'incomeSources[].source');
      const existingIncomeSource = await tx.incomeSource.findUnique({
        where: { source },
        select: { id: true },
      });

      await tx.incomeSource.upsert({
        where: { source },
        update: {
          monthlyIncome: incomeSource.monthlyIncome,
          perPaycheckAmount: incomeSource.perPaycheckAmount,
          payDays: Array.isArray(incomeSource.payDays) ? incomeSource.payDays : [],
        },
        create: {
          source,
          monthlyIncome: incomeSource.monthlyIncome,
          perPaycheckAmount: incomeSource.perPaycheckAmount,
          payDays: Array.isArray(incomeSource.payDays) ? incomeSource.payDays : [],
        },
      });

      if (existingIncomeSource) {
        updatedIncomeSources += 1;
      } else {
        createdIncomeSources += 1;
      }
    }

    for (const recurringExpense of payload.recurringExpenses) {
      const plaidAccountId = requireString(
        recurringExpense.plaidAccountId,
        'recurringExpenses[].plaidAccountId',
      );
      const accountId =
        accountIdByPlaidAccountId.get(plaidAccountId) ??
        (
          await tx.account.findUnique({
            where: { plaidAccountId },
            select: { id: true },
          })
        )?.id;

      if (!accountId) {
        throw new Error(
          `Invalid seed payload: no account found for recurringExpenses[].plaidAccountId "${plaidAccountId}".`,
        );
      }

      const name = requireString(recurringExpense.name, 'recurringExpenses[].name');
      const dayOfMonth = Math.floor(recurringExpense.dayOfMonth);
      if (dayOfMonth < 1 || dayOfMonth > 31) {
        throw new Error(
          'Invalid seed payload: recurringExpenses[].dayOfMonth must be between 1 and 31.',
        );
      }

      const existingRecurring = await tx.recurringExpense.findUnique({
        where: {
          name_accountId_dayOfMonth: {
            name,
            accountId,
            dayOfMonth,
          },
        },
        select: { id: true },
      });

      await tx.recurringExpense.upsert({
        where: {
          name_accountId_dayOfMonth: {
            name,
            accountId,
            dayOfMonth,
          },
        },
        update: {
          category: requireString(recurringExpense.category, 'recurringExpenses[].category'),
          amount: recurringExpense.amount,
        },
        create: {
          name,
          category: requireString(recurringExpense.category, 'recurringExpenses[].category'),
          amount: recurringExpense.amount,
          dayOfMonth,
          accountId,
        },
      });

      if (existingRecurring) {
        updatedRecurringExpenses += 1;
      } else {
        createdRecurringExpenses += 1;
      }
    }
  });

  console.log(
    [
      `Seed complete.`,
      `Accounts: ${createdAccounts} created, ${updatedAccounts} updated.`,
      `Transactions: ${createdTransactions} created, ${updatedTransactions} updated.`,
      `Income sources: ${createdIncomeSources} created, ${updatedIncomeSources} updated.`,
      `Recurring expenses: ${createdRecurringExpenses} created, ${updatedRecurringExpenses} updated.`,
      `Wipe mode: ${wipeExisting ? 'on' : 'off'}.`,
    ].join(' '),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
