import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Get,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CustomerService } from './customer.service';
import { GetServicesDto, CustomerLocationDto, BusinessDetailsDto } from './dto/customer.dto';
import { FilterServicesDto } from './dto/filter-services.dto';

@ApiTags('Customer')
@Controller('customer')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  // customer location add
  @Post('save-location')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save customer location coordinates' })
  @ApiResponse({ status: 200, description: 'Location saved successfully' })
  async saveLocation(
    @Request() req,
    @Body() customerLocationDto: CustomerLocationDto,
  ) {
    return this.customerService.saveLocation(
      customerLocationDto,
      req.user.userId,
    );
  }

  // customer service view
  @Post('services')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get services within company radius' })
  @ApiResponse({ status: 200, description: 'Services retrieved successfully' })
  async getServices(@Request() req, @Body() getServicesDto: GetServicesDto) {
    return this.customerService.getServicesWithinRadius(
      getServicesDto,
      req.user.userId,
    );
  }

  // Customer service Filter through availability and location
  @Post('services/filter')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Filter services by availability and optional location',
  })
  @ApiResponse({ status: 200, description: 'Services filtered successfully' })
  async filterServices(
    @Request() req,
    @Body() filterServicesDto: FilterServicesDto,
  ) {
    return this.customerService.filterServicesByAvailability(
      filterServicesDto,
      req.user.userId,
    );
  }

  // Get business details when user clicks "Book Now"
  @Post('business-details')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get detailed business information and services' })
  @ApiResponse({
    status: 200,
    description: 'Business details retrieved successfully',
  })
  async getBusinessDetails(@Request() req, @Body() businessDetailsDto: BusinessDetailsDto) {
    return this.customerService.getBusinessDetails(businessDetailsDto, req.user.userId);
  }

  // display Customer (fullName and Email)
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get customer profile (full name and email)' })
  @ApiResponse({
    status: 200,
    description: 'Customer profile retrieved successfully',
  })
  async getCustomerProfile(@Request() req) {
    return this.customerService.getCustomerProfile(req.user.userId);
  }
}
