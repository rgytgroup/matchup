import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from '../common/events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Borrado automático de fotos de usuario a los 30 días (SPEC §8). Los reportes permanecen. */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledCleanup(): Promise<void> {
    const cleaned = await this.deleteOldPhotos(RETENTION_DAYS);
    this.logger.log(`Cron borrado ${RETENTION_DAYS}d: ${cleaned} órdenes limpiadas`);
  }

  /** Borra fotos de submissions más viejas que maxAgeDays. Devuelve cuántas limpió. */
  async deleteOldPhotos(maxAgeDays = RETENTION_DAYS): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * DAY_MS);
    const submissions = await this.prisma.submission.findMany({
      where: { createdAt: { lt: cutoff }, NOT: { photoUrls: { isEmpty: true } } },
      select: { orderId: true },
    });
    for (const s of submissions) await this.cleanOrder(s.orderId);
    return submissions.length;
  }

  /** Borra las fotos de UNA orden y limpia las referencias (el PDF del reporte permanece). */
  async cleanOrder(orderId: string): Promise<void> {
    try {
      await this.storage.deleteOrderPhotos(orderId);
      await this.prisma.submission.updateMany({ where: { orderId }, data: { photoUrls: [] } });
      await this.prisma.photoJob.updateMany({
        where: { orderId },
        data: { outputUrls: [], acceptedUrls: [] },
      });
      await this.events.record('photos.deleted_retention', { orderId });
    } catch (e) {
      this.logger.error(`Cleanup falló para ${orderId}: ${(e as Error).message}`);
    }
  }
}
