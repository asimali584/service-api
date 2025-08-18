import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '../user.entity';

export class AppleLoginDto {
  @IsEmail()
  @IsOptional()
  email?: string | null;

  @IsString()
  @IsOptional()
  fullName?: string | null;

  @IsString()
  @IsOptional()
  password?: string | null;

  @IsEnum(UserRole)
  role: UserRole;
}


