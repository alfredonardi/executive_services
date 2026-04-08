import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserProfileDto, UserProfileResponseDto } from './dto/user.dto';

type UserWithPreferences = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'EXECUTIVE' | 'CONCIERGE_AGENT' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  company: string | null;
  title: string | null;
  timezone: string;
  avatarUrl: string | null;
  preferences: Prisma.JsonValue;
};

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        company: true,
        title: true,
        timezone: true,
        avatarUrl: true,
        preferences: true,
      },
    });

    return this.mapUser(user);
  }

  async updateProfile(userId: string, dto: UpdateUserProfileDto): Promise<UserProfileResponseDto> {
    const existing = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        preferences: true,
      },
    });

    const currentPreferences = this.normalizePreferences(existing.preferences);
    const preferences = {
      ...currentPreferences,
      ...(dto.languages !== undefined ? { languages: dto.languages } : {}),
      ...(dto.communicationStyle !== undefined
        ? { communicationStyle: dto.communicationStyle }
        : {}),
      ...(dto.notificationsEnabled !== undefined
        ? { notificationsEnabled: dto.notificationsEnabled }
        : {}),
    };

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.company !== undefined ? { company: dto.company } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        preferences: preferences as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        company: true,
        title: true,
        timezone: true,
        avatarUrl: true,
        preferences: true,
      },
    });

    return this.mapUser(user);
  }

  private mapUser(user: UserWithPreferences): UserProfileResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      company: user.company,
      title: user.title,
      timezone: user.timezone,
      avatarUrl: user.avatarUrl,
      preferences: this.normalizePreferences(user.preferences),
    };
  }

  private normalizePreferences(raw: Prisma.JsonValue): UserProfileResponseDto['preferences'] {
    const record =
      raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

    return {
      languages: Array.isArray(record['languages'])
        ? record['languages'].filter((value): value is string => typeof value === 'string')
        : [],
      communicationStyle:
        record['communicationStyle'] === 'DETAILED' ? 'DETAILED' : 'BRIEF',
      notificationsEnabled:
        typeof record['notificationsEnabled'] === 'boolean'
          ? record['notificationsEnabled']
          : true,
    };
  }
}
