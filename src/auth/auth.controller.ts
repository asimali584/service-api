import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyDto } from './dto/verify.dto';
import { GoogleSignInDto } from './dto/google-signin.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify')
  async verify(@Body() verifyDto: VerifyDto) {
    const { phoneNumber, code, ...rest } = verifyDto;
    const registerData = { ...rest, phoneNumber };
    return this.authService.verifyPhone(phoneNumber, code, registerData);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('google-signin')
  @HttpCode(HttpStatus.OK)
  async googleSignIn(@Body() googleSignInDto: GoogleSignInDto) {
    return this.authService.googleSignIn(googleSignInDto);
  }
@Post('google-send-otp')
@HttpCode(HttpStatus.OK)
async sendOtpAfterGoogle(@Body() body: { userId: string; phoneNumber: string }) {
  return this.authService.sendOtpForGoogleUser(body.userId, body.phoneNumber);
}

@Post('google-verify-phone')
@HttpCode(HttpStatus.OK)
async verifyOtpAfterGoogle(@Body() body: { userId: string; code: string }) {
  return this.authService.verifyOtpForGoogleUser(body.userId, body.code);
}

  
}
