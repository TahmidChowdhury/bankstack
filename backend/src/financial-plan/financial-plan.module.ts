import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FinancialPlanController } from './financial-plan.controller';
import { FinancialPlanService } from './financial-plan.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinancialPlanController],
  providers: [FinancialPlanService],
})
export class FinancialPlanModule {}
