import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CompanyRegistrationController } from './company-registration.controller';
import { CompanyRegistrationService } from './company-registration.service';
import { User } from '../auth/user.entity';
import { Company } from '../auth/company.entity';
import { CompanyPreference } from '../auth/company-preference.entity';
import { Service } from 'src/auth/service.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Company, CompanyPreference, Service]),
    JwtModule.register({
      global: true,
      secret: 'jwt secret',
      signOptions: { expiresIn: '30d' },
    }),
    AuthModule,
  ],
  controllers: [CompanyRegistrationController],
  providers: [CompanyRegistrationService],
})
export class CompanyRegistrationModule {}
