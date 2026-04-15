import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerMiddleware } from './logger.middleware';
import { PrismaModule } from './prisma/prisma.module';
import { PlaidModule } from './plaid/plaid.module';
import { DebtModule } from './debt/debt.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { IncomeModule } from './income/income.module';
import { CashflowModule } from './cashflow/cashflow.module';
import { PaycheckModule } from './paycheck/paycheck.module';
import { PlannedPaymentsModule } from './planned-payments/planned-payments.module';
import { InsightsModule } from './insights/insights.module';
import { FinancialPlanModule } from './financial-plan/financial-plan.module';

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
    FinancialPlanModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
