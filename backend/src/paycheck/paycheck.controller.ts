import { Controller, Get } from '@nestjs/common';
import { PaycheckService } from './paycheck.service';

@Controller('paycheck')
export class PaycheckController {
  constructor(private readonly paycheckService: PaycheckService) {}

  @Get('planner')
  async getPlanner() {
    return this.paycheckService.getPlanner();
  }
}
