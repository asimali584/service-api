import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { Company } from './company.entity';
import { CompanyPreference } from './company-preference.entity';
import { Service } from './service.entity';

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  COMPANY = 'company',
}

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  fullName: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  password: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Column({ unique: true, nullable: true })
  phoneNumber: string;

  @Column({ type: 'float', nullable: true }) // Add latitude
  latitude?: number;

  @Column({ type: 'float', nullable: true }) // Add longitude
  longitude?: number;

  @Column({ default: false })
isPhoneVerified: boolean;


  @OneToOne(() => Company, (company) => company.user)
  company: Company;

  @OneToOne(
    () => CompanyPreference,
    (companyPreference) => companyPreference.user,
  )
  companyPreference: CompanyPreference;

  @OneToMany(() => Service, (service) => service.user)
  service: Service;
}
