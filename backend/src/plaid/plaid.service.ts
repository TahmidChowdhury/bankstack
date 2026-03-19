import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  Transaction as PlaidTransaction,
  CustomSandboxTransaction,
} from 'plaid';
import { encrypt, decrypt } from './token-crypto';

type SyncResult = {
  itemsProcessed: number;
  transactionsAdded: number;
  transactionsModified: number;
  transactionsRemoved: number;
  accountsUpdated: number;
  errors: string[];
};

@Injectable()
export class PlaidService {
  private readonly logger = new Logger(PlaidService.name);
  private readonly plaidClient: PlaidApi;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const env = this.configService.get<string>('PLAID_ENV', 'sandbox');
    const configuration = new Configuration({
      basePath: PlaidEnvironments[env],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': this.configService.get<string>('PLAID_CLIENT_ID'),
          'PLAID-SECRET': this.configService.get<string>('PLAID_SECRET'),
        },
      },
    });
    this.plaidClient = new PlaidApi(configuration);
  }

  async createLinkToken(userId: string): Promise<string> {
    try {
      const response = await this.plaidClient.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'BankStack',
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en',
      });
      return response.data.link_token;
    } catch (error) {
      this.logPlaidError('createLinkToken', error);
      throw error;
    }
  }

  async exchangePublicToken(
    publicToken: string,
    institutionName: string,
  ): Promise<void> {
    let accessToken: string;
    let itemId: string;

    try {
      const exchangeResponse = await this.plaidClient.itemPublicTokenExchange({
        public_token: publicToken,
      });
      accessToken = exchangeResponse.data.access_token;
      itemId = exchangeResponse.data.item_id;
    } catch (error) {
      this.logPlaidError('itemPublicTokenExchange', error);
      throw error;
    }

    // Persist PlaidItem with encrypted access token
    const plaidItem = await this.prisma.plaidItem.upsert({
      where: { plaidItemId: itemId },
      update: {
        accessToken: encrypt(accessToken),
        institution: institutionName,
        status: 'ACTIVE',
      },
      create: {
        plaidItemId: itemId,
        institution: institutionName,
        accessToken: encrypt(accessToken),
        status: 'ACTIVE',
      },
    });

    // Upsert accounts and link to this PlaidItem
    try {
      const accountsResponse = await this.plaidClient.accountsGet({ access_token: accessToken });
      for (const account of accountsResponse.data.accounts) {
        await this.prisma.account.upsert({
          where: { plaidAccountId: account.account_id },
          update: {
            currentBalance: account.balances.current ?? 0,
            availableBalance: account.balances.available ?? null,
            plaidItemId: plaidItem.id,
          },
          create: {
            plaidAccountId: account.account_id,
            name: account.name,
            type: account.type,
            subtype: account.subtype ?? null,
            institution: institutionName,
            currentBalance: account.balances.current ?? 0,
            availableBalance: account.balances.available ?? null,
            plaidItemId: plaidItem.id,
          },
        });
      }
    } catch (error) {
      this.logPlaidError('accountsGet (post-exchange)', error);
      throw error;
    }

    // Initial transaction sync — failure is non-fatal; item is already persisted
    try {
      await this.syncItem(plaidItem.id, accessToken, null);
    } catch (error) {
      this.logger.warn(`Initial sync failed for item ${itemId}: ${String(error)}`);
    }

    this.logger.log(`Linked and synced item ${itemId} (${institutionName})`);
  }

  // ─── Sync all active items ─────────────────────────────────────────────────

  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      itemsProcessed: 0,
      transactionsAdded: 0,
      transactionsModified: 0,
      transactionsRemoved: 0,
      accountsUpdated: 0,
      errors: [],
    };

    const items = await this.prisma.plaidItem.findMany({
      where: { status: 'ACTIVE' },
    });

    this.logger.log(`syncAll: found ${items.length} active item(s)`);

    for (const item of items) {
      let accessToken: string;
      try {
        accessToken = decrypt(item.accessToken);
      } catch {
        result.errors.push(`${item.institution}: failed to decrypt access token`);
        this.logger.error(`syncAll: failed to decrypt token for ${item.institution} (${item.plaidItemId})`);
        continue;
      }

      try {
        const itemResult = await this.syncItem(item.id, accessToken, item.syncCursor);
        result.itemsProcessed++;
        result.transactionsAdded += itemResult.added;
        result.transactionsModified += itemResult.modified;
        result.transactionsRemoved += itemResult.removed;
        result.accountsUpdated += itemResult.accountsUpdated;
        this.logger.log(
          `syncItem ${item.plaidItemId} (${item.institution}): ` +
          `+${itemResult.added} added, ${itemResult.modified} modified, ${itemResult.removed} removed, ` +
          `${itemResult.accountsUpdated} balances updated`,
        );
      } catch (error) {
        result.errors.push(`${item.institution}: ${this.plaidErrorMessage(error)}`);
        this.logger.error(`syncItem failed for ${item.institution}: ${this.plaidErrorMessage(error)}`);
        if (this.isLoginRequired(error)) {
          await this.prisma.plaidItem.update({
            where: { id: item.id },
            data: { status: 'LOGIN_REQUIRED' },
          });
        }
      }
    }

    this.logger.log(
      `syncAll complete: ${result.itemsProcessed} items, ` +
      `+${result.transactionsAdded} added, ${result.transactionsModified} modified, ${result.transactionsRemoved} removed`,
    );
    return result;
  }

  // ─── Sync a single item via cursor-based transactionsSync ─────────────────

  private async syncItem(
    plaidItemDbId: string,
    accessToken: string,
    cursor: string | null,
  ): Promise<{ added: number; modified: number; removed: number; accountsUpdated: number }> {
    let added = 0;
    let modified = 0;
    let removed = 0;
    let accountsUpdated = 0;
    let currentCursor = cursor ?? undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await this.plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: currentCursor,
        count: 500,
      });

      const data = response.data;

      for (const tx of data.added) {
        await this.upsertTransaction(tx);
        added++;
      }

      for (const tx of data.modified) {
        await this.upsertTransaction(tx);
        modified++;
      }

      if (data.removed.length > 0) {
        const removedIds = data.removed
          .map((r) => r.transaction_id)
          .filter((id): id is string => !!id);
        if (removedIds.length > 0) {
          const deleteResult = await this.prisma.transaction.deleteMany({
            where: { plaidTransactionId: { in: removedIds } },
          });
          removed += deleteResult.count;
        }
      }

      currentCursor = data.next_cursor;
      hasMore = data.has_more;
    }

    // Refresh account balances during sync (authoritative source)
    try {
      const accountsResp = await this.plaidClient.accountsGet({ access_token: accessToken });
      for (const account of accountsResp.data.accounts) {
        const updated = await this.prisma.account.updateMany({
          where: { plaidAccountId: account.account_id },
          data: {
            currentBalance: account.balances.current ?? 0,
            availableBalance: account.balances.available ?? null,
          },
        });
        accountsUpdated += updated.count;
      }
    } catch (error) {
      this.logPlaidError('accountsGet (balance refresh during sync)', error);
      // Non-fatal
    }

    await this.prisma.plaidItem.update({
      where: { id: plaidItemDbId },
      data: { syncCursor: currentCursor, lastSyncedAt: new Date(), status: 'ACTIVE' },
    });

    return { added, modified, removed, accountsUpdated };
  }

  // ─── Upsert a Plaid transaction into local DB ──────────────────────────────

  private async upsertTransaction(tx: PlaidTransaction): Promise<void> {
    const accountRow = await this.prisma.account.findUnique({
      where: { plaidAccountId: tx.account_id },
      select: { id: true },
    });

    if (!accountRow) {
      this.logger.warn(
        `Skipping transaction ${tx.transaction_id}: account ${tx.account_id} not found locally`,
      );
      return;
    }

    const category =
      tx.personal_finance_category?.primary ??
      (tx.category ? tx.category[0] : null) ??
      null;

    await this.prisma.transaction.upsert({
      where: { plaidTransactionId: tx.transaction_id },
      update: {
        amount: tx.amount,
        date: new Date(tx.date),
        merchantName: tx.merchant_name ?? tx.name ?? null,
        category,
        description: tx.name ?? null,
        pending: tx.pending ?? false,
      },
      create: {
        plaidTransactionId: tx.transaction_id,
        accountId: accountRow.id,
        amount: tx.amount,
        date: new Date(tx.date),
        merchantName: tx.merchant_name ?? tx.name ?? null,
        category,
        description: tx.name ?? null,
        pending: tx.pending ?? false,
      },
    });
  }

  // ─── Sandbox-only: create custom transactions for testing sync ─────────────

  async sandboxCreateTransactions(
    plaidItemId: string,
  ): Promise<{ ok: boolean; plaidItemId: string; transactionsCreated: number }> {
    const env = this.configService.get<string>('PLAID_ENV', 'sandbox');
    if (env !== 'sandbox') {
      throw new ForbiddenException('Sandbox transaction creation is only available in sandbox environment');
    }

    const item = await this.prisma.plaidItem.findUnique({ where: { plaidItemId } });
    if (!item) {
      throw new NotFoundException(`PlaidItem not found: ${plaidItemId}`);
    }

    const accessToken = decrypt(item.accessToken);
    const today = new Date().toISOString().split('T')[0];

    const transactions: CustomSandboxTransaction[] = [
      { date_transacted: today, date_posted: today, amount: 4.50,  description: 'Sandbox Coffee' },
      { date_transacted: today, date_posted: today, amount: 52.30, description: 'Sandbox Gas' },
    ];

    try {
      await this.plaidClient.sandboxTransactionsCreate({
        access_token: accessToken,
        transactions,
      });
    } catch (error) {
      this.logPlaidError('sandboxTransactionsCreate', error);
      throw error;
    }

    // Reset cursor so the next sync replays from scratch and picks up the created transactions.
    // (Plaid sandbox: created transactions only appear when cursor=null; transactionsRefresh clears them)
    await this.prisma.plaidItem.update({
      where: { plaidItemId },
      data: { syncCursor: null },
    });

    this.logger.log(
      `sandboxCreateTransactions: created ${transactions.length} transaction(s) for ${item.institution} (${plaidItemId})`,
    );
    return { ok: true, plaidItemId, transactionsCreated: transactions.length };
  }

  // ─── Sandbox-only: force transaction refresh for testing sync ────────────

  async sandboxRefresh(plaidItemId: string): Promise<{ ok: boolean; plaidItemId: string }> {
    const env = this.configService.get<string>('PLAID_ENV', 'sandbox');
    if (env !== 'sandbox') {
      throw new ForbiddenException('Sandbox refresh is only available in sandbox environment');
    }

    const item = await this.prisma.plaidItem.findUnique({
      where: { plaidItemId },
    });
    if (!item) {
      throw new NotFoundException(`PlaidItem not found: ${plaidItemId}`);
    }

    const accessToken = decrypt(item.accessToken);
    // Signal Plaid to generate new sandbox transaction activity
    await this.plaidClient.transactionsRefresh({ access_token: accessToken });

    this.logger.log(`sandboxRefresh: triggered for ${item.institution} (${plaidItemId})`);
    return { ok: true, plaidItemId };
  }

  // ─── Items list for UI ─────────────────────────────────────────────────────

  async deleteItem(id: string) {
    const accounts = await this.prisma.account.findMany({
      where: { plaidItemId: id },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);
    await this.prisma.transaction.deleteMany({ where: { accountId: { in: accountIds } } });
    await this.prisma.account.deleteMany({ where: { plaidItemId: id } });
    await this.prisma.plaidItem.delete({ where: { id } });
  }

  async getItems() {
    return this.prisma.plaidItem.findMany({
      select: {
        id: true,
        plaidItemId: true,
        institution: true,
        status: true,
        lastSyncedAt: true,
        createdAt: true,
        _count: { select: { accounts: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAccounts() {
    return this.prisma.account.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAccount(
    id: string,
    data: {
      name?: string;
      currentBalance?: number;
      availableBalance?: number | null;
      apr?: number | null;
      minimumPayment?: number | null;
      dueDayOfMonth?: number | null;
    },
  ) {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Account "${id}" was not found.`);
    }
    return this.prisma.account.update({ where: { id }, data });
  }

  async getTransactions(accountId?: string) {
    return this.prisma.transaction.findMany({
      where: accountId ? { accountId } : undefined,
      include: { account: true },
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  // ─── Error helpers ─────────────────────────────────────────────────────────

  private isLoginRequired(error: unknown): boolean {
    const data = (error as { response?: { data?: { error_code?: string } } }).response?.data;
    return data?.error_code === 'ITEM_LOGIN_REQUIRED';
  }

  private plaidErrorMessage(error: unknown): string {
    const data = (error as { response?: { data?: { error_message?: string; error_code?: string } } }).response?.data;
    return data?.error_message ?? data?.error_code ?? String(error);
  }

  private logPlaidError(context: string, error: unknown): void {
    const response = (error as { response?: { status?: number; data?: unknown } }).response;
    this.logger.error(
      `[${context}] Plaid request failed`,
      JSON.stringify({
        status: response?.status ?? null,
        data: response?.data ?? null,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
