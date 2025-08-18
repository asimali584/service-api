import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { Otp } from './otp.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { GoogleSignInDto } from './dto/google-signin.dto';
import { AppleLoginDto } from './dto/apple-login.dto';

@Injectable()
export class AuthService {
  private twilioClient: Twilio;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Otp)
    private otpRepository: Repository<Otp>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.twilioClient = new Twilio(
      this.configService.get('TWILIO_ACCOUNT_SID'),
      this.configService.get('TWILIO_AUTH_TOKEN'),
    );
  }

  /**
   * STEP 1: Start registration → Save OTP & send SMS
   */
  async register(registerDto: RegisterDto) {
    const { email, password, confirmPassword, phoneNumber } = registerDto;

    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check for existing email or phone number
    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { phoneNumber }],
    });
    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already exists');
      }
      if (existingUser.phoneNumber === phoneNumber) {
        throw new ConflictException('Phone number already exists');
      }
    }

    // Delete any existing OTP for this phone number
    await this.otpRepository.delete({ phoneNumber });

    // Generate OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP
    const otp = this.otpRepository.create({
      phoneNumber,
      code,
      // Optional: add expiresAt if you have such column
      // expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 mins
    });
    await this.otpRepository.save(otp);

    // Send SMS
    await this.twilioClient.messages.create({
      body: `Your verification code is: ${code}`,
      from: this.configService.get('TWILIO_PHONE_NUMBER'),
      to: phoneNumber,
    });

    return { message: `Verification code sent to ${phoneNumber}` };
  }

  /**
   * STEP 2: Verify OTP & create user
   */
  async verifyPhone(
    phoneNumber: string,
    code: string,
    registerDto: RegisterDto,
  ) {
    // Find the most recent OTP for the phone number
    const otp = await this.otpRepository.findOne({
      where: { phoneNumber, code },
      order: { createdAt: 'DESC' },
    });

    if (!otp) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Optional: Add expiry check if you decide to use expiresAt
    /*
  if (otp.expiresAt && otp.expiresAt < new Date()) {
    throw new BadRequestException('Verification code has expired');
  }
  */

    // Check for existing user
    const { fullName, email, password, role } = registerDto;
    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { phoneNumber }],
    });
    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already exists');
      }
      if (existingUser.phoneNumber === phoneNumber) {
        throw new ConflictException('Phone number already exists');
      }
    }

    // Create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      fullName,
      email,
      password: hashedPassword,
      role,
      phoneNumber,
      isVerified: true,
    });

    try {
      const savedUser = await this.usersRepository.save(user);

      // Delete ALL OTPs for this phone number to prevent reuse
      await this.otpRepository.delete({ phoneNumber });

      const payload = {
        email: savedUser.email,
        sub: savedUser.id,
        role: savedUser.role,
      };

      return {
        message: 'Registration successful',
        access_token: this.jwtService.sign(payload),
        user: {
          id: savedUser.id,
          email: savedUser.email,
          role: savedUser.role,
        },
      };
    } catch (error) {
      console.error('Database save error:', error.message);
      throw new InternalServerErrorException('Failed to save user');
    }
  }

  /**
   * LOGIN: Check credentials & return token
   */
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
      businessName  : user.businessName, // Include businessName if needed
      imageUrl: user.imageUrl, // Include imageUrl if needed
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * GOOGLE SIGN-IN: Check if user exists, login or register
   */
