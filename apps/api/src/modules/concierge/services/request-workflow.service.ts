import { Injectable, NotFoundException } from '@nestjs/common';
import { ConciergeRequest, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from './notification.service';

@Injectable()
export class RequestWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async updateStatus(
    requestId: string,
    newStatus: RequestStatus,
    notes?: string,
    agentId?: string,
  ): Promise<ConciergeRequest> {
    const request = await this.prisma.conciergeRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    const completedAt =
      newStatus === RequestStatus.COMPLETED ? new Date() : request.completedAt;

    const [updated] = await this.prisma.$transaction([
      this.prisma.conciergeRequest.update({
        where: { id: requestId },
        data: { status: newStatus, completedAt },
      }),
      this.prisma.requestStatusUpdate.create({
        data: { requestId, status: newStatus, notes, agentId },
      }),
    ]);

    // Trigger notifications
    if (newStatus === RequestStatus.ACKNOWLEDGED) {
      await this.notificationService
        .notifyRequestAcknowledged(request.userId, requestId, request.title)
        .catch(() => undefined);
    } else {
      await this.notificationService
        .notifyRequestStatusChanged(request.userId, requestId, newStatus, request.title)
        .catch(() => undefined);
    }

    return updated;
  }

  async assignAgent(
    requestId: string,
    agentId: string,
  ): Promise<ConciergeRequest> {
    const request = await this.prisma.conciergeRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw new NotFoundException(`Request ${requestId} not found`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.conciergeRequest.update({
        where: { id: requestId },
        data: { assignedAgentId: agentId },
      }),
      this.prisma.requestStatusUpdate.create({
        data: {
          requestId,
          status: request.status,
          notes: `Agent assigned`,
          agentId,
        },
      }),
    ]);

    await this.notificationService
      .notifyAgentAssigned(request.userId, requestId, request.title)
      .catch(() => undefined);

    return updated;
  }
}
