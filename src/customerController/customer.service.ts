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

    const currentDate = new Date();
    const currentDayName = currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
    });

    const daysOfWeek = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

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

        if (companyPreference) {
          const startDay = companyPreference.startDay;
          const endDay = companyPreference.endDay;
          const startDate = companyPreference.startDate;
          const endDate = companyPreference.endDate;

          if (startDay && endDay && startDate && endDate) {
            const startDayIndex = daysOfWeek.indexOf(startDay);
            const endDayIndex = daysOfWeek.indexOf(endDay);
            const currentDayIndex = daysOfWeek.indexOf(currentDayName);

            const today = new Date(currentDate);
            today.setHours(0, 0, 0, 0);

            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(0, 0, 0, 0);

            const isEndAfterStart = endDayIndex >= startDayIndex;

            const isTodayInDayRange = isEndAfterStart
              ? currentDayIndex >= startDayIndex &&
                currentDayIndex <= endDayIndex
              : currentDayIndex >= startDayIndex ||
                currentDayIndex <= endDayIndex;

            const isTodayInDateRange = start <= today && today <= end;

            if (isTodayInDayRange && isTodayInDateRange) {
              availability = 'Available Now';
            } else {
              // Try to find next available day within 7 days
              let foundNext = false;
              // Inside the for loop that finds the next available day
              for (let i = 1; i <= 7; i++) {
                const nextDate = new Date(today);
                nextDate.setDate(today.getDate() + i);

                const nextDayIndex = (currentDayIndex + i) % 7;
                const nextDayName = daysOfWeek[nextDayIndex];

                const isNextDayInRange = isEndAfterStart
                  ? nextDayIndex >= startDayIndex && nextDayIndex <= endDayIndex
                  : nextDayIndex >= startDayIndex ||
                    nextDayIndex <= endDayIndex;

                const isNextDateInRange = start <= nextDate && nextDate <= end;

                if (isNextDayInRange && isNextDateInRange) {
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
    const currentDate = new Date();
    const currentDayName = currentDate.toLocaleDateString('en-US', {
      weekday: 'long',
    });

    const daysOfWeek = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    if (filterServicesDto.availability) {
      filteredServices = filteredServices.filter((service) => {
        const companyPreference = service.user.companyPreference;
        let availability = 'Not available';

        if (companyPreference) {
          const startDay = companyPreference.startDay;
          const endDay = companyPreference.endDay;
          const startDate = companyPreference.startDate;
          const endDate = companyPreference.endDate;

          if (startDay && endDay && startDate && endDate) {
            const startDayIndex = daysOfWeek.indexOf(startDay);
            const endDayIndex = daysOfWeek.indexOf(endDay);
            const currentDayIndex = daysOfWeek.indexOf(currentDayName);

            const today = new Date(currentDate);
            today.setHours(0, 0, 0, 0);

            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(0, 0, 0, 0);

            const isEndAfterStart = endDayIndex >= startDayIndex;

            const isTodayInDayRange = isEndAfterStart
              ? currentDayIndex >= startDayIndex &&
                currentDayIndex <= endDayIndex
              : currentDayIndex >= startDayIndex ||
                currentDayIndex <= endDayIndex;

            const isTodayInDateRange = start <= today && today <= end;

            if (isTodayInDayRange && isTodayInDateRange) {
              availability = 'Available Now';
            } else {
              let foundNext = false;
              for (let i = 1; i <= 7; i++) {
                const nextDate = new Date(today);
                nextDate.setDate(today.getDate() + i);

                const nextDayIndex = (currentDayIndex + i) % 7;
                const nextDayName = daysOfWeek[nextDayIndex];

                const isNextDayInRange = isEndAfterStart
                  ? nextDayIndex >= startDayIndex && nextDayIndex <= endDayIndex
                  : nextDayIndex >= startDayIndex ||
                    nextDayIndex <= endDayIndex;

                const isNextDateInRange = start <= nextDate && nextDate <= end;

                if (isNextDayInRange && isNextDateInRange) {
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

        if (companyPreference) {
          const startDay = companyPreference.startDay;
          const endDay = companyPreference.endDay;
          const startDate = companyPreference.startDate;
          const endDate = companyPreference.endDate;

          if (startDay && endDay && startDate && endDate) {
            const startDayIndex = daysOfWeek.indexOf(startDay);
            const endDayIndex = daysOfWeek.indexOf(endDay);
            const currentDayIndex = daysOfWeek.indexOf(currentDayName);

            const today = new Date(currentDate);
            today.setHours(0, 0, 0, 0);

            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(0, 0, 0, 0);

            const isEndAfterStart = endDayIndex >= startDayIndex;

            const isTodayInDayRange = isEndAfterStart
              ? currentDayIndex >= startDayIndex &&
                currentDayIndex <= endDayIndex
              : currentDayIndex >= startDayIndex ||
                currentDayIndex <= endDayIndex;

            const isTodayInDateRange = start <= today && today <= end;

            if (isTodayInDayRange && isTodayInDateRange) {
              availability = 'Available Now';
            } else {
              let foundNext = false;
              for (let i = 1; i <= 7; i++) {
                const nextDate = new Date(today);
                nextDate.setDate(today.getDate() + i);

                const nextDayIndex = (currentDayIndex + i) % 7;
                const nextDayName = daysOfWeek[nextDayIndex];

                const isNextDayInRange = isEndAfterStart
                  ? nextDayIndex >= startDayIndex && nextDayIndex <= endDayIndex
                  : nextDayIndex >= startDayIndex ||
                    nextDayIndex <= endDayIndex;

                const isNextDateInRange = start <= nextDate && nextDate <= end;

                if (isNextDayInRange && isNextDateInRange) {
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
