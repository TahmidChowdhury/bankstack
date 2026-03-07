import { Body, Controller, Get, Post } from '@nestjs/common';
import { DebtService } from './debt.service';

@Controller('debt')
export class DebtController {
  constructor(private readonly debtService: DebtService) {}

  @Get('summary')
  async getSummary() {
    return this.debtService.getSummary();
  }

  @Post('payoff-strategy')
  async calculatePayoffStrategy(@Body('monthlyPayment') monthlyPayment: number) {
    return this.debtService.calculatePayoffStrategy(monthlyPayment || 500);
  }
}
