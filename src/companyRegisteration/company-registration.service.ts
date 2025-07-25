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
  UpdateCompanyInfoDto,
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
    coverImage: Express.Multer.File,
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
      company = this.companyRepository.create({
        ...companyDetailsDto,
        user,
        imageUrl: `${process.env.SERVER_URI}/${image.path}`,
        coverImageUrl: `${process.env.SERVER_URI}/${coverImage.path}`,
      });
    } else {
      Object.assign(company, companyDetailsDto);
      company.imageUrl = `${process.env.SERVER_URI}/${image.path}`;
      company.coverImageUrl = `${process.env.SERVER_URI}/${coverImage.path}`;
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

    if (!company) {
      return { imageUrl: null, coverImageUrl: null };
    }

    return { 
      imageUrl: company.imageUrl || null, 
      coverImageUrl: company.coverImageUrl || null 
    };
  }

  async updateCompanyPreferences(
    companyPreferencesDto: CompanyPreferencesDto,
    userId: number,
    image: Express.Multer.File,
    coverImage: Express.Multer.File,
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

    // Validate working days if provided
    if (companyPreferencesDto.workingDays) {
      const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      // Convert to array if it's a string (single day or comma-separated days)
      let workingDaysArray: string[];
      if (typeof companyPreferencesDto.workingDays === 'string') {
        // Split by comma and trim whitespace
        const workingDaysString = companyPreferencesDto.workingDays as string;
        workingDaysArray = workingDaysString.split(',').map(day => day.trim());
      } else if (Array.isArray(companyPreferencesDto.workingDays)) {
        workingDaysArray = companyPreferencesDto.workingDays;
      } else {
        throw new BadRequestException('workingDays must be a string or array of strings');
      }
      
      const invalidDays = workingDaysArray.filter(day => !validDays.includes(day));
      
      if (invalidDays.length > 0) {
        throw new BadRequestException(`Invalid working days: ${invalidDays.join(', ')}. Valid days are: ${validDays.join(', ')}`);
      }
      
      companyPreference.workingDays = workingDaysArray;
    }

    // Validate and set working hours if provided
    if (companyPreferencesDto.startTime || companyPreferencesDto.endTime) {
      // Validate time format (HH:MM AM/PM)
      const timeRegex = /^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM|am|pm)$/;
      
      if (companyPreferencesDto.startTime && !timeRegex.test(companyPreferencesDto.startTime)) {
        throw new BadRequestException('Invalid start time format. Use format like "9:00 AM" or "2:30 PM"');
      }
      
      if (companyPreferencesDto.endTime && !timeRegex.test(companyPreferencesDto.endTime)) {
        throw new BadRequestException('Invalid end time format. Use format like "5:00 PM" or "11:30 PM"');
      }
      
      // Set the times
      if (companyPreferencesDto.startTime) {
        companyPreference.startTime = companyPreferencesDto.startTime;
      }
      if (companyPreferencesDto.endTime) {
        companyPreference.endTime = companyPreferencesDto.endTime;
      }
    }

    await this.companyPreferenceRepository.save(companyPreference);

    // Handle image updates if provided
    if (image || coverImage) {
      let company = await this.companyRepository.findOne({
        where: { user: { id: userId } },
      });

      if (!company) {
        company = this.companyRepository.create({
          businessName: '',
          businessType: '',
          businessDescription: '',
          imageUrl: image ? `${process.env.SERVER_URI}/${image.path}` : '',
          coverImageUrl: coverImage ? `${process.env.SERVER_URI}/${coverImage.path}` : '',
          user,
        });
      } else {
        if (image) {
          company.imageUrl = `${process.env.SERVER_URI}/${image.path}`;
        }
        if (coverImage) {
          company.coverImageUrl = `${process.env.SERVER_URI}/${coverImage.path}`;
        }
      }

      await this.companyRepository.save(company);
    }

    return { message: 'Company preferences saved successfully' };
  }

  async updateCompanyPrivacy(userId: number, image: Express.Multer.File, coverImage: Express.Multer.File) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true },
    });

    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to update company privacy image',
      );
    }

    // At least one image should be provided
    if (!image && !coverImage) {
      throw new BadRequestException('At least one image (profile or cover) is required');
    }

    let company = await this.companyRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!company) {
      // If company row doesn't exist yet, create one with the provided images
      company = this.companyRepository.create({
        businessName: '',
        businessType: '',
        businessDescription: '',
        imageUrl: image ? `${process.env.SERVER_URI}/${image.path}` : '',
        coverImageUrl: coverImage ? `${process.env.SERVER_URI}/${coverImage.path}` : '',
        user,
      });
    } else {
      // If company row exists, update the provided images
      if (image) {
        company.imageUrl = `${process.env.SERVER_URI}/${image.path}`;
      }
      if (coverImage) {
        company.coverImageUrl = `${process.env.SERVER_URI}/${coverImage.path}`;
      }
    }

    await this.companyRepository.save(company);

    return { message: 'Image(s) updated successfully' };
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
    });

    return {
      message: 'Services retrieved successfully',
      data: services.map(service => ({
        id: service.id,
        serviceName: service.serviceName,
        description: service.description,
        location: service.location,
        rateType: service.rateType,
        price: service.price,
        timeDuration: service.timeDuration,
        numberOfRooms: service.numberOfRooms,
        numberOfWindows: service.numberOfWindows,
        imageUrl: service.imageUrl,
      })),
    };
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

    const { rateType, timeDuration, numberOfRooms, numberOfWindows } = createServiceDto;
    
    // Validate fields based on rate type
    if (rateType === RateType.BY_HOUR) {
      if (!timeDuration) {
        throw new BadRequestException('Time duration is required for By hour rate type');
      }
      if (numberOfRooms || numberOfWindows) {
        throw new BadRequestException('Number of rooms and windows should not be provided for By hour rate type');
      }
    } else if (rateType === RateType.BY_ROOM) {
      if (!numberOfRooms) {
        throw new BadRequestException('Number of rooms is required for By Room rate type');
      }
      if (timeDuration || numberOfWindows) {
        throw new BadRequestException('Time duration and number of windows should not be provided for By Room rate type');
      }
    } else if (rateType === RateType.BY_WINDOW) {
      if (!numberOfWindows) {
        throw new BadRequestException('Number of windows is required for By Window rate type');
      }
      if (timeDuration || numberOfRooms) {
        throw new BadRequestException('Time duration and number of rooms should not be provided for By Window rate type');
      }
    } else if (rateType === RateType.FIXED_PRICE) {
      if (timeDuration || numberOfRooms || numberOfWindows) {
        throw new BadRequestException('Time duration, number of rooms, and number of windows should not be provided for Fixed Price rate type');
      }
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
      coverImageUrl: company.coverImageUrl,
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

    const companyPreference = await this.companyPreferenceRepository.findOne({
      where: { user: { id: userId } },
    });

    return {
      email: user.email,
      businessName: company.businessName,
      imageUrl: company.imageUrl,
      coverImageUrl: company.coverImageUrl,
      businessType: company.businessType,
      businessDescription: company.businessDescription,
      workingDays: companyPreference?.workingDays?.join(', ') || '',
      startTime: companyPreference?.startTime || null,
      endTime: companyPreference?.endTime || null,
    };
  }

  async updateCompanyInfo(
    userId: number,
    updateCompanyInfoDto: UpdateCompanyInfoDto,
    image?: Express.Multer.File,
    coverImage?: Express.Multer.File,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true },
    });

    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to update company information.',
      );
    }

    // Get or create company record
    let company = await this.companyRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!company) {
      company = this.companyRepository.create({
        businessName: '',
        businessType: '',
        businessDescription: '',
        imageUrl: '',
        coverImageUrl: '',
        user,
      });
    }

    // Get or create company preference record
    let companyPreference = await this.companyPreferenceRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!companyPreference) {
      companyPreference = this.companyPreferenceRepository.create({
        websiteLink: '',
        latitude: 0,
        longitude: 0,
        distanceRange: 0,
        workingDays: [],
        startTime: '',
        endTime: '',
        user,
      });
    }

    // Update company fields if provided
    if (updateCompanyInfoDto.businessName !== undefined) {
      company.businessName = updateCompanyInfoDto.businessName;
    }
    if (updateCompanyInfoDto.businessType !== undefined) {
      company.businessType = updateCompanyInfoDto.businessType;
    }
    if (updateCompanyInfoDto.businessDescription !== undefined) {
      company.businessDescription = updateCompanyInfoDto.businessDescription;
    }

    // Update images if provided
    if (image) {
      company.imageUrl = `${process.env.SERVER_URI}/${image.path}`;
    }
    if (coverImage) {
      company.coverImageUrl = `${process.env.SERVER_URI}/${coverImage.path}`;
    }

    // Update company preference fields if provided
    if (updateCompanyInfoDto.workingDays !== undefined) {
      // Validate working days
      const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      // Split by comma and trim whitespace
      const workingDaysArray = updateCompanyInfoDto.workingDays.split(',').map(day => day.trim());
      
      const invalidDays = workingDaysArray.filter(day => !validDays.includes(day));
      
      if (invalidDays.length > 0) {
        throw new BadRequestException(`Invalid working days: ${invalidDays.join(', ')}. Valid days are: ${validDays.join(', ')}`);
      }
      
      companyPreference.workingDays = workingDaysArray;
    }

    if (updateCompanyInfoDto.startTime !== undefined) {
      // Validate time format (HH:MM AM/PM)
      const timeRegex = /^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM|am|pm)$/;
      
      if (updateCompanyInfoDto.startTime && !timeRegex.test(updateCompanyInfoDto.startTime)) {
        throw new BadRequestException('Invalid start time format. Use format like "9:00 AM" or "2:30 PM"');
      }
      
      companyPreference.startTime = updateCompanyInfoDto.startTime;
    }

    if (updateCompanyInfoDto.endTime !== undefined) {
      // Validate time format (HH:MM AM/PM)
      const timeRegex = /^(1[0-2]|0?[1-9]):([0-5][0-9])\s?(AM|PM|am|pm)$/;
      
      if (updateCompanyInfoDto.endTime && !timeRegex.test(updateCompanyInfoDto.endTime)) {
        throw new BadRequestException('Invalid end time format. Use format like "5:00 PM" or "11:30 PM"');
      }
      
      companyPreference.endTime = updateCompanyInfoDto.endTime;
    }

    // Save both records
    await this.companyRepository.save(company);
    await this.companyPreferenceRepository.save(companyPreference);

    return {
      message: 'Company information updated successfully',
      data: {
        businessName: company.businessName,
        businessType: company.businessType,
        businessDescription: company.businessDescription,
        imageUrl: company.imageUrl,
        coverImageUrl: company.coverImageUrl,
        workingDays: companyPreference.workingDays?.join(', ') || '',
        startTime: companyPreference.startTime,
        endTime: companyPreference.endTime,
      },
    };
  }

  async deleteService(serviceId: number, userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.COMPANY, isVerified: true },
    });

    if (!user) {
      throw new BadRequestException(
        'User must be a verified company to delete services.',
      );
    }

    // Find the service and verify it belongs to the user
    const service = await this.serviceRepository.findOne({
      where: { id: serviceId, user: { id: userId } },
    });

    if (!service) {
      throw new BadRequestException(
        'Service not found or you do not have permission to delete this service.',
      );
    }

    try {
      await this.serviceRepository.remove(service);
      return {
        message: 'Service deleted successfully',
        deletedService: {
          id: service.id,
          serviceName: service.serviceName,
          rateType: service.rateType,
        },
      };
    } catch (error) {
      console.error('Database delete error:', error.message);
      throw new InternalServerErrorException('Failed to delete service');
    }
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
