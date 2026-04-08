import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminRequestController } from '../controllers/admin-request.controller';
import { ConciergeRequestService } from '../services/concierge-request.service';
import { RequestWorkflowService } from '../services/request-workflow.service';
import { PrismaService } from '../../../prisma/prisma.service';

const RequestStatus = {
  PENDING: 'PENDING' as const,
  ACKNOWLEDGED: 'ACKNOWLEDGED' as const,
  IN_PROGRESS: 'IN_PROGRESS' as const,
  COMPLETED: 'COMPLETED' as const,
  CANCELLED: 'CANCELLED' as const,
};

const mockAdmin = { id: 'admin-1', role: 'ADMIN' };
const mockAgent = { id: 'agent-1', role: 'CONCIERGE_AGENT' };
const mockOtherAgent = { id: 'agent-2', role: 'CONCIERGE_AGENT' };

const mockOpenRequest = {
  id: 'req-1',
  userId: 'user-1',
  title: 'Book table at Maní',
  description: 'Need a reservation for 2 tonight',
  status: RequestStatus.PENDING,
  priority: 'HIGH',
  category: 'RESTAURANT',
  assignedAgentId: null,
  notes: null,
  dueAt: null,
  completedAt: null,
  conversationId: null,
  sourceRecommendationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 'user-1', firstName: 'James', lastName: 'Richardson', company: 'GlobalCorp', nationality: 'British' },
  assignedAgent: null,
  _count: { statusUpdates: 1 },
};

const mockAssignedRequest = {
  ...mockOpenRequest,
  id: 'req-2',
  status: RequestStatus.COMPLETED,
  assignedAgentId: 'agent-1',
};

const mockUpdatedRequest = {
  ...mockOpenRequest,
  status: RequestStatus.ACKNOWLEDGED,
};

describe('AdminRequestController', () => {
  let controller: AdminRequestController;
  let prisma: jest.Mocked<PrismaService>;
  let workflowService: jest.Mocked<RequestWorkflowService>;

  beforeEach(async () => {
    const mockPrisma = {
      conciergeRequest: {
        findMany: jest.fn().mockResolvedValue([mockOpenRequest, mockAssignedRequest]),
        findUnique: jest.fn().mockResolvedValue({
          ...mockOpenRequest,
          statusUpdates: [],
          conversation: null,
        }),
      },
    };

    const mockWorkflowService = {
      updateStatus: jest.fn().mockResolvedValue(mockUpdatedRequest),
      assignAgent: jest.fn().mockResolvedValue({ ...mockOpenRequest, assignedAgentId: 'agent-1' }),
    };

    const mockRequestService = {
      findById: jest.fn().mockResolvedValue(mockOpenRequest),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminRequestController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RequestWorkflowService, useValue: mockWorkflowService },
        { provide: ConciergeRequestService, useValue: mockRequestService },
      ],
    }).compile();

    controller = module.get<AdminRequestController>(AdminRequestController);
    prisma = module.get(PrismaService);
    workflowService = module.get(RequestWorkflowService);
  });

  // ── listRequests ──────────────────────────────────────────────────────────

  describe('listRequests', () => {
    it('should allow ADMIN to query all requests without restriction', async () => {
      await controller.listRequests(mockAdmin);
      expect(prisma.conciergeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should restrict CONCIERGE_AGENT to open queue + assigned requests', async () => {
      await controller.listRequests(mockAgent);
      expect(prisma.conciergeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { status: { in: ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
              { assignedAgentId: mockAgent.id },
            ],
          },
        }),
      );
    });

    it('should apply status filter for ADMIN', async () => {
      await controller.listRequests(mockAdmin, RequestStatus.PENDING);
      expect(prisma.conciergeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: RequestStatus.PENDING } }),
      );
    });

    it('should include user and assignedAgent relations', async () => {
      await controller.listRequests(mockAdmin);
      expect(prisma.conciergeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            user: expect.any(Object),
            assignedAgent: expect.any(Object),
          }),
        }),
      );
    });
  });

  // ── getRequest ────────────────────────────────────────────────────────────

  describe('getRequest', () => {
    it('should allow ADMIN to read any request', async () => {
      const result = await controller.getRequest(mockAdmin, 'req-1');
      expect(result).toBeDefined();
    });

    it('should allow CONCIERGE_AGENT to read a PENDING request (open queue)', async () => {
      const result = await controller.getRequest(mockAgent, 'req-1');
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException when agent tries to read a COMPLETED request not assigned to them', async () => {
      (prisma.conciergeRequest.findUnique as jest.Mock).mockResolvedValue({
        ...mockOpenRequest,
        status: RequestStatus.COMPLETED,
        assignedAgentId: 'some-other-agent',
        statusUpdates: [],
        conversation: null,
      });
      await expect(controller.getRequest(mockOtherAgent, 'req-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when request does not exist', async () => {
      (prisma.conciergeRequest.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(controller.getRequest(mockAdmin, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should call workflowService.updateStatus with correct args', async () => {
      await controller.updateStatus(mockAgent, 'req-1', {
        status: RequestStatus.ACKNOWLEDGED,
        notes: 'On it',
      });
      expect(workflowService.updateStatus).toHaveBeenCalledWith(
        'req-1',
        RequestStatus.ACKNOWLEDGED,
        'On it',
        mockAgent.id,
      );
    });

    it('should throw ForbiddenException when agent tries to update a COMPLETED non-assigned request', async () => {
      (prisma.conciergeRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.COMPLETED,
        assignedAgentId: 'someone-else',
      });
      await expect(
        controller.updateStatus(mockOtherAgent, 'req-1', { status: RequestStatus.CANCELLED }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to update any request', async () => {
      (prisma.conciergeRequest.findUnique as jest.Mock).mockResolvedValue({
        id: 'req-1',
        status: RequestStatus.COMPLETED,
        assignedAgentId: null,
      });
      await expect(
        controller.updateStatus(mockAdmin, 'req-1', { status: RequestStatus.CANCELLED }),
      ).resolves.toBeDefined();
    });
  });

  // ── assignAgent ───────────────────────────────────────────────────────────

  describe('assignAgent', () => {
    it('should allow ADMIN to assign any agent', async () => {
      await controller.assignAgent(mockAdmin, 'req-1', { agentId: 'agent-2' });
      expect(workflowService.assignAgent).toHaveBeenCalledWith('req-1', 'agent-2');
    });

    it('should allow CONCIERGE_AGENT to self-assign', async () => {
      await controller.assignAgent(mockAgent, 'req-1', { agentId: mockAgent.id });
      expect(workflowService.assignAgent).toHaveBeenCalledWith('req-1', mockAgent.id);
    });

    it('should throw ForbiddenException when CONCIERGE_AGENT tries to assign another agent', async () => {
      await expect(
        controller.assignAgent(mockAgent, 'req-1', { agentId: 'agent-99' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when request does not exist', async () => {
      (prisma.conciergeRequest.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        controller.assignAgent(mockAdmin, 'missing', { agentId: 'agent-1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
