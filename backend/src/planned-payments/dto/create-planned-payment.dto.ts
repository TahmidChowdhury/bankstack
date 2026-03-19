import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

const ALLOWED_TYPES = ['MINIMUM', 'EXTRA', 'PAYCHECK_PLAN'] as const;
const ALLOWED_STRATEGIES = ['avalanche', 'snowball', 'hybrid'] as const;
const ALLOWED_STATUSES = ['PLANNED', 'PAID', 'SKIPPED'] as const;

export class CreatePlannedPaymentDto {
  @IsString()
  accountId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_TYPES)
  type?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_STRATEGIES)
  strategy?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_STATUSES)
  status?: string;
}
