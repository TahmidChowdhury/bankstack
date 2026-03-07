"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PlaidService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaidService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const plaid_1 = require("plaid");
let PlaidService = PlaidService_1 = class PlaidService {
    configService;
    prisma;
    logger = new common_1.Logger(PlaidService_1.name);
    plaidClient;
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
        const configuration = new plaid_1.Configuration({
            basePath: plaid_1.PlaidEnvironments[this.configService.get('PLAID_ENV', 'sandbox')],
            baseOptions: {
                headers: {
                    'PLAID-CLIENT-ID': this.configService.get('PLAID_CLIENT_ID'),
                    'PLAID-SECRET': this.configService.get('PLAID_SECRET'),
                },
            },
        });
        this.plaidClient = new plaid_1.PlaidApi(configuration);
    }
    async createLinkToken(userId) {
        const response = await this.plaidClient.linkTokenCreate({
            user: { client_user_id: userId },
            client_name: 'BankStack',
            products: [plaid_1.Products.Transactions, plaid_1.Products.Auth],
            country_codes: [plaid_1.CountryCode.Us],
            language: 'en',
        });
        return response.data.link_token;
    }
    async exchangePublicToken(publicToken, institutionName) {
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
    async getTransactions(accountId) {
        return this.prisma.transaction.findMany({
            where: accountId ? { accountId } : undefined,
            include: { account: true },
            orderBy: { date: 'desc' },
            take: 100,
        });
    }
    async refreshBalances(accessToken) {
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
};
exports.PlaidService = PlaidService;
exports.PlaidService = PlaidService = PlaidService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], PlaidService);
//# sourceMappingURL=plaid.service.js.map