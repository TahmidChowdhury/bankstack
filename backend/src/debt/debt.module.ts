import { Module } from '@nestjs/common';
import { DebtPlanService } from './debt-plan.service';
import { DebtController } from './debt.controller';
import { DebtService } from './debt.service';

@Module({
  controllers: [DebtController],
  providers: [DebtService, DebtPlanService],
})
export class DebtModule {}
