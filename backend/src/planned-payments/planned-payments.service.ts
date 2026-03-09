import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlannedPaymentDto } from './dto/create-planned-payment.dto';

type PlannedPaymentResponse = {
  id: string;
  accountId: string;
  internalAccountId: string;
  accountName: string;
  amount: number;
  date: string;
  type: string;
  source: string | null;
  strategy: string | null;
  status: string;
  createdAt: string;
};

@Injectable()
export class PlannedPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlannedPaymentDto): Promise<PlannedPaymentResponse> {
    const account = await this.prisma.account.findFirst({
      where: {
        OR: [{ id: dto.accountId }, { plaidAccountId: dto.accountId }],
      },
      select: { id: true },
    });

    if (!account) {
      throw new NotFoundException(`Account "${dto.accountId}" was not found.`);
    }

    const plannedPayment = await this.prisma.plannedPayment.create({
      data: {
        accountId: account.id,
        amount: dto.amount,
        date: new Date(dto.date),
        type: dto.type ?? 'PAYCHECK_PLAN',
        source: dto.source ?? null,
        strategy: dto.strategy ?? null,
        status: 'PLANNED',
      },
      include: {
        account: {
          select: {
            id: true,
            plaidAccountId: true,
            name: true,
          },
        },
      },
    });

    return {
      id: plannedPayment.id,
      accountId: plannedPayment.account.plaidAccountId,
      internalAccountId: plannedPayment.account.id,
      accountName: plannedPayment.account.name,
      amount: plannedPayment.amount,
      date: plannedPayment.date.toISOString().slice(0, 10),
      type: plannedPayment.type,
      source: plannedPayment.source,
      strategy: plannedPayment.strategy,
      status: plannedPayment.status,
      createdAt: plannedPayment.createdAt.toISOString(),
    };
  }

  async findAll(): Promise<PlannedPaymentResponse[]> {
    const plannedPayments = await this.prisma.plannedPayment.findMany({
      orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
      include: {
        account: {
          select: {
            id: true,
            plaidAccountId: true,
            name: true,
          },
        },
      },
    });

    return plannedPayments.map((item) => ({
      id: item.id,
      accountId: item.account.plaidAccountId,
      internalAccountId: item.account.id,
      accountName: item.account.name,
      amount: item.amount,
      date: item.date.toISOString().slice(0, 10),
      type: item.type,
      source: item.source,
      strategy: item.strategy,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async remove(id: string) {
    const existing = await this.prisma.plannedPayment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Planned payment "${id}" was not found.`);
    }

    await this.prisma.plannedPayment.delete({ where: { id } });
    return { success: true };
  }
}
