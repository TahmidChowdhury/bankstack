import { Controller, Get } from '@nestjs/common';
import { CashflowService } from './cashflow.service';

@Controller('cashflow')
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  @Get('forecast')
  async getForecast() {
    return this.cashflowService.getForecast();
  }
}
