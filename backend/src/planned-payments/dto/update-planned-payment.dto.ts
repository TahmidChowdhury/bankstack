import { IsIn, IsOptional } from 'class-validator';

export class UpdatePlannedPaymentDto {
  @IsOptional()
  @IsIn(['PLANNED', 'PAID', 'SKIPPED'])
  status?: string;
}
