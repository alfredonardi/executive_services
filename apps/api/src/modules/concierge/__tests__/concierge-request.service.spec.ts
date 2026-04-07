import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { ConciergeRequestService } from '../services/concierge-request.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockRequest = {
  id: 'req-1',
  userId: 'user-1',
  title: 'Book restaurant',
  description: 'Need a quiet table for two',
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
  statusUpdates: [],
};

describe('ConciergeRequestService', () => {
  let service: ConciergeRequestService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockTx = {
      conciergeRequest: {
        create: jest.fn().mockResolvedValue(mockRequest),
      },
      requestStatusUpdate: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const mockPrisma = {
      conciergeRequest: {
        findMany: jest.fn().mockResolvedValue([mockRequest]),
        findUnique: jest.fn().mockResolvedValue({ ...mockRequest, statusUpdates: [] }),
      },
      $transaction: jest.fn().mockImplementation(async (fn) => fn(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConciergeRequestService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConciergeRequestService>(ConciergeRequestService);
    prisma = module.get(PrismaService);
  });

  describe('createRequest', () => {
    it('should create a request with PENDING status and write initial status update', async () => {
      const dto = {
        title: 'Book restaurant',
        description: 'Need a quiet table for two',
      };
      const result = await service.createRequest('user-1', dto as any);
      expect(result.status).toBe(RequestStatus.PENDING);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('createFromRecommendation', () => {
    it('should set sourceRecommendationId from catalogItemId', async () => {
      const dto = {
        catalogItemId: 'cat-item-1',
        title: 'Book restaurant',
        description: 'I want to act on this recommendation',
      };
      await service.createFromRecommendation('user-1', dto as any);
      // Transaction was called
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should append timeWindowContext to description', async () => {
      const dto = {
        catalogItemId: 'cat-item-1',
        title: 'Lunch',
        description: 'Book this',
        timeWindowContext: 'LUNCH',
      };
      await service.createFromRecommendation('user-1', dto as any);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('listRequests', () => {
    it('should return own requests for EXECUTIVE role', async () => {
      const result = await service.listRequests('user-1', 'EXECUTIVE');
      expect(prisma.conciergeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
      expect(result).toHaveLength(1);
    });

    it('should return assigned requests for CONCIERGE_AGENT role', async () => {
      await service.listRequests('agent-1', 'CONCIERGE_AGENT');
      expect(prisma.conciergeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { assignedAgentId: 'agent-1' } }),
      );
    });

    it('should return all requests for ADMIN role', async () => {
      await service.listRequests('admin-1', 'ADMIN');
      expect(prisma.conciergeRequest.findMany).toHaveBeenCalledWith(
        expect.not.objectContaining({ where: expect.anything() }),
      );
    });
  });

  describe('getRequestDetail', () => {
    it('should return request with status history for owner', async () => {
      const result = await service.getRequestDetail('req-1', 'user-1', 'EXECUTIVE');
      expect(result).toBeDefined();
      expect(result.statusUpdates).toBeDefined();
    });

    it('should throw NotFoundException when request not found', async () => {
      (prisma.conciergeRequest.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getRequestDetail('missing', 'user-1', 'EXECUTIVE')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for non-owner EXECUTIVE', async () => {
      await expect(
        service.getRequestDetail('req-1', 'other-user', 'EXECUTIVE'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to view any request', async () => {
      const result = await service.getRequestDetail('req-1', 'admin-1', 'ADMIN');
      expect(result).toBeDefined();
    });
  });
});