async googleSignIn(googleSignInDto: GoogleSignInDto) {
  const { email, fullName, uid, role } = googleSignInDto;

  let user = await this.usersRepository.findOne({ where: { email } });

  const hashedPassword = await bcrypt.hash(uid, 10);

  if (user) {
    const isValid = await bcrypt.compare(uid, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Google UID');
    }

    if (user.role !== role) {
      throw new BadRequestException(`Role mismatch: Account is registered as ${user.role}, but requested role is ${role}`);
    }

    if (!user.phoneNumber || !user.isPhoneVerified) {
      return {
        message: 'Phone verification required',
        phone_verification_required: true,
        userId: user.id,
      };
    }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role,
    };

    return {
      message: 'Google Sign-In successful',
      isNewUser: false,
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  } else {
    // Create new user without phone number
    user = this.usersRepository.create({
      fullName,
      email,
      password: hashedPassword,
      role,
      isVerified: true,
      isPhoneVerified: false,
    });

    const savedUser = await this.usersRepository.save(user);

    return {
      message: 'Phone verification required',
      isNewUser: true,
      phone_verification_required: true,
      userId: savedUser.id,
    };
  }
}

  /**
   * APPLE LOGIN: Mirror Google flow → upsert user, require phone verification if missing
   */
  async appleLogin(appleLoginDto: AppleLoginDto) {
    const { email = null, fullName = null, password = null, role } = appleLoginDto;

    let user: User | null = null;
    if (email) {
      user = await this.usersRepository.findOne({ where: { email } });
    }

    if (user) {
      if (password) {
        const isValid = await bcrypt.compare(password, user.password ?? '');
        if (!isValid) {
          throw new UnauthorizedException('Invalid Apple credentials');
        }
      }

      if (user.role !== role) {
        throw new BadRequestException(`Role mismatch: Account is registered as ${user.role}, but requested role is ${role}`);
      }

      if (!user.phoneNumber || !user.isPhoneVerified) {
        return {
          message: 'Phone verification required',
          phone_verification_required: true,
          isNewUser: false,
          userId: user.id,
        };
      }

      const payload = { email: user.email, sub: user.id, role: user.role };
      return {
        message: 'Apple Sign-In successful',
        isNewUser: false,
        access_token: this.jwtService.sign(payload),
        user: { id: user.id, email: user.email, role: user.role },
      };
    }

    const hashed = password ? await bcrypt.hash(password, 10) : null;
    const newUser = this.usersRepository.create({
      fullName: fullName ?? null,
      email: email ?? null,
      password: hashed ?? null,
      role,
      isVerified: true,
      isPhoneVerified: false,
    } as Partial<User>);
    const savedUser = await this.usersRepository.save(newUser);

    return {
      message: 'Phone verification required',
      isNewUser: true,
      phone_verification_required: true,
      userId: savedUser.id,
    };
  }

  async sendOtpForAppleUser(userId: string, phoneNumber: string) {
    const user = await this.usersRepository.findOne({ where: { id: Number(userId) } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingPhone = await this.usersRepository.findOne({ where: { phoneNumber } });
    if (existingPhone) {
      throw new ConflictException('Phone number already exists');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.otpRepository.delete({ phoneNumber });

    const otp = this.otpRepository.create({ phoneNumber, code } as Partial<Otp>);
    await this.otpRepository.save(otp);

    await this.twilioClient.messages.create({
      body: `Your verification code is: ${code}`,
      from: this.configService.get('TWILIO_PHONE_NUMBER'),
      to: phoneNumber,
    });

    user.phoneNumber = phoneNumber;
    await this.usersRepository.save(user);

    return { message: `Verification code sent to ${phoneNumber}` };
  }

  async verifyOtpForAppleUser(userId: string, code: string) {
    const user = await this.usersRepository.findOne({ where: { id: Number(userId) } });
    if (!user || !user.phoneNumber) {
      throw new NotFoundException('User or phone number not found');
    }

    const otp = await this.otpRepository.findOne({
      where: { phoneNumber: user.phoneNumber, code },
      order: { createdAt: 'DESC' },
    });
    if (!otp) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    user.isPhoneVerified = true;
    await this.usersRepository.save(user);
    await this.otpRepository.delete({ phoneNumber: user.phoneNumber });

    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      message: 'Phone verification successful',
      access_token: this.jwtService.sign(payload),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

async sendOtpForGoogleUser(userId: string, phoneNumber: string) {
 const user = await this.usersRepository.findOne({ where: { id: Number(userId) } });


  if (!user) {
    throw new NotFoundException('User not found');
  }

  const existingPhone = await this.usersRepository.findOne({ where: { phoneNumber } });
  if (existingPhone) {
    throw new ConflictException('Phone number already exists');
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await this.otpRepository.delete({ phoneNumber });

  const otp = this.otpRepository.create({ phoneNumber, code });
  await this.otpRepository.save(otp);

  await this.twilioClient.messages.create({
    body: `Your verification code is: ${code}`,
    from: this.configService.get('TWILIO_PHONE_NUMBER'),
    to: phoneNumber,
  });

  // Temporarily store phone in user (optional, or wait for verification)
  user.phoneNumber = phoneNumber;
  await this.usersRepository.save(user);

  return { message: `Verification code sent to ${phoneNumber}` };
}

async verifyOtpForGoogleUser(userId: string, code: string) {
 const user = await this.usersRepository.findOne({ where: { id: Number(userId) } });


  if (!user || !user.phoneNumber) {
    throw new NotFoundException('User or phone number not found');
  }

  const otp = await this.otpRepository.findOne({
    where: { phoneNumber: user.phoneNumber, code },
    order: { createdAt: 'DESC' },
  });

  if (!otp) {
    throw new BadRequestException('Invalid or expired verification code');
  }

  // Mark phone as verified
  user.isPhoneVerified = true;
  await this.usersRepository.save(user);
  await this.otpRepository.delete({ phoneNumber: user.phoneNumber });

  const payload = {
    email: user.email,
    sub: user.id,
    role: user.role,
  };

  return {
    message: 'Phone verification successful',
    access_token: this.jwtService.sign(payload),
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}


  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }
}
