import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private incidentsService: IncidentsService) {}

  /** Any authenticated user can submit (service enforces kit assignment). */
  @Post()
  submit(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.incidentsService.submit(dto, user);
  }

  /** Admin: all reports (optionally filtered by kit); Checker: their own. */
  @Get()
  findAll(
    @Query('kitId') kitId: string | undefined,
    @CurrentUser() user: { id: string; role: string },
  ) {
    if (user.role === Role.ADMIN) return this.incidentsService.findAll(kitId);
    return this.incidentsService.findByUser(user.id);
  }

  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }
}
