import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Get,
} from '@nestjs/common';
import { CompanyRegistrationService } from './company-registration.service';
import {
  CompanyRegisterDto,
  CompanyDetailsDto,
  CompanyPreferencesDto,
  CreateServiceDto,
  CompanyVerifyDto, // Import new DTO
} from './dto/company-registration.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('company-auth')
export class CompanyRegistrationController {
  constructor(
    private readonly companyRegistrationService: CompanyRegistrationService,
  ) {}

  @Post('company-register')
  @HttpCode(HttpStatus.OK)
  async companyRegister(@Body() companyRegisterDto: CompanyRegisterDto) {
    console.log('Received Company Registeration:', companyRegisterDto);
    return this.companyRegistrationService.companyRegister(companyRegisterDto);
  }

  @Post('company-verify')
  @HttpCode(HttpStatus.OK)
  async companyVerify(@Body() companyVerifyDto: CompanyVerifyDto) {
    console.log('Received Company Verification:', companyVerifyDto);
    return this.companyRegistrationService.companyVerify(companyVerifyDto);
  }

  @Patch('company-details')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const extension = extname(file.originalname).toLowerCase();
          cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  @HttpCode(HttpStatus.OK)
  async updateCompanyDetails(
    @Request() req,
    @Body() companyDetailsDto: CompanyDetailsDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    console.log('Received Company Details:', companyDetailsDto);
    return this.companyRegistrationService.updateCompanyDetails(
      companyDetailsDto,
      req.user.userId,
      image,
    );
  }

  @Get('company-image')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCompanyPrivacy(@Request() req) {
    return this.companyRegistrationService.getCompanyImage(req.user.userId);
  }

  @Patch('company-preferences')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const extension = extname(file.originalname).toLowerCase();
          cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    }),
  )
  @HttpCode(HttpStatus.OK)
  async updateCompanyPreferences(
    @Request() req,
    @Body() companyPreferencesDto: CompanyPreferencesDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    console.log('Received Company Preferences:', companyPreferencesDto);
    return this.companyRegistrationService.updateCompanyPreferences(
      companyPreferencesDto,
      req.user.userId,
      image,
    );
  }

  // update company profile picture
  @Patch('company-privacy')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const extension = extname(file.originalname).toLowerCase();
          cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    }),
  )
  @HttpCode(HttpStatus.OK)
  async updateCompanyPrivacy(
    @Request() req,
    @UploadedFile() image: Express.Multer.File,
  ) {
    console.log('Received Privacy Image:', image);

    return this.companyRegistrationService.updateCompanyPrivacy(
      req.user.userId,
      image,
    );
  }

  // Getting company profile picture and business Name also
  @Get('company-profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCompanyProfile(@Request() req) {
    return this.companyRegistrationService.getCompanyProfile(req.user.userId);
  }

  // allow capmpany to see the service they
  @Get('get-services')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCompanyServices(@Request() req) {
    console.log('Getting Service', req.user.userId);
    return this.companyRegistrationService.getCompanyServices(req.user.userId);
  }

  // display company (BusinessName, Image, email Address) for company profile
  @Get('company-info')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCompanyInfo(@Request() req) {
    return this.companyRegistrationService.getCompanyInfo(req.user.userId);
  }

  @Post('services')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const extension = extname(file.originalname).toLowerCase();
          cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  async createService(
    @Request() req,
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFile() image: Express.Multer.File,
  ) {
    console.log('Received Company Service:', createServiceDto);
    return this.companyRegistrationService.createService(
      createServiceDto,
      req.user.userId,
      image,
    );
  }

  @Get('company-ids')
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.OK)
async getCompanyRelatedIds(@Request() req) {
  return this.companyRegistrationService.getCompanyRelatedIds(req.user.userId);
}

}
