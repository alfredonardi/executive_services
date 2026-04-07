import { Injectable, Logger } from '@nestjs/common';
import { PreferenceProfile } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpsertPreferenceProfileDto } from '../dto/recommendation.dto';

@Injectable()
export class PreferenceProfileService {
  private readonly logger = new Logger(PreferenceProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<PreferenceProfile | null> {
    return this.prisma.preferenceProfile.findUnique({ where: { userId } });
  }

  async upsertProfile(
    userId: string,
    data: UpsertPreferenceProfileDto,
  ): Promise<PreferenceProfile> {
    this.logger.log(`Upserting preference profile for user ${userId}`);
    return this.prisma.preferenceProfile.upsert({
      where: { userId },
      update: {
        foodPreferences: data.foodPreferences ?? [],
        dietaryConstraints: data.dietaryConstraints ?? [],
        atmospherePreferences: data.atmospherePreferences ?? [],
        preferredCategories: data.preferredCategories ?? [],
        dislikedCategories: data.dislikedCategories ?? [],
        preferredDurationMin: data.preferredDurationMin ?? 30,
        preferredDurationMax: data.preferredDurationMax ?? 90,
        mobilityTolerance: data.mobilityTolerance ?? 'moderate',
        preferredNeighborhoods: data.preferredNeighborhoods ?? [],
        pacing: data.pacing ?? 'efficient',
        wellnessInterest: data.wellnessInterest ?? false,
        businessTravelStyle: data.businessTravelStyle ?? 'premium',
        additionalNotes: data.additionalNotes ?? null,
      },
      create: {
        userId,
        foodPreferences: data.foodPreferences ?? [],
        dietaryConstraints: data.dietaryConstraints ?? [],
        atmospherePreferences: data.atmospherePreferences ?? [],
        preferredCategories: data.preferredCategories ?? [],
        dislikedCategories: data.dislikedCategories ?? [],
        preferredDurationMin: data.preferredDurationMin ?? 30,
        preferredDurationMax: data.preferredDurationMax ?? 90,
        mobilityTolerance: data.mobilityTolerance ?? 'moderate',
        preferredNeighborhoods: data.preferredNeighborhoods ?? [],
        pacing: data.pacing ?? 'efficient',
        wellnessInterest: data.wellnessInterest ?? false,
        businessTravelStyle: data.businessTravelStyle ?? 'premium',
        additionalNotes: data.additionalNotes ?? null,
      },
    });
  }

  async getOrCreateDefault(userId: string): Promise<PreferenceProfile> {
    const existing = await this.getProfile(userId);
    if (existing) return existing;

    this.logger.log(`Creating default preference profile for user ${userId}`);
    return this.prisma.preferenceProfile.create({
      data: {
        userId,
        foodPreferences: [],
        dietaryConstraints: [],
        atmospherePreferences: [],
        preferredCategories: [],
        dislikedCategories: [],
        preferredDurationMin: 30,
        preferredDurationMax: 90,
        mobilityTolerance: 'moderate',
        preferredNeighborhoods: [],
        pacing: 'efficient',
        wellnessInterest: false,
        businessTravelStyle: 'premium',
        additionalNotes: null,
      },
    });
  }
}
