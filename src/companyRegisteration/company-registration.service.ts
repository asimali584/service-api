import {
  Injectable,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../auth/user.entity';
import { Company } from '../auth/company.entity';
import { CompanyPreference } from '../auth/company-preference.entity';
import { Service, RateType } from '../auth/service.entity';
import {
  CompanyRegisterDto,
  CompanyDetailsDto,
  CompanyPreferencesDto,
  CreateServiceDto,
  CompanyVerifyDto,
} from './dto/company-registration.dto';
import { AuthService } from '../auth/auth.service'; // Import AuthService
import { JwtService } from '@nestjs/jwt';
import { extname } from 'path';

@Injectable()
export class CompanyRegistrationService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(CompanyPreference)
    private companyPreferenceRepository: Repository<CompanyPreference>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    private jwtService: JwtService,
    private authService: AuthService, // Inject AuthService
  ) {}

  async companyRegister(companyRegisterDto: CompanyRegisterDto) {
    const { fullName, email, password, confirmPassword, phoneNumber } =
      companyRegisterDto;

    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Delegate to AuthService for OTP generation and sending
    return this.authService.register({
      fullName,
      email,
      password,
      confirmPassword,
      phoneNumber,
      role: UserRole.COMPANY, // Set role to COMPANY
    });
  }

  async companyVerify(companyVerifyDto: CompanyVerifyDto) {
    const { phoneNumber, code, fullName, email, password, confirmPassword } =
      companyVerifyDto;

    console.log({ companyVerifyDto });

    // Delegate to AuthService for OTP verification and user creation
    return this.authService.verifyPhone(phoneNumber, code, {
      fullName,
      email,
      password,
      confirmPassword,
      phoneNumber,
      role: UserRole.COMPANY, // Ensure role is COMPANY
    });
  }

  async updateCompanyDetails(
    companyDetailsDto: CompanyDetailsDto,
    userId: number,
    image: Express.Multer.File,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true },
    });

    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to update company details',
      );
    }

    // ✅ Manually validate required fields at service level
    const { businessName, businessType, businessDescription } =
      companyDetailsDto;

    if (!businessName || businessName.trim() === '') {
      throw new BadRequestException('Business name is required.');
    }
    if (!businessType || businessType.trim() === '') {
      throw new BadRequestException('Business type is required.');
    }
    if (!businessDescription || businessDescription.trim() === '') {
      throw new BadRequestException('Business description is required.');
    }

    let company = await this.companyRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!company) {
      if (!image) {
        throw new BadRequestException('Image is required.');
      }

      company = this.companyRepository.create({
        ...companyDetailsDto,
        user,
        imageUrl: `${process.env.SERVER_URI}/${image.path}`,
      });
    } else {
      Object.assign(company, companyDetailsDto);
      if (image) {
        company.imageUrl = `${process.env.SERVER_URI}/${image.path}`;
      }
    }

    await this.companyRepository.save(company);
    return {
      message:
        'Company details saved successfully. Please submit company preferences.',
    };
  }

  async getCompanyImage(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true },
    });

    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to get privacy image',
      );
    }

    const company = await this.companyRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!company || !company.imageUrl) {
      return { imageUrl: null };
    }

    return { imageUrl: company.imageUrl };
  }

  async updateCompanyPreferences(
    companyPreferencesDto: CompanyPreferencesDto,
    userId: number,
    image: Express.Multer.File,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true },
    });
    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to update company preferences',
      );
    }

    let companyPreference = await this.companyPreferenceRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!companyPreference) {
      companyPreference = this.companyPreferenceRepository.create({
        ...companyPreferencesDto,
        user,
      });
    } else {
      Object.assign(companyPreference, companyPreferencesDto);
    }

    // Extract day names from dates if provided
    if (companyPreferencesDto.startDate) {
      const start = new Date(companyPreferencesDto.startDate);
      companyPreference.startDay = start.toLocaleDateString('en-US', {
        weekday: 'long',
      });
      companyPreference.startDate = start;
    }
    if (companyPreferencesDto.endDate) {
      const end = new Date(companyPreferencesDto.endDate);
      companyPreference.endDay = end.toLocaleDateString('en-US', {
        weekday: 'long',
      });
      companyPreference.endDate = end;
    }

    await this.companyPreferenceRepository.save(companyPreference);

    if (image) {
      let company = await this.companyRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!company) {
        company = this.companyRepository.create({
          businessName: '',
          businessType: '',
          businessDescription: '',
          imageUrl: `${process.env.SERVER_URI}/${image.path}`,
          user,
        });
      } else {
        company.imageUrl = `${process.env.SERVER_URI}/${image.path}`;
      }

      await this.companyRepository.save(company);
    }

    return { message: 'Company preferences saved successfully' };
  }

  async updateCompanyPrivacy(userId: number, image: Express.Multer.File) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true },
    });

    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to update company privacy image',
      );
    }

    if (!image) {
      throw new BadRequestException('Privacy image is required');
    }

    let company = await this.companyRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!company) {
      // If company row doesn't exist yet, create one with the new image
      company = this.companyRepository.create({
        businessName: '',
        businessType: '',
        businessDescription: '',
        imageUrl: `${process.env.SERVER_URI}/${image.path}`,
        user,
      });
    } else {
      // If company row exists, just update the image
      company.imageUrl = `${process.env.SERVER_URI}/${image.path}`;
    }

    await this.companyRepository.save(company);

    return { message: 'Image updated successfully' };
  }

  async getCompanyServices(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true },
    });

    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to retrieve services',
      );
    }

    const services = await this.serviceRepository.find({
      where: { user: { id: userId } },
      select: ['id', 'serviceName', 'imageUrl', 'price'],
    });

    return { services };
  }

  async createService(
    createServiceDto: CreateServiceDto,
    userId: number,
    image: Express.Multer.File,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true }, // Check isVerified
    });
    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to create a service',
      );
    }

    if (!image) {
      throw new BadRequestException('Service image is required');
    }

    const allowedExtensions = ['.jpg', '.jpeg', '.png'];
    const ext = extname(image.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException(
        'Only JPG, JPEG, or PNG images are allowed',
      );
    }

    const { rateType, timeDuration } = createServiceDto;
    if (
      [RateType.BY_HOUR, RateType.BY_ROOM, RateType.BY_WINDOW].includes(
        rateType,
      ) &&
      !timeDuration
    ) {
      throw new BadRequestException(
        `Time duration is required for rate type ${rateType}`,
      );
    }
    if (rateType === RateType.FIXED_PRICE && timeDuration) {
      throw new BadRequestException(
        'Time duration should not be provided for Fixed price',
      );
    }

    const service = this.serviceRepository.create({
      ...createServiceDto,
      imageUrl: `${process.env.SERVER_URI}/${image.path}`,
      user,
    });

    try {
      await this.serviceRepository.save(service);
      return { message: 'Service created successfully' };
    } catch (error) {
      console.error('Database save error:', error.message);
      throw new InternalServerErrorException('Failed to save service');
    }
  }

  async getCompanyProfile(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true },
    });

    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to access company profile.',
      );
    }

    const company = await this.companyRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!company) {
      throw new BadRequestException('Company details not found.');
    }

    // Only return required fields
    return {
      businessName: company.businessName,
      imageUrl: company.imageUrl,
    };
  }

  async getCompanyInfo(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true },
    });

    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to access this information.',
      );
    }

    const company = await this.companyRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!company) {
      throw new BadRequestException('Company details not found.');
    }

    return {
      email: user.email,
      businessName: company.businessName,
      imageUrl: company.imageUrl,
    };
  }

  async getCompanyRelatedIds(userId: number) {
  const user = await this.usersRepository.findOne({
    where: { id: userId, role: UserRole.COMPANY, isVerified: true },
  });

  if (!user) {
    throw new BadRequestException('User must be a verified company.');
  }

  const company = await this.companyRepository.findOne({
    where: { user: { id: userId } },
    select: ['id'],
  });

  const companyPreference = await this.companyPreferenceRepository.findOne({
    where: { user: { id: userId } },
    select: ['id'],
  });

  return {
    companyDetailsId: company ? company.id : null,
    companyPreferenceId: companyPreference ? companyPreference.id : null,
  };
}

}
