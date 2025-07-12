import {
  IsString,
  IsEmail,
  MinLength,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
  IsNumber,
  ValidateIf,
  isPhoneNumber,
  isDateString,
  IsDateString,
} from 'class-validator';
import { ServiceLocation, RateType } from 'src/auth/service.entity';

export class CompanyRegisterDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @MinLength(8)
  confirmPassword: string;
}

export class CompanyDetailsDto {
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsNotEmpty()
  businessType: string;

  @IsString()
  @IsNotEmpty()
  businessDescription: string;
}

export class CompanyPreferencesDto {
  @IsOptional()
  @IsString()
  websiteLink: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsNumber()
  @Min(0)
  distanceRange: number;

  @IsOptional()
  @IsString()
  startDay: string;

  @IsOptional()
  @IsString()
  endDay: string;

  @IsOptional()
  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate: string;
}

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(ServiceLocation)
  location: ServiceLocation;

  @IsEnum(RateType)
  rateType: RateType;

  @IsNumber()
  @Min(0)
  price: number;

  @ValidateIf((o) =>
    [RateType.BY_HOUR, RateType.BY_ROOM, RateType.BY_WINDOW].includes(
      o.rateType,
    ),
  )
  @IsInt()
  @Min(1)
  timeDuration?: number; // ✅ OPTIONAL
}

export class CompanyVerifyDto {
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
