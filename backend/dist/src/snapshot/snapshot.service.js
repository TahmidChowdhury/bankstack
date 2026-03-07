"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SnapshotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
let SnapshotService = SnapshotService_1 = class SnapshotService {
    prisma;
    logger = new common_1.Logger(SnapshotService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async takeDailySnapshot() {
        this.logger.log('Taking daily balance snapshot...');
        const accounts = await this.prisma.account.findMany();
        const creditAccounts = accounts.filter((a) => a.type === 'credit' || a.subtype === 'credit card');
        const depAccounts = accounts.filter((a) => a.type === 'depository');
        const totalDebt = creditAccounts.reduce((sum, a) => sum + Math.max(a.currentBalance, 0), 0);
        const totalCash = depAccounts.reduce((sum, a) => sum + Math.max(a.currentBalance, 0), 0);
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
};
exports.SnapshotService = SnapshotService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SnapshotService.prototype, "takeDailySnapshot", null);
exports.SnapshotService = SnapshotService = SnapshotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SnapshotService);
//# sourceMappingURL=snapshot.service.js.map