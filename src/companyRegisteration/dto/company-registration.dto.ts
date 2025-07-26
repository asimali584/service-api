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
  IsIn,
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

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceRangeKilometer?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceRangeMiles?: number;

  @IsOptional()
  @IsString()
  @IsIn(['kilometers', 'miles'])
  distanceUnit?: string; // 'kilometers' or 'miles'

  @IsOptional()
  @IsString({ each: true })
  workingDays: string[]; // Array of days like ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  @IsOptional()
  @IsString()
  startTime: string; // Time format like "9:00 AM"

  @IsOptional()
  @IsString()
  endTime: string; // Time format like "5:00 PM"
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

  @ValidateIf((o) => o.rateType === RateType.BY_HOUR)
  @IsInt()
  @Min(1)
  timeDuration?: number; // Required for BY_HOUR rate type

  @ValidateIf((o) => o.rateType === RateType.BY_ROOM)
  @IsInt()
  @Min(1)
  numberOfRooms?: number; // Required for BY_ROOM rate type

  @ValidateIf((o) => o.rateType === RateType.BY_WINDOW)
  @IsInt()
  @Min(1)
  numberOfWindows?: number; // Required for BY_WINDOW rate type
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

export class UpdateCompanyInfoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  businessName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  businessType?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  businessDescription?: string;

  @IsOptional()
  @IsString()
  workingDays?: string; // String format like "Mon, Tue, Wed, Thu, Fri, Sat, Sun"

  @IsOptional()
  @IsString()
  startTime?: string; // Time format like "9:00 AM"

  @IsOptional()
  @IsString()
  endTime?: string; // Time format like "5:00 PM"

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceRangeKilometer?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceRangeMiles?: number;

  @IsOptional()
  @IsString()
  @IsIn(['kilometers', 'miles'])
  distanceUnit?: string; // 'kilometers' or 'miles'
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  serviceName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsEnum(ServiceLocation)
  location?: ServiceLocation;

  @IsOptional()
  @IsEnum(RateType)
  rateType?: RateType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ValidateIf((o) => o.rateType === RateType.BY_HOUR)
  @IsInt()
  @Min(1)
  timeDuration?: number; // Required for BY_HOUR rate type

  @ValidateIf((o) => o.rateType === RateType.BY_ROOM)
  @IsInt()
  @Min(1)
  numberOfRooms?: number; // Required for BY_ROOM rate type

  @ValidateIf((o) => o.rateType === RateType.BY_WINDOW)
  @IsInt()
  @Min(1)
  numberOfWindows?: number; // Required for BY_WINDOW rate type
}
