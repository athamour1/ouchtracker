import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export const EXPIRY_WARNING_DAYS = 30;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private prisma: PrismaService) {}

  async getExpiringItems(days = EXPIRY_WARNING_DAYS) {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + days);

    const items = await this.prisma.kitItem.findMany({
      where: { expirationDate: { not: null, lte: threshold } },
      include: {
        kit: {
          select: {
            id: true, name: true,
            assignees: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: { expirationDate: 'asc' },
    });

    return items.map((item) => ({
      ...item,
      isExpired: item.expirationDate! < now,
      isValid: item.expirationDate! >= now,
      daysUntilExpiry: Math.ceil(
        (item.expirationDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }

  async getSummary() {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + EXPIRY_WARNING_DAYS);

    const [totalKits, totalItems, expiredCount, expiringSoonCount, recentInspections] =
      await this.prisma.$transaction([
        this.prisma.kit.count({ where: { isActive: true } }),
        this.prisma.kitItem.count(),
        this.prisma.kitItem.count({ where: { expirationDate: { not: null, lt: now } } }),
        this.prisma.kitItem.count({ where: { expirationDate: { gte: now, lte: threshold } } }),
        this.prisma.inspectionLog.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            kit: { select: { id: true, name: true } },
            inspectedBy: { select: { id: true, fullName: true } },
          },
        }),
      ]);

    return { totalKits, totalItems, expiredCount, expiringSoonCount, recentInspections };
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async dailyExpiryCheck() {
    this.logger.log('Running daily expiry check...');
    const items = await this.getExpiringItems(EXPIRY_WARNING_DAYS);
    const expired = items.filter((i) => i.isExpired);
    const expiringSoon = items.filter((i) => !i.isExpired);

    this.logger.warn(
      `Expiry check: ${expired.length} expired, ${expiringSoon.length} expiring within ${EXPIRY_WARNING_DAYS} days.`,
    );
    expired.forEach((i) =>
      this.logger.warn(`  [EXPIRED] "${i.name}" in kit "${i.kit.name}"`)
    );
  }
}
