import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminConversationController } from '../controllers/admin-conversation.controller';

const ConversationStatus = {
  ACTIVE: 'ACTIVE' as const,
  HUMAN_HANDOFF: 'HUMAN_HANDOFF' as const,
  RESOLVED: 'RESOLVED' as const,
  ARCHIVED: 'ARCHIVED' as const,
};

const MessageRole = {
  USER: 'USER' as const,
  AI: 'AI' as const,
  AGENT: 'AGENT' as const,
};
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockAdmin = { id: 'admin-1', role: 'ADMIN' };
const mockAgent = { id: 'agent-1', role: 'CONCIERGE_AGENT' };
const mockOtherAgent = { id: 'agent-2', role: 'CONCIERGE_AGENT' };

const mockConversation = {
  id: 'conv-1',
  userId: 'user-1',
  status: ConversationStatus.HUMAN_HANDOFF,
  assignedAgentId: 'agent-1',
  title: 'Test',
  context: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { id: 'user-1', firstName: 'James', lastName: 'Richardson', company: 'GlobalCorp', title: 'COO', nationality: 'British', timezone: 'America/Sao_Paulo' },
  assignedAgent: { id: 'agent-1', firstName: 'Maria', lastName: 'Silva' },
  messages: [],
};

const mockMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  role: MessageRole.AGENT,
  content: 'How can I help?',
  agentId: 'agent-1',
  tokensUsed: null,
  metadata: null,
  createdAt: new Date(),
};

describe('AdminConversationController', () => {
  let controller: AdminConversationController;
  let prisma: jest.Mocked<PrismaService>;
  let conversationService: jest.Mocked<ConversationService>;
  let messageService: jest.Mocked<MessageService>;

  beforeEach(async () => {
    const mockPrisma = {
      conversation: {
        findMany: jest.fn().mockResolvedValue([mockConversation]),
        findUnique: jest.fn().mockResolvedValue(mockConversation),
      },
    };

    const mockConversationService = {
      assignAgent: jest.fn().mockResolvedValue(mockConversation),
    };

    const mockMessageService = {
      persistAgentMessage: jest.fn().mockResolvedValue(mockMessage),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminConversationController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConversationService, useValue: mockConversationService },
        { provide: MessageService, useValue: mockMessageService },
      ],
    }).compile();

    controller = module.get<AdminConversationController>(AdminConversationController);
    prisma = module.get(PrismaService);
    conversationService = module.get(ConversationService);
    messageService = module.get(MessageService);
  });

  // ── listConversations ─────────────────────────────────────────────────────

  describe('listConversations', () => {
    it('should allow ADMIN to list all conversations without restriction', async () => {
      await controller.listConversations(mockAdmin);
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should restrict CONCIERGE_AGENT to HUMAN_HANDOFF or assigned conversations', async () => {
      await controller.listConversations(mockAgent);
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { status: ConversationStatus.HUMAN_HANDOFF },
              { assignedAgentId: mockAgent.id },
            ],
          },
        }),
      );
    });

    it('should apply status filter for ADMIN', async () => {
      await controller.listConversations(mockAdmin, ConversationStatus.HUMAN_HANDOFF);
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: ConversationStatus.HUMAN_HANDOFF } }),
      );
    });
  });

  // ── getConversation ───────────────────────────────────────────────────────

  describe('getConversation', () => {
    it('should allow ADMIN to read any conversation', async () => {
      const result = await controller.getConversation(mockAdmin, 'conv-1');
      expect(result).toEqual(mockConversation);
    });

    it('should allow CONCIERGE_AGENT to read a HUMAN_HANDOFF conversation', async () => {
      const result = await controller.getConversation(mockAgent, 'conv-1');
      expect(result).toEqual(mockConversation);
    });

    it('should throw ForbiddenException when agent tries to read an ACTIVE conversation not assigned to them', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        ...mockConversation,
        status: ConversationStatus.ACTIVE,
        assignedAgentId: null,
      });
      await expect(controller.getConversation(mockOtherAgent, 'conv-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when conversation does not exist', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(controller.getConversation(mockAdmin, 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── sendAgentMessage ──────────────────────────────────────────────────────

  describe('sendAgentMessage', () => {
    it('should persist agent message and return it', async () => {
      const result = await controller.sendAgentMessage(mockAgent, 'conv-1', { content: 'Hello' });
      expect(messageService.persistAgentMessage).toHaveBeenCalledWith('conv-1', mockAgent.id, 'Hello');
      expect(result).toEqual(mockMessage);
    });

    it('should auto-assign agent if conversation has no assigned agent', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        ...mockConversation,
        assignedAgentId: null,
        select: undefined,
      });
      await controller.sendAgentMessage(mockAgent, 'conv-1', { content: 'Hello' });
      expect(conversationService.assignAgent).toHaveBeenCalledWith('conv-1', mockAgent.id);
    });

    it('should NOT re-assign when conversation already has an assigned agent', async () => {
      await controller.sendAgentMessage(mockAgent, 'conv-1', { content: 'Hello' });
      expect(conversationService.assignAgent).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when agent has no access', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        ...mockConversation,
        status: ConversationStatus.ACTIVE,
        assignedAgentId: 'some-other-agent',
        select: undefined,
      });
      await expect(
        controller.sendAgentMessage(mockOtherAgent, 'conv-1', { content: 'Hi' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow ADMIN to send agent message regardless of status', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        ...mockConversation,
        status: ConversationStatus.ACTIVE,
        assignedAgentId: null,
        select: undefined,
      });
      await expect(
        controller.sendAgentMessage(mockAdmin, 'conv-1', { content: 'Admin note' }),
      ).resolves.toEqual(mockMessage);
    });
  });
});
