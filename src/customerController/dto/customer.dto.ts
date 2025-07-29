import { IsNumber, IsNotEmpty, IsOptional } from 'class-validator';

export class CustomerLocationDto {
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}

export class GetServicesDto {
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}

export class BusinessDetailsDto {
  @IsNumber()
  @IsNotEmpty()
  businessId: number;
}
