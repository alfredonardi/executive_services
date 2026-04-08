import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestPriority, RequestStatus, NotificationType, ConversationStatus, MessageRole } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

// ─── Conversation ─────────────────────────────────────────────────────────────

export class CreateConversationDto {
  @ApiPropertyOptional({ example: 'Lunch options for Thursday' })
  @IsOptional()
  @IsString()
  title?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'I need help finding a quiet restaurant for a business lunch.' })
  @IsString()
  @MinLength(1)
  content!: string;
}

export class HandoffDto {
  @ApiPropertyOptional({ example: 'I need a human agent to assist with a complex request.' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignAgentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  agentId!: string;
}

export class MessageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversationId!: string;

  @ApiProperty({ enum: MessageRole })
  role!: MessageRole;

  @ApiProperty()
  content!: string;

  @ApiPropertyOptional()
  agentId?: string | null;

  @ApiPropertyOptional()
  tokensUsed?: number | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ConversationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: ConversationStatus })
  status!: ConversationStatus;

  @ApiPropertyOptional()
  title?: string | null;

  @ApiPropertyOptional()
  assignedAgentId?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ConversationDetailDto extends ConversationResponseDto {
  @ApiProperty({ type: [MessageResponseDto] })
  messages!: MessageResponseDto[];
}

// ─── Concierge Requests ───────────────────────────────────────────────────────

export class CreateConciergeRequestDto {
  @ApiProperty({ example: 'Book dinner reservation for 4 people' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ example: 'Need a private room at a top restaurant Friday 8pm, business occasion.' })
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiPropertyOptional({ enum: RequestPriority, default: 'NORMAL' })
  @IsOptional()
  @IsEnum(RequestPriority)
  priority?: RequestPriority;

  @ApiPropertyOptional({ example: 'RESTAURANT' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '2026-04-10T20:00:00Z' })
  @IsOptional()
  @IsISO8601()
  dueAt?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class CreateRequestFromRecommendationDto {
  @ApiProperty({ example: 'catalog-item-uuid' })
  @IsString()
  catalogItemId!: string;

  @ApiProperty({ example: 'Book Executive Garden Bistro for lunch' })
  @IsString()
  @MinLength(3)
  title!: string;

  @ApiProperty({ example: 'I want to act on this restaurant recommendation for my Thursday lunch window.' })
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiPropertyOptional({ enum: RequestPriority, default: 'NORMAL' })
  @IsOptional()
  @IsEnum(RequestPriority)
  priority?: RequestPriority;

  @ApiPropertyOptional({ example: 'LUNCH' })
  @IsOptional()
  @IsString()
  timeWindowContext?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

export class UpdateRequestStatusDto {
  @ApiProperty({ enum: RequestStatus })
  @IsEnum(RequestStatus)
  status!: RequestStatus;

  @ApiPropertyOptional({ example: 'Reservation confirmed at restaurant.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RequestStatusUpdateDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  requestId!: string;

  @ApiProperty({ enum: RequestStatus })
  status!: RequestStatus;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiPropertyOptional()
  agentId?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ConciergeRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: RequestStatus })
  status!: RequestStatus;

  @ApiProperty({ enum: RequestPriority })
  priority!: RequestPriority;

  @ApiPropertyOptional()
  category?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiPropertyOptional()
  dueAt?: Date | null;

  @ApiPropertyOptional()
  completedAt?: Date | null;

  @ApiPropertyOptional()
  conversationId?: string | null;

  @ApiPropertyOptional()
  sourceRecommendationId?: string | null;

  @ApiPropertyOptional()
  assignedAgentId?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ConciergeRequestDetailDto extends ConciergeRequestResponseDto {
  @ApiProperty({ type: [RequestStatusUpdateDto] })
  statusUpdates!: RequestStatusUpdateDto[];
}

// ─── Notifications ────────────────────────────────────────────────────────────

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({ description: 'Return only unread notifications' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;
}

export class NotificationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional()
  data?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  readAt?: Date | null;

  @ApiProperty()
  createdAt!: Date;
}
