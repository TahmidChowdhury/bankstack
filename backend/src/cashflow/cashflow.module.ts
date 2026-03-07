import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CashflowController } from './cashflow.controller';
import { CashflowService } from './cashflow.service';

@Module({
  imports: [PrismaModule],
  controllers: [CashflowController],
  providers: [CashflowService],
})
export class CashflowModule {}
