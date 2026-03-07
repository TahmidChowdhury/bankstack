import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SnapshotService {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async takeDailySnapshot(): Promise<void> {
    this.logger.log('Taking daily balance snapshot...');

    const accounts = await this.prisma.account.findMany();

    const creditAccounts = accounts.filter(
      (a) => a.type === 'credit' || a.subtype === 'credit card',
    );
    const depAccounts = accounts.filter((a) => a.type === 'depository');

    const totalDebt = creditAccounts.reduce(
      (sum, a) => sum + Math.max(a.currentBalance, 0),
      0,
    );
    const totalCash = depAccounts.reduce(
      (sum, a) => sum + Math.max(a.currentBalance, 0),
      0,
    );
    const netWorth = totalCash - totalDebt;

    await this.prisma.balanceSnapshot.create({
      data: { totalCash, totalDebt, netWorth },
    });

    this.logger.log(`Snapshot taken: cash=${totalCash}, debt=${totalDebt}, netWorth=${netWorth}`);
  }

  async getSnapshots() {
    return this.prisma.balanceSnapshot.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }
}
