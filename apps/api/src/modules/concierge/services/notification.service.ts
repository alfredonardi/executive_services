import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Notification } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<Notification> {
    return this.prisma.notification.create({
      data: { userId, type, title, body, data: data as never },
    });
  }

  async listNotifications(userId: string, unreadOnly?: boolean): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    if (notification.userId !== userId) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async notifyRequestCreated(userId: string, requestId: string, title: string): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.REQUEST_UPDATE,
      'Request received',
      `Your request "${title}" has been submitted and will be acknowledged by your concierge team shortly.`,
      { requestId },
    );
  }

  async notifyRequestAcknowledged(userId: string, requestId: string, title: string): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.REQUEST_UPDATE,
      'Request acknowledged',
      `Your request "${title}" has been acknowledged by our concierge team.`,
      { requestId },
    );
  }

  async notifyRequestStatusChanged(
    userId: string,
    requestId: string,
    newStatus: string,
    title: string,
  ): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.REQUEST_UPDATE,
      'Request updated',
      `Your request "${title}" status changed to ${newStatus.toLowerCase().replace('_', ' ')}.`,
      { requestId, newStatus },
    );
  }

  async notifyHandoffInitiated(userId: string, conversationId: string): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.MESSAGE,
      'Transferred to human concierge',
      'Your conversation has been transferred to a human concierge agent who will assist you shortly.',
      { conversationId },
    );
  }

  async notifyAgentAssigned(userId: string, requestId: string, title: string): Promise<void> {
    await this.createNotification(
      userId,
      NotificationType.REQUEST_UPDATE,
      'Agent assigned',
      `A concierge agent has been assigned to your request "${title}".`,
      { requestId },
    );
  }
}
