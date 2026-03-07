import { PrismaService } from '../prisma/prisma.service';
export declare class SnapshotService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    takeDailySnapshot(): Promise<void>;
    getSnapshots(): Promise<{
        id: string;
        createdAt: Date;
        totalDebt: number;
        totalCash: number;
        netWorth: number;
    }[]>;
}
