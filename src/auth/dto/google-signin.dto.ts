import { IsString, IsEmail, IsNotEmpty, IsEnum } from 'class-validator';
import { UserRole } from '../user.entity';

export class GoogleSignInDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  uid: string;

  @IsEnum(UserRole)
  role: UserRole; // Use UserRole enum instead of string
}
