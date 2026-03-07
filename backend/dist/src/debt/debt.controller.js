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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebtController = void 0;
const common_1 = require("@nestjs/common");
const debt_service_1 = require("./debt.service");
let DebtController = class DebtController {
    debtService;
    constructor(debtService) {
        this.debtService = debtService;
    }
    async getSummary() {
        return this.debtService.getSummary();
    }
    async calculatePayoffStrategy(monthlyPayment) {
        return this.debtService.calculatePayoffStrategy(monthlyPayment || 500);
    }
};
exports.DebtController = DebtController;
__decorate([
    (0, common_1.Get)('summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DebtController.prototype, "getSummary", null);
__decorate([
    (0, common_1.Post)('payoff-strategy'),
    __param(0, (0, common_1.Body)('monthlyPayment')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], DebtController.prototype, "calculatePayoffStrategy", null);
exports.DebtController = DebtController = __decorate([
    (0, common_1.Controller)('debt'),
    __metadata("design:paramtypes", [debt_service_1.DebtService])
], DebtController);
//# sourceMappingURL=debt.controller.js.map