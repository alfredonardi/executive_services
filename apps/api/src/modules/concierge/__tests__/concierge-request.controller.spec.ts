import { Test, TestingModule } from '@nestjs/testing';
import { RequestStatus } from '@prisma/client';
import { ConciergeRequestController } from '../controllers/concierge-request.controller';
import { ConciergeRequestService } from '../services/concierge-request.service';
import { RequestWorkflowService } from '../services/request-workflow.service';

const mockUser = { id: 'user-1', role: 'EXECUTIVE' };
const mockAgentUser = { id: 'agent-1', role: 'CONCIERGE_AGENT' };
const mockAdminUser = { id: 'admin-1', role: 'ADMIN' };

const mockRequest = {
  id: 'req-1',
  userId: 'user-1',
  title: 'Book restaurant',
  description: 'Need a table for two',
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

describe('ConciergeRequestController', () => {
  let controller: ConciergeRequestController;
  let requestService: jest.Mocked<ConciergeRequestService>;
  let workflowService: jest.Mocked<RequestWorkflowService>;

  beforeEach(async () => {
    const mockRequestService = {
      createRequest: jest.fn().mockResolvedValue(mockRequest),
      createFromRecommendation: jest.fn().mockResolvedValue({ ...mockRequest, sourceRecommendationId: 'cat-1' }),
      listRequests: jest.fn().mockResolvedValue([mockRequest]),
      getRequestDetail: jest.fn().mockResolvedValue(mockRequest),
    };

    const mockWorkflowService = {
      updateStatus: jest.fn().mockResolvedValue({ ...mockRequest, status: RequestStatus.ACKNOWLEDGED }),
      assignAgent: jest.fn().mockResolvedValue({ ...mockRequest, assignedAgentId: 'agent-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConciergeRequestController],
      providers: [
        { provide: ConciergeRequestService, useValue: mockRequestService },
        { provide: RequestWorkflowService, useValue: mockWorkflowService },
      ],
    }).compile();

    controller = module.get<ConciergeRequestController>(ConciergeRequestController);
    requestService = module.get(ConciergeRequestService);
    workflowService = module.get(RequestWorkflowService);
  });

  describe('POST /concierge-requests', () => {
    it('should create a request from free text', async () => {
      const dto = { title: 'Book restaurant', description: 'Need a table for two' };
      const result = await controller.createRequest(mockUser, dto as any);
      expect(requestService.createRequest).toHaveBeenCalledWith('user-1', dto);
      expect(result.status).toBe(RequestStatus.PENDING);
    });
  });

  describe('POST /concierge-requests/from-recommendation', () => {
    it('should create a request from recommendation with catalogItemId', async () => {
      const dto = {
        catalogItemId: 'cat-1',
        title: 'Book restaurant',
        description: 'I want to act on this',
      };
      const result = await controller.createFromRecommendation(mockUser, dto as any);
      expect(requestService.createFromRecommendation).toHaveBeenCalledWith('user-1', dto);
      expect(result.sourceRecommendationId).toBe('cat-1');
    });
  });

  describe('GET /concierge-requests', () => {
    it('should list requests for current user (EXECUTIVE)', async () => {
      await controller.listRequests(mockUser);
      expect(requestService.listRequests).toHaveBeenCalledWith('user-1', 'EXECUTIVE');
    });

    it('should pass agent role to service', async () => {
      await controller.listRequests(mockAgentUser);
      expect(requestService.listRequests).toHaveBeenCalledWith('agent-1', 'CONCIERGE_AGENT');
    });

    it('should pass admin role to service', async () => {
      await controller.listRequests(mockAdminUser);
      expect(requestService.listRequests).toHaveBeenCalledWith('admin-1', 'ADMIN');
    });
  });

  describe('GET /concierge-requests/:id', () => {
    it('should return request detail with status history', async () => {
      const result = await controller.getRequestDetail(mockUser, 'req-1');
      expect(requestService.getRequestDetail).toHaveBeenCalledWith('req-1', 'user-1', 'EXECUTIVE');
      expect(result).toBeDefined();
    });
  });

  describe('PATCH /concierge-requests/:id/status', () => {
    it('should update request status', async () => {
      const dto = { status: RequestStatus.ACKNOWLEDGED, notes: 'Got it' };
      const result = await controller.updateStatus(mockAgentUser, 'req-1', dto);
      expect(workflowService.updateStatus).toHaveBeenCalledWith(
        'req-1',
        RequestStatus.ACKNOWLEDGED,
        'Got it',
        'agent-1',
      );
      expect(result.status).toBe(RequestStatus.ACKNOWLEDGED);
    });
  });

  describe('PATCH /concierge-requests/:id/assign', () => {
    it('should assign agent to request', async () => {
      const result = await controller.assignAgent('req-1', { agentId: 'agent-1' });
      expect(workflowService.assignAgent).toHaveBeenCalledWith('req-1', 'agent-1');
      expect(result.assignedAgentId).toBe('agent-1');
    });
  });
});
