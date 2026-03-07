import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
export declare class PlaidService {
    private readonly configService;
    private readonly prisma;
    private readonly logger;
    private readonly plaidClient;
    constructor(configService: ConfigService, prisma: PrismaService);
    createLinkToken(userId: string): Promise<string>;
    exchangePublicToken(publicToken: string, institutionName: string): Promise<void>;
    getAccounts(): Promise<{
        id: string;
        plaidAccountId: string;
        name: string;
        type: string;
        subtype: string | null;
        institution: string;
        currentBalance: number;
        availableBalance: number | null;
        apr: number | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getTransactions(accountId?: string): Promise<({
        account: {
            id: string;
            plaidAccountId: string;
            name: string;
            type: string;
            subtype: string | null;
            institution: string;
            currentBalance: number;
            availableBalance: number | null;
            apr: number | null;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        accountId: string;
        amount: number;
        date: Date;
        merchantName: string | null;
        category: string | null;
        description: string | null;
    })[]>;
    refreshBalances(accessToken: string): Promise<void>;
}
