import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DebtPlanService } from './debt-plan.service';
import { DebtService } from './debt.service';

@Controller('debt')
export class DebtController {
  constructor(
    private readonly debtService: DebtService,
    private readonly debtPlanService: DebtPlanService,
  ) {}

  @Get('summary')
  async getSummary() {
    return this.debtService.getSummary();
  }

  @Post('payoff-strategy')
  async calculatePayoffStrategy(@Body('monthlyPayment') monthlyPayment: number) {
    return this.debtService.calculatePayoffStrategy(monthlyPayment || 500);
  }

  @Get('plan')
  async getPlan(
    @Query('strategy') strategy = 'avalanche',
    @Query('months') months = '12',
  ) {
    const parsedMonths = Number(months);
    return this.debtPlanService.generateDebtPlan(strategy, parsedMonths);
  }
}
