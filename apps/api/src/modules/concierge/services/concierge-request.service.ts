import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConciergeRequest, RequestStatus, RequestStatusUpdate } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from './notification.service';
import {
  CreateConciergeRequestDto,
  CreateRequestFromRecommendationDto,
} from '../dto/concierge.dto';

@Injectable()
export class ConciergeRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async createRequest(
    userId: string,
    dto: CreateConciergeRequestDto,
  ): Promise<ConciergeRequest & { statusUpdates: RequestStatusUpdate[] }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.conciergeRequest.create({
        data: {
          userId,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          category: dto.category,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          conversationId: dto.conversationId,
          status: RequestStatus.PENDING,
        },
      });

      const statusUpdate = await tx.requestStatusUpdate.create({
        data: { requestId: request.id, status: RequestStatus.PENDING },
      });

      return { ...request, statusUpdates: [statusUpdate] };
    });

    await this.notificationService
      .notifyRequestCreated(userId, result.id, result.title)
      .catch(() => undefined);

    return result;
  }

  async createFromRecommendation(
    userId: string,
    dto: CreateRequestFromRecommendationDto,
  ): Promise<ConciergeRequest & { statusUpdates: RequestStatusUpdate[] }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const description = dto.timeWindowContext
        ? `${dto.description}\n\nTime window: ${dto.timeWindowContext}`
        : dto.description;

      const request = await tx.conciergeRequest.create({
        data: {
          userId,
          title: dto.title,
          description,
          priority: dto.priority,
          sourceRecommendationId: dto.catalogItemId,
          conversationId: dto.conversationId,
          status: RequestStatus.PENDING,
        },
      });

      const statusUpdate = await tx.requestStatusUpdate.create({
        data: { requestId: request.id, status: RequestStatus.PENDING },
      });

      return { ...request, statusUpdates: [statusUpdate] };
    });

    await this.notificationService
      .notifyRequestCreated(userId, result.id, result.title)
      .catch(() => undefined);

    return result;
  }

  async listRequests(
    userId: string,
    role: string,
  ): Promise<ConciergeRequest[]> {
    if (role === 'ADMIN') {
      return this.prisma.conciergeRequest.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === 'CONCIERGE_AGENT') {
      return this.prisma.conciergeRequest.findMany({
        where: { assignedAgentId: userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.conciergeRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequestDetail(
    requestId: string,
    userId: string,
    role: string,
  ): Promise<ConciergeRequest & { statusUpdates: RequestStatusUpdate[] }> {
    const request = await this.prisma.conciergeRequest.findUnique({
      where: { id: requestId },
      include: { statusUpdates: { orderBy: { createdAt: 'asc' } } },
    });

    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    const isOwner = request.userId === userId;
    const isAssignedAgent = request.assignedAgentId === userId;
    const isAdmin = role === 'ADMIN';

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    return request;
  }

  async findById(requestId: string): Promise<ConciergeRequest | null> {
    return this.prisma.conciergeRequest.findUnique({ where: { id: requestId } });
  }
}
