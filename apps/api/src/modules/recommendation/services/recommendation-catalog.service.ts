import { Injectable, Logger } from '@nestjs/common';
import { Recommendation, RecommendationCategory } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CATALOG_SEED_DATA } from '../seed/catalog.seed';

@Injectable()
export class RecommendationCatalogService {
  private readonly logger = new Logger(RecommendationCatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCatalogItems(options?: {
    category?: RecommendationCategory;
    isActive?: boolean;
  }): Promise<Recommendation[]> {
    return this.prisma.recommendation.findMany({
      where: {
        ...(options?.category !== undefined && { category: options.category }),
        ...(options?.isActive !== undefined && { isActive: options.isActive }),
      },
      orderBy: [{ premiumScore: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getCatalogItemById(id: string): Promise<Recommendation | null> {
    return this.prisma.recommendation.findUnique({ where: { id } });
  }

  async seedDemoCatalog(): Promise<void> {
    const existing = await this.prisma.recommendation.count();
    if (existing > 0) {
      this.logger.log(`Catalog already has ${existing} entries — skipping seed`);
      return;
    }

    this.logger.log(`Seeding ${CATALOG_SEED_DATA.length} demo catalog entries`);
    for (const entry of CATALOG_SEED_DATA) {
      await this.prisma.recommendation.create({ data: entry });
    }
    this.logger.log('Demo catalog seed complete');
  }
}
