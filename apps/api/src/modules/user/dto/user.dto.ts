import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

const COMMUNICATION_STYLE = {
  BRIEF: 'BRIEF',
  DETAILED: 'DETAILED',
} as const;

export class UserAccountPreferencesDto {
  @ApiProperty({ type: [String] })
  languages!: string[];

  @ApiProperty({ enum: COMMUNICATION_STYLE })
  communicationStyle!: 'BRIEF' | 'DETAILED';

  @ApiProperty()
  notificationsEnabled!: boolean;
}

export class UserProfileResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiPropertyOptional()
  company?: string | null;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiProperty()
  timezone!: string;

  @ApiPropertyOptional()
  avatarUrl?: string | null;

  @ApiProperty({ type: UserAccountPreferencesDto })
  preferences!: UserAccountPreferencesDto;
}

export class UpdateUserProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ enum: COMMUNICATION_STYLE })
  @IsOptional()
  @IsEnum(COMMUNICATION_STYLE)
  communicationStyle?: 'BRIEF' | 'DETAILED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}
