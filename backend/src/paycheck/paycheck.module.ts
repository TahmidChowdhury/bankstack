import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaycheckController } from './paycheck.controller';
import { PaycheckService } from './paycheck.service';

@Module({
  imports: [PrismaModule],
  controllers: [PaycheckController],
  providers: [PaycheckService],
})
export class PaycheckModule {}
