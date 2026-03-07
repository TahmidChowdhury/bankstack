import { PlaidService } from './plaid.service';
export declare class PlaidController {
    private readonly plaidService;
    constructor(plaidService: PlaidService);
    createLinkToken(userId: string): Promise<{
        link_token: string;
    }>;
    exchangeToken(publicToken: string, institutionName: string): Promise<{
        success: boolean;
    }>;
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
    refreshBalances(accessToken: string): Promise<{
        success: boolean;
    }>;
}
