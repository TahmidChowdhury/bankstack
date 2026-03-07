import { Controller, Get } from '@nestjs/common';
import { IncomeService } from './income.service';

@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Get()
  async getIncome() {
    return this.incomeService.getSummary();
  }

  @Get('sources')
  async getSources() {
    return this.incomeService.getSources();
  }

  @Get('summary')
  async getSummary() {
    return this.incomeService.getSummary();
  }
}
