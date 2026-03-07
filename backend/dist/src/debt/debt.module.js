"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebtModule = void 0;
const common_1 = require("@nestjs/common");
const debt_controller_1 = require("./debt.controller");
const debt_service_1 = require("./debt.service");
let DebtModule = class DebtModule {
};
exports.DebtModule = DebtModule;
exports.DebtModule = DebtModule = __decorate([
    (0, common_1.Module)({
        controllers: [debt_controller_1.DebtController],
        providers: [debt_service_1.DebtService],
    })
], DebtModule);
//# sourceMappingURL=debt.module.js.map