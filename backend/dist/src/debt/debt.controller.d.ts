import { DebtService } from './debt.service';
export declare class DebtController {
    private readonly debtService;
    constructor(debtService: DebtService);
    getSummary(): Promise<{
        totalDebt: number;
        totalCash: number;
        netWorth: number;
    }>;
    calculatePayoffStrategy(monthlyPayment: number): Promise<import("./debt.service").PayoffStrategy>;
}
