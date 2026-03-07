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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebtService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const DEFAULT_APR = 20;
const MAX_PAYOFF_MONTHS = 600;
const MIN_PAYMENT_PERCENT = 0.01;
const MIN_PAYMENT_FLOOR = 25;
let DebtService = class DebtService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSummary() {
        const accounts = await this.prisma.account.findMany();
        const creditAccounts = accounts.filter((a) => a.type === 'credit' || a.subtype === 'credit card');
        const depAccounts = accounts.filter((a) => a.type === 'depository');
        const totalDebt = creditAccounts.reduce((sum, a) => sum + Math.max(a.currentBalance, 0), 0);
        const totalCash = depAccounts.reduce((sum, a) => sum + Math.max(a.currentBalance, 0), 0);
        const netWorth = totalCash - totalDebt;
        return { totalDebt, totalCash, netWorth };
    }
    async calculatePayoffStrategy(monthlyPayment) {
        const accounts = await this.prisma.account.findMany();
        const creditAccounts = accounts
            .filter((a) => a.type === 'credit' || a.subtype === 'credit card')
            .filter((a) => a.currentBalance > 0);
        const depAccounts = accounts.filter((a) => a.type === 'depository');
        const totalDebt = creditAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
        const totalCash = depAccounts.reduce((sum, a) => sum + Math.max(a.currentBalance, 0), 0);
        const netWorth = totalCash - totalDebt;
        const sorted = [...creditAccounts].sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0));
        const highestAprDebt = sorted[0]
            ? {
                accountId: sorted[0].id,
                name: sorted[0].name,
                balance: sorted[0].currentBalance,
                apr: sorted[0].apr ?? 0,
            }
            : null;
        const avalancheOrder = this.calculateAvalanche(sorted, monthlyPayment);
        const lastPayoff = avalancheOrder[avalancheOrder.length - 1];
        let payoffDate = null;
        if (lastPayoff) {
            payoffDate = new Date();
            payoffDate.setMonth(payoffDate.getMonth() + lastPayoff.monthsToPayoff);
        }
        const minPaymentInterest = this.calculateMinPaymentInterest(sorted);
        const avalancheInterest = avalancheOrder.reduce((sum, a) => sum + a.interestPaid, 0);
        const totalInterestSaved = minPaymentInterest - avalancheInterest;
        return {
            totalDebt,
            totalCash,
            netWorth,
            highestAprDebt,
            avalancheOrder,
            payoffDate,
            totalInterestSaved: Math.max(totalInterestSaved, 0),
            monthlyPayment,
        };
    }
    calculateAvalanche(accounts, totalMonthlyPayment) {
        const debts = accounts.map((a) => ({
            accountId: a.id,
            name: a.name,
            balance: a.currentBalance,
            apr: a.apr ?? DEFAULT_APR,
            monthsToPayoff: 0,
            interestPaid: 0,
        }));
        let month = 0;
        const maxMonths = MAX_PAYOFF_MONTHS;
        while (debts.some((d) => d.balance > 0) && month < maxMonths) {
            month++;
            let remaining = totalMonthlyPayment;
            for (const debt of debts) {
                if (debt.balance <= 0)
                    continue;
                const monthlyRate = debt.apr / 100 / 12;
                const interest = debt.balance * monthlyRate;
                debt.balance += interest;
                debt.interestPaid += interest;
                const minPayment = Math.max(interest + debt.balance * MIN_PAYMENT_PERCENT, MIN_PAYMENT_FLOOR);
                if (remaining <= 0) {
                    debt.balance -= Math.min(minPayment, debt.balance);
                    continue;
                }
                const payment = Math.min(remaining, debt.balance);
                debt.balance -= payment;
                remaining -= payment;
                if (debt.balance <= 0) {
                    debt.balance = 0;
                    debt.monthsToPayoff = month;
                }
            }
        }
        for (const debt of debts) {
            if (debt.monthsToPayoff === 0) {
                debt.monthsToPayoff = month;
            }
        }
        return debts;
    }
    calculateMinPaymentInterest(accounts) {
        let totalInterest = 0;
        for (const account of accounts) {
            let balance = account.currentBalance;
            const monthlyRate = (account.apr ?? DEFAULT_APR) / 100 / 12;
            let months = 0;
            while (balance > 0 && months < MAX_PAYOFF_MONTHS) {
                const interest = balance * monthlyRate;
                totalInterest += interest;
                balance += interest;
                const minPayment = Math.max(interest + balance * MIN_PAYMENT_PERCENT, MIN_PAYMENT_FLOOR);
                balance -= Math.min(minPayment, balance);
                months++;
            }
        }
        return totalInterest;
    }
};
exports.DebtService = DebtService;
exports.DebtService = DebtService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DebtService);
//# sourceMappingURL=debt.service.js.map