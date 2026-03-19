import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlannedPaymentsController } from './planned-payments.controller';
import { PlannedPaymentsService } from './planned-payments.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlannedPaymentsController],
  providers: [PlannedPaymentsService],
  exports: [PlannedPaymentsService],
})
export class PlannedPaymentsModule {}
