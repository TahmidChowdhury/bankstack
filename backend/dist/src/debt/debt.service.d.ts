import { PrismaService } from '../prisma/prisma.service';
export interface PayoffStrategy {
    totalDebt: number;
    totalCash: number;
    netWorth: number;
    highestAprDebt: {
        accountId: string;
        name: string;
        balance: number;
        apr: number;
    } | null;
    avalancheOrder: Array<{
        accountId: string;
        name: string;
        balance: number;
        apr: number;
        monthsToPayoff: number;
        interestPaid: number;
    }>;
    payoffDate: Date | null;
    totalInterestSaved: number;
    monthlyPayment: number;
}
export declare class DebtService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSummary(): Promise<{
        totalDebt: number;
        totalCash: number;
        netWorth: number;
    }>;
    calculatePayoffStrategy(monthlyPayment: number): Promise<PayoffStrategy>;
    private calculateAvalanche;
    private calculateMinPaymentInterest;
}
