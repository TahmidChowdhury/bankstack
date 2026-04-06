import { Controller, Get, Query } from '@nestjs/common';
import { FinancialPlanService } from './financial-plan.service';

@Controller('financial-plan')
export class FinancialPlanController {
  constructor(private readonly financialPlanService: FinancialPlanService) {}

  @Get()
  async getFinancialPlan(@Query('reserveOverride') reserveOverride?: string) {
    const parsedReserve = reserveOverride != null ? Number(reserveOverride) : undefined;
    return this.financialPlanService.getFinancialPlan(parsedReserve);
  }
}
