// src/authentication/dto/login.dto.ts
import { IsEmail, IsString, IsEnum, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
