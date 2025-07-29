import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../auth/user.entity';
import { CompanyPreference } from '../auth/company-preference.entity';
import { Service } from '../auth/service.entity';
import { CustomerLocationDto, GetServicesDto, BusinessDetailsDto } from './dto/customer.dto';
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
      order: { id: 'ASC' }, // Order by ID to get first created service
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

      // Use the appropriate distance range based on the company's preferred unit
      const distanceRange = companyPreference.distanceUnit === 'miles' 
        ? companyPreference.distanceRangeMiles 
        : companyPreference.distanceRangeKilometer;
      
      return distance <= distanceRange;
    });

    // Group services by company/business
    const businessMap = new Map();

    servicesWithinRadius.forEach((service) => {
      const companyId = service.user.id;
      
      if (!businessMap.has(companyId)) {
        // Initialize business data
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

        businessMap.set(companyId, {
          businessImage: service.user.company?.imageUrl || 'Unknown Business Profile Image',
          coverImageUrl: service.user.company?.coverImageUrl || 'Unknown Cover Image',
          businessName: service.user.company?.businessName || 'Unknown',
          businessType: service.user.company?.businessType || 'Unknown Business Type',
          availability,
          location: service.location, // Location of first created service
          price: service.price, // Price of first created service (will be updated to lowest)
          services: [service.price], // Track all prices to find lowest
        });
      } else {
        // Update existing business data
        const businessData = businessMap.get(companyId);
        businessData.services.push(service.price);
        
        // Update price to lowest
        const lowestPrice = Math.min(...businessData.services);
        businessData.price = lowestPrice;
      }
    });

    // Convert map to array and format response
    const businesses = Array.from(businessMap.entries()).map(([companyId, business]) => ({
      id: companyId,
      businessImage: business.businessImage,
      coverImageUrl: business.coverImageUrl,
      businessName: business.businessName,
      businessType: business.businessType,
      availability: business.availability,
      location: business.location,
      price: business.price.toString(),
    }));

    return {
      message: businesses.length
        ? 'Businesses retrieved successfully'
        : 'No Business Found in your Location',
      data: businesses,
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
      order: { id: 'ASC' }, // Order by ID to get first created service
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

        // Use the appropriate distance range based on the company's preferred unit
        const distanceRange = companyPreference.distanceUnit === 'miles' 
          ? companyPreference.distanceRangeMiles 
          : companyPreference.distanceRangeKilometer;
        
        return distance <= distanceRange;
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

    // 3️⃣ Working Days filter
    if (filterServicesDto.workingDays) {
      const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      
      // Convert to array if it's a string (single day or comma-separated days)
      let requestedWorkingDays: string[];
      if (typeof filterServicesDto.workingDays === 'string') {
        // Split by comma and trim whitespace
        const workingDaysString = filterServicesDto.workingDays as string;
        requestedWorkingDays = workingDaysString.split(',').map(day => day.trim());
      } else {
        requestedWorkingDays = [];
      }
      
      // Validate requested days
      const invalidDays = requestedWorkingDays.filter(day => !validDays.includes(day));
      if (invalidDays.length > 0) {
        throw new BadRequestException(`Invalid working days: ${invalidDays.join(', ')}. Valid days are: ${validDays.join(', ')}`);
      }
      
      filteredServices = filteredServices.filter((service) => {
        const companyPreference = service.user.companyPreference;
        
        if (!companyPreference || !companyPreference.workingDays || companyPreference.workingDays.length === 0) {
          return false;
        }
        
        // Check if any of the requested days match the company's working days
        const hasMatchingDays = requestedWorkingDays.some(requestedDay => 
          companyPreference.workingDays.includes(requestedDay)
        );
        
        return hasMatchingDays;
      });
    }

    // 4️⃣ Availability filter

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

    // Group services by company/business
    const businessMap = new Map();

    filteredServices.forEach((service) => {
      const companyId = service.user.id;
      
      if (!businessMap.has(companyId)) {
        // Initialize business data
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

        businessMap.set(companyId, {
          businessImage: service.user.company?.imageUrl || 'Unknown Business Profile Image',
          coverImageUrl: service.user.company?.coverImageUrl || 'Unknown Cover Image',
          businessName: service.user.company?.businessName || 'Unknown',
          businessType: service.user.company?.businessType || 'Unknown Business Type',
          availability,
          location: service.location, // Location of first created service
          price: service.price, // Price of first created service (will be updated to lowest)
          services: [service.price], // Track all prices to find lowest
        });
      } else {
        // Update existing business data
        const businessData = businessMap.get(companyId);
        businessData.services.push(service.price);
        
        // Update price to lowest
        const lowestPrice = Math.min(...businessData.services);
        businessData.price = lowestPrice;
      }
    });

    // Convert map to array and format response
    const businesses = Array.from(businessMap.entries()).map(([companyId, business]) => ({
      id: companyId,
      businessImage: business.businessImage,
      coverImageUrl: business.coverImageUrl,
      businessName: business.businessName,
      businessType: business.businessType,
      availability: business.availability,
      location: business.location,
      price: business.price.toString(),
    }));

    return {
      message: businesses.length
        ? 'Businesses filtered successfully'
        : 'No Business Found for given filters',
      data: businesses,
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

  async getBusinessDetails(businessDetailsDto: BusinessDetailsDto, userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId, role: UserRole.CUSTOMER, isVerified: true },
    });
    if (!user) {
      throw new UnauthorizedException(
        'User must be a verified customer to view business details',
      );
    }

    const business = await this.usersRepository.findOne({
      where: { id: businessDetailsDto.businessId, role: UserRole.COMPANY, isVerified: true },
      relations: ['company', 'companyPreference'],
    });

    if (!business) {
      throw new NotFoundException('Business not found or not a verified company');
    }

    const companyPreference = business.companyPreference;
    
    // Get services for this business
    const services = await this.serviceRepository.find({
      where: { user: { id: businessDetailsDto.businessId } },
    });

    // Calculate availability
    let availability = 'Not available';
    let availabilityDay = '';
    
    if (companyPreference && companyPreference.workingDays && companyPreference.workingDays.length > 0) {
      const workingDays = companyPreference.workingDays;
      const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      
      // Check if today is a working day
      const isTodayWorkingDay = workingDays.includes(currentDayName);
      
      if (isTodayWorkingDay) {
        availability = 'Available Now';
        availabilityDay = currentDayName;
      } else {
        // Try to find next available day within 7 days
        let foundNext = false;
        
        for (let i = 1; i <= 7; i++) {
          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + i);
          const nextDayName = nextDate.toLocaleDateString('en-US', { weekday: 'short' });
          
          if (workingDays.includes(nextDayName)) {
            if (i === 1) {
              availability = 'Available Tomorrow';
              availabilityDay = nextDayName;
            } else {
              availability = `Available ${nextDayName}`;
              availabilityDay = nextDayName;
            }
            foundNext = true;
            break;
          }
        }
        
        if (!foundNext) {
          availability = 'Not available';
          availabilityDay = '';
        }
      }
    }

    return {
      message: 'Business details retrieved successfully',
      data: {
        businessImage: business.company?.imageUrl || 'Unknown Business Profile Image',
        coverImageUrl: business.company?.coverImageUrl || 'Unknown Cover Image',
        businessName: business.company?.businessName || 'Unknown',
        businessType: business.company?.businessType || 'Unknown Business Type',
        availability,
        availabilityDay,
        services: services.map(service => ({
          id: service.id,
          serviceName: service.serviceName,
          description: service.description,
          location: service.location,
          rateType: service.rateType,
          price: service.price.toString(),
          timeDuration: service.timeDuration,
          numberOfRooms: service.numberOfRooms,
          numberOfWindows: service.numberOfWindows,
          imageUrl: service.imageUrl,
        })),
      },
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
