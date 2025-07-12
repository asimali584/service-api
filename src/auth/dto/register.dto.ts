import {
  IsString,
  IsEmail,
  MinLength,
  IsEnum,
  IsNotEmpty,
  IsPhoneNumber,
} from 'class-validator';
import { UserRole } from '../user.entity';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(8)
  confirmPassword: string;

  @IsEnum([UserRole.CUSTOMER, UserRole.ADMIN, UserRole.COMPANY])
  role: UserRole;
}
