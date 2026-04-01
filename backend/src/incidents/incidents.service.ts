import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { Role } from '@prisma/client';

const INCIDENT_INCLUDE = {
  kit: { select: { id: true, name: true } },
  reportedBy: { select: { id: true, fullName: true, email: true } },
  items: {
    include: {
      kitItem: { select: { id: true, name: true, category: true, unit: true } },
    },
  },
};

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  async submit(dto: CreateIncidentDto, reporter: { id: string; role: string }) {
    // Verify kit exists and reporter has access
    const kit = await this.prisma.kit.findUnique({
      where: { id: dto.kitId },
      include: { assignees: { select: { id: true } } },
    });
    if (!kit) throw new NotFoundException('Kit not found');
    if (
      reporter.role !== Role.ADMIN &&
      !kit.assignees.some((a) => a.id === reporter.id)
    ) {
      throw new ForbiddenException('You are not assigned to this kit');
    }

    // Deduct quantities in a transaction + create report
    return this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const kitItem = await tx.kitItem.findFirst({
          where: { id: item.kitItemId, kitId: dto.kitId },
        });
        if (!kitItem) throw new NotFoundException(`Kit item ${item.kitItemId} not found`);
        await tx.kitItem.update({
          where: { id: item.kitItemId },
          data: { quantity: Math.max(0, kitItem.quantity - item.quantityUsed) },
        });
      }

      return tx.incidentReport.create({
        data: {
          kitId: dto.kitId,
          reportedById: reporter.id,
          ...(dto.description && { description: dto.description }),
          items: {
            create: dto.items.map((i) => ({
              kitItemId: i.kitItemId,
              quantityUsed: i.quantityUsed,
              ...(i.notes && { notes: i.notes }),
            })),
          },
        },
        include: INCIDENT_INCLUDE,
      });
    });
  }

  findAll(kitId?: string) {
    return this.prisma.incidentReport.findMany({
      where: kitId ? { kitId } : undefined,
      include: INCIDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  findByUser(userId: string) {
    return this.prisma.incidentReport.findMany({
      where: { reportedById: userId },
      include: INCIDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.incidentReport.findUnique({
      where: { id },
      include: INCIDENT_INCLUDE,
    });
    if (!report) throw new NotFoundException('Incident report not found');
    return report;
  }
}
