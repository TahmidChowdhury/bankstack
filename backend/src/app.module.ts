import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { PlaidModule } from './plaid/plaid.module';
import { DebtModule } from './debt/debt.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { IncomeModule } from './income/income.module';
import { CashflowModule } from './cashflow/cashflow.module';
import { PaycheckModule } from './paycheck/paycheck.module';
import { PlannedPaymentsModule } from './planned-payments/planned-payments.module';
import { InsightsModule } from './insights/insights.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    PlaidModule,
    DebtModule,
    SnapshotModule,
    IncomeModule,
    CashflowModule,
    PaycheckModule,
    PlannedPaymentsModule,
    InsightsModule,
  ],
})
export class AppModule {}
