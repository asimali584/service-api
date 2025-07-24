import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../auth/user.entity';
import { CompanyPreference } from '../auth/company-preference.entity';
import { Service } from '../auth/service.entity';
import { CustomerLocationDto, GetServicesDto } from './dto/customer.dto';
import { FilterServicesDto } from './dto/filter-services.dto';

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(CompanyPreference)
    private companyPreferenceRepository: Repository<CompanyPreference>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
  ) {}

  async saveLocation(customerLocationDto: CustomerLocationDto, userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.CUSTOMER, isVerified: true },
    });
    if (!user) {
      throw new UnauthorizedException(
        'User must be a verified customer to save location',
      );
    }

    user.latitude = customerLocationDto.latitude;
    user.longitude = customerLocationDto.longitude;

    await this.usersRepository.save(user);
    return { message: 'Location saved successfully' };
  }

  async getServicesWithinRadius(
    getServicesDto: GetServicesDto,
    userId: number,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.CUSTOMER, isVerified: true },
    });
    if (!user) {
      throw new UnauthorizedException(
        'User must be a verified customer to view services',
      );
    }

    const customerLat = getServicesDto.latitude;
    const customerLon = getServicesDto.longitude;

    if (!customerLat || !customerLon) {
      throw new BadRequestException(
        'Customer location coordinates are required',
      );
    }

    const services = await this.serviceRepository.find({
      relations: ['user', 'user.company', 'user.companyPreference'],
    });



    const servicesWithinRadius = services.filter((service) => {
      const companyPreference = service.user.companyPreference;
      if (
        !companyPreference ||
        !companyPreference.latitude ||
        !companyPreference.longitude
      ) {
        return false;
      }

      const distance = this.calculateDistance(
        customerLat,
        customerLon,
        companyPreference.latitude,
        companyPreference.longitude,
      );

      return distance <= companyPreference.distanceRange;
    });

    return {
      message: servicesWithinRadius.length
        ? 'Services retrieved successfully'
        : 'No Service Found in your Location',
      data: servicesWithinRadius.map((service) => {
        const companyPreference = service.user.companyPreference;
        let availability = 'Not available';

        if (companyPreference && companyPreference.workingDays && companyPreference.workingDays.length > 0) {
          const workingDays = companyPreference.workingDays;
          const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'short' });
          
          // Check if today is a working day
          const isTodayWorkingDay = workingDays.includes(currentDayName);
          
          if (isTodayWorkingDay) {
            availability = 'Available Now';
          } else {
            // Try to find next available day within 7 days
            let foundNext = false;
            
            for (let i = 1; i <= 7; i++) {
              const nextDate = new Date();
              nextDate.setDate(nextDate.getDate() + i);
              const nextDayName = nextDate.toLocaleDateString('en-US', { weekday: 'short' });
              
              if (workingDays.includes(nextDayName)) {
                if (i === 1) {
                  availability = `Available Tomorrow`;
                } else {
                  availability = `Available ${nextDayName}`;
                }
                foundNext = true;
                break;
              }
            }
            
            if (!foundNext) {
              availability = 'Not available';
            }
          }
        }

        return {
          id: service.id,
          serviceName: service.serviceName,
          description: service.description,
          location: service.location,
          rateType: service.rateType,
          price: service.price,
          timeDuration: service.timeDuration,
          imagePath: service.imageUrl,
          businessName: service.user.company?.businessName || 'Unknown',
          businessType:
            service.user.company?.businessType || 'Unknown Business Type',
          businessProfileImage:
            service.user.company?.imageUrl || 'Unknown Business Profile Image',
          availability,
        };
      }),
    };
  }

  async filterServicesByAvailability(
    filterServicesDto: FilterServicesDto,
    userId: number,
  ) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.CUSTOMER, isVerified: true },
    });
    if (!user) {
      throw new UnauthorizedException(
        'User must be a verified customer to filter services',
      );
    }

    // Use provided coordinates or user's saved location
    const customerLat = filterServicesDto.latitude ?? user.latitude;
    const customerLon = filterServicesDto.longitude ?? user.longitude;

    const services = await this.serviceRepository.find({
      relations: ['user', 'user.company', 'user.companyPreference'],
    });

    let filteredServices = services;

    // 1️⃣ Location filter
    if (customerLat && customerLon) {
      filteredServices = filteredServices.filter((service) => {
        const companyPreference = service.user.companyPreference;
        if (!companyPreference?.latitude || !companyPreference?.longitude) {
          return false;
        }

        const distance = this.calculateDistance(
          customerLat,
          customerLon,
          companyPreference.latitude,
          companyPreference.longitude,
        );

        return distance <= companyPreference.distanceRange;
      });
    }

    // 2️⃣ Business Type filter
    if (filterServicesDto.businessType) {
      const searchType = filterServicesDto.businessType.toLowerCase().trim();
      filteredServices = filteredServices.filter((service) => {
        const businessType = service.user.company?.businessType || '';
        return businessType.toLowerCase() === searchType;
      });
    }

    // 3️⃣ Availability filter

    if (filterServicesDto.availability) {
      filteredServices = filteredServices.filter((service) => {
        const companyPreference = service.user.companyPreference;
        let availability = 'Not available';

        if (companyPreference && companyPreference.workingDays && companyPreference.workingDays.length > 0) {
          const workingDays = companyPreference.workingDays;
          const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'short' });
          
          // Check if today is a working day
          const isTodayWorkingDay = workingDays.includes(currentDayName);
          
          if (isTodayWorkingDay) {
            availability = 'Available Now';
          } else {
            // Try to find next available day within 7 days
            let foundNext = false;
            
            for (let i = 1; i <= 7; i++) {
              const nextDate = new Date();
              nextDate.setDate(nextDate.getDate() + i);
              const nextDayName = nextDate.toLocaleDateString('en-US', { weekday: 'short' });
              
              if (workingDays.includes(nextDayName)) {
                if (i === 1) {
                  availability = `Available Tomorrow`;
                } else {
                  availability = `Available ${nextDayName}`;
                }
                foundNext = true;
                break;
              }
            }
            
            if (!foundNext) {
              availability = 'Not available';
            }
          }
        }

        return (
          availability.toLowerCase() ===
          filterServicesDto.availability!.toLowerCase()
        );
      });
    }

    return {
      message: filteredServices.length
        ? 'Services filtered successfully'
        : 'No Service Found for given filters',
      data: filteredServices.map((service) => {
        // Recalculate availability for each item in response
        const companyPreference = service.user.companyPreference;
        let availability = 'Not available';

        if (companyPreference && companyPreference.workingDays && companyPreference.workingDays.length > 0) {
          const workingDays = companyPreference.workingDays;
          const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'short' });
          
          // Check if today is a working day
          const isTodayWorkingDay = workingDays.includes(currentDayName);
          
          if (isTodayWorkingDay) {
            availability = 'Available Now';
          } else {
            // Try to find next available day within 7 days
            let foundNext = false;
            
            for (let i = 1; i <= 7; i++) {
              const nextDate = new Date();
              nextDate.setDate(nextDate.getDate() + i);
              const nextDayName = nextDate.toLocaleDateString('en-US', { weekday: 'short' });
              
              if (workingDays.includes(nextDayName)) {
                if (i === 1) {
                  availability = `Available Tomorrow`;
                } else {
                  availability = `Available ${nextDayName}`;
                }
                foundNext = true;
                break;
              }
            }
            
            if (!foundNext) {
              availability = 'Not available';
            }
          }
        }

        return {
          id: service.id,
          serviceName: service.serviceName,
          description: service.description,
          location: service.location,
          rateType: service.rateType,
          price: service.price,
          timeDuration: service.timeDuration,
          imagePath: service.imageUrl,
          businessName: service.user.company?.businessName || 'Unknown',
          businessType:
            service.user.company?.businessType || 'Unknown Business Type',
          businessProfileImage:
            service.user.company?.imageUrl || 'Unknown Business Profile Image',
          availability,
        };
      }),
    };
  }

  async getCustomerProfile(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.CUSTOMER, isVerified: true },
      select: ['fullName', 'email'], // Select only needed fields
    });

    if (!user) {
      throw new UnauthorizedException(
        'User not found or not a verified customer',
      );
    }

    return {
      fullName: user.fullName,
      email: user.email,
    };
  }

  // Haversine formula to calculate distance between two points (in kilometers)
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // Earth's radius in kilometers

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
