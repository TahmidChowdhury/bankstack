import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';

@Injectable()
export class PlaidService {
  private readonly logger = new Logger(PlaidService.name);
  private readonly plaidClient: PlaidApi;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const configuration = new Configuration({
      basePath:
        PlaidEnvironments[
          this.configService.get<string>('PLAID_ENV', 'sandbox')
        ],
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
    const response = await this.plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'BankStack',
      products: [Products.Transactions, Products.Auth],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    return response.data.link_token;
  }

  async exchangePublicToken(
    publicToken: string,
    institutionName: string,
  ): Promise<void> {
    const exchangeResponse = await this.plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });
    const { access_token, item_id } = exchangeResponse.data;

    const accountsResponse = await this.plaidClient.accountsGet({
      access_token,
    });

    for (const account of accountsResponse.data.accounts) {
      await this.prisma.account.upsert({
        where: { plaidAccountId: account.account_id },
        update: {
          currentBalance: account.balances.current ?? 0,
          availableBalance: account.balances.available ?? null,
        },
        create: {
          plaidAccountId: account.account_id,
          name: account.name,
          type: account.type,
          subtype: account.subtype ?? null,
          institution: institutionName,
          currentBalance: account.balances.current ?? 0,
          availableBalance: account.balances.available ?? null,
        },
      });
    }

    this.logger.log(`Exchanged token for item ${item_id}, institution: ${institutionName}`);
  }

  async getAccounts() {
    return this.prisma.account.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTransactions(accountId?: string) {
    return this.prisma.transaction.findMany({
      where: accountId ? { accountId } : undefined,
      include: { account: true },
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  async refreshBalances(accessToken: string): Promise<void> {
    const accountsResponse = await this.plaidClient.accountsGet({
      access_token: accessToken,
    });

    for (const account of accountsResponse.data.accounts) {
      await this.prisma.account.updateMany({
        where: { plaidAccountId: account.account_id },
        data: {
          currentBalance: account.balances.current ?? 0,
          availableBalance: account.balances.available ?? null,
        },
      });
    }
  }
}
