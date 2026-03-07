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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaidController = void 0;
const common_1 = require("@nestjs/common");
const plaid_service_1 = require("./plaid.service");
let PlaidController = class PlaidController {
    plaidService;
    constructor(plaidService) {
        this.plaidService = plaidService;
    }
    async createLinkToken(userId) {
        const linkToken = await this.plaidService.createLinkToken(userId || 'default-user');
        return { link_token: linkToken };
    }
    async exchangeToken(publicToken, institutionName) {
        await this.plaidService.exchangePublicToken(publicToken, institutionName || 'Unknown');
        return { success: true };
    }
    async getAccounts() {
        return this.plaidService.getAccounts();
    }
    async getTransactions(accountId) {
        return this.plaidService.getTransactions(accountId);
    }
    async refreshBalances(accessToken) {
        await this.plaidService.refreshBalances(accessToken);
        return { success: true };
    }
};
exports.PlaidController = PlaidController;
__decorate([
    (0, common_1.Post)('plaid/link-token'),
    __param(0, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlaidController.prototype, "createLinkToken", null);
__decorate([
    (0, common_1.Post)('plaid/exchange-token'),
    __param(0, (0, common_1.Body)('public_token')),
    __param(1, (0, common_1.Body)('institution_name')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], PlaidController.prototype, "exchangeToken", null);
__decorate([
    (0, common_1.Get)('accounts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PlaidController.prototype, "getAccounts", null);
__decorate([
    (0, common_1.Get)('transactions'),
    __param(0, (0, common_1.Query)('accountId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlaidController.prototype, "getTransactions", null);
__decorate([
    (0, common_1.Post)('refresh-balances'),
    __param(0, (0, common_1.Body)('access_token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], PlaidController.prototype, "refreshBalances", null);
exports.PlaidController = PlaidController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [plaid_service_1.PlaidService])
], PlaidController);
//# sourceMappingURL=plaid.controller.js.map