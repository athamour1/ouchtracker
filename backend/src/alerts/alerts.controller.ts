import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  /**
   * GET /api/alerts/expiring?days=30
   * Returns items expiring within `days` days (default 30), including already expired.
   */
  @Get('expiring')
  getExpiring(@Query('days') days?: string) {
    return this.alertsService.getExpiringItems(days ? parseInt(days, 10) : undefined);
  }

  /**
   * GET /api/alerts/summary
   * Admin dashboard summary: total kits, counts, recent inspections.
   */
  @Get('summary')
  getSummary() {
    return this.alertsService.getSummary();
  }
}
