import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { NotificationService } from '../services/notification.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockNotification = {
  id: 'notif-1',
  userId: 'user-1',
  type: NotificationType.REQUEST_UPDATE,
  title: 'Test',
  body: 'Body',
  data: null,
  readAt: null,
  sentAt: null,
  createdAt: new Date(),
};

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      notification: {
        create: jest.fn().mockResolvedValue(mockNotification),
        findMany: jest.fn().mockResolvedValue([mockNotification]),
        findUnique: jest.fn().mockResolvedValue(mockNotification),
        update: jest.fn().mockResolvedValue({ ...mockNotification, readAt: new Date() }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    prisma = module.get(PrismaService);
  });

  describe('createNotification', () => {
    it('should persist notification with correct data', async () => {
      const result = await service.createNotification(
        'user-1',
        NotificationType.REQUEST_UPDATE,
        'Title',
        'Body',
        { requestId: 'req-1' },
      );
      expect(result).toEqual(mockNotification);
      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });

  describe('listNotifications', () => {
    it('should return all notifications for user', async () => {
      const result = await service.listNotifications('user-1');
      expect(result).toHaveLength(1);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });

    it('should filter unread when unreadOnly=true', async () => {
      await service.listNotifications('user-1', true);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', readAt: null } }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should set readAt on the notification', async () => {
      const result = await service.markAsRead('notif-1', 'user-1');
      expect(result.readAt).toBeDefined();
    });

    it('should throw NotFoundException for wrong user', async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue({
        ...mockNotification,
        userId: 'other-user',
      });
      await expect(service.markAsRead('notif-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when not found', async () => {
      (prisma.notification.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.markAsRead('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it('should update all unread notifications for user', async () => {
      await service.markAllAsRead('user-1');
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });
});
