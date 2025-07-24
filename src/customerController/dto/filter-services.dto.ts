import { IsString, IsOptional, IsNumber } from 'class-validator';

export class FilterServicesDto {
  @IsOptional()
  @IsString()
  availability?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  workingDays?: string; // Filter by working days (comma-separated or single day)
}
