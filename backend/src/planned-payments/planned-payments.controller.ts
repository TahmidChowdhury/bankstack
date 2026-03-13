import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CreatePlannedPaymentDto } from './dto/create-planned-payment.dto';
import { UpdatePlannedPaymentDto } from './dto/update-planned-payment.dto';
import { PlannedPaymentsService } from './planned-payments.service';

@Controller('planned-payments')
export class PlannedPaymentsController {
  constructor(private readonly plannedPaymentsService: PlannedPaymentsService) {}

  @Post()
  async create(@Body() dto: CreatePlannedPaymentDto) {
    return this.plannedPaymentsService.create(dto);
  }

  @Get()
  async findAll() {
    return this.plannedPaymentsService.findAll();
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePlannedPaymentDto) {
    return this.plannedPaymentsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.plannedPaymentsService.remove(id);
  }
}
