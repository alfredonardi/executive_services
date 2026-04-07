import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { RequestWorkflowService } from '../services/request-workflow.service';
import { NotificationService } from '../services/notification.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockRequest = {
  id: 'req-1',
  userId: 'user-1',
  title: 'Book restaurant',
  description: 'desc',
  status: RequestStatus.PENDING,
  priority: 'NORMAL',
  category: null,
  assignedAgentId: null,
  notes: null,
  dueAt: null,
  completedAt: null,
  conversationId: null,
  sourceRecommendationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RequestWorkflowService', () => {
  let service: RequestWorkflowService;
  let prisma: jest.Mocked<PrismaService>;
  let notificationService: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    const updatedRequest = { ...mockRequest, status: RequestStatus.ACKNOWLEDGED };
    const mockPrisma = {
      conciergeRequest: {
        findUnique: jest.fn().mockResolvedValue(mockRequest),
        update: jest.fn().mockResolvedValue(updatedRequest),
      },
      requestStatusUpdate: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (ops: unknown[]) => {
          if (Array.isArray(ops)) return [updatedRequest, {}];
          return ops;
        }),
    };

    const mockNotificationService = {
      notifyRequestAcknowledged: jest.fn().mockResolvedValue(undefined),
      notifyRequestStatusChanged: jest.fn().mockResolvedValue(undefined),
      notifyAgentAssigned: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestWorkflowService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<RequestWorkflowService>(RequestWorkflowService);
    prisma = module.get(PrismaService);
    notificationService = module.get(NotificationService);
  });

  describe('updateStatus', () => {
    it('should update status and create a RequestStatusUpdate entry', async () => {
      await service.updateStatus('req-1', RequestStatus.ACKNOWLEDGED);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should call notifyRequestAcknowledged for ACKNOWLEDGED status', async () => {
      await service.updateStatus('req-1', RequestStatus.ACKNOWLEDGED);
      expect(notificationService.notifyRequestAcknowledged).toHaveBeenCalledWith(
        'user-1',
        'req-1',
        'Book restaurant',
      );
    });

    it('should call notifyRequestStatusChanged for other statuses', async () => {
      await service.updateStatus('req-1', RequestStatus.IN_PROGRESS);
      expect(notificationService.notifyRequestStatusChanged).toHaveBeenCalledWith(
        'user-1',
        'req-1',
        RequestStatus.IN_PROGRESS,
        'Book restaurant',
      );
    });

    it('should throw NotFoundException when request not found', async () => {
      (prisma.conciergeRequest.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.updateStatus('missing', RequestStatus.IN_PROGRESS)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assignAgent', () => {
    it('should assign agent and create status update note', async () => {
      await service.assignAgent('req-1', 'agent-1');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should call notifyAgentAssigned', async () => {
      await service.assignAgent('req-1', 'agent-1');
      expect(notificationService.notifyAgentAssigned).toHaveBeenCalledWith(
        'user-1',
        'req-1',
        'Book restaurant',
      );
    });

    it('should throw NotFoundException when request not found', async () => {
      (prisma.conciergeRequest.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.assignAgent('missing', 'agent-1')).rejects.toThrow(NotFoundException);
    });
  });
});
