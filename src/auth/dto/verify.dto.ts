import { UserRole } from '../user.entity';
import { IsEnum, IsString, IsNotEmpty } from 'class-validator';

export class VerifyDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;

  @IsEnum(UserRole) // ✅ type-safe!
  role: UserRole;
}
