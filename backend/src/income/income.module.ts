import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';

@Module({
  imports: [PrismaModule],
  controllers: [IncomeController],
  providers: [IncomeService],
})
export class IncomeModule {}
