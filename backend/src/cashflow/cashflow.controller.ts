import { Controller, Get, Query } from '@nestjs/common';
import { CashflowService } from './cashflow.service';

@Controller('cashflow')
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  @Get('forecast')
  async getForecast(@Query('strategy') strategy?: string) {
    return this.cashflowService.getForecast(strategy);
  }

  @Get('recurring-expenses')
  async getRecurringExpenses() {
    return this.cashflowService.getRecurringExpenses();
  }
}
