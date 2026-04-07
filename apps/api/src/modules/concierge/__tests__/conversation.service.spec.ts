import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationService } from '../services/conversation.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockConversation = {
  id: 'conv-1',
  userId: 'user-1',
  status: 'ACTIVE',
  assignedAgentId: null,
  title: 'Test conversation',
  context: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
};

describe('ConversationService', () => {
  let service: ConversationService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      conversation: {
        create: jest.fn().mockResolvedValue(mockConversation),
        findMany: jest.fn().mockResolvedValue([mockConversation]),
        findUnique: jest.fn().mockResolvedValue({ ...mockConversation, messages: [] }),
        update: jest.fn().mockResolvedValue(mockConversation),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConversationService>(ConversationService);
    prisma = module.get(PrismaService);
  });

  describe('createConversation', () => {
    it('should create a conversation for the user', async () => {
      const result = await service.createConversation('user-1', 'Test');
      expect(result).toEqual(mockConversation);
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', title: 'Test' },
      });
    });
  });

  describe('listConversations', () => {
    it('should return only the user\'s conversations', async () => {
      const result = await service.listConversations('user-1');
      expect(result).toEqual([mockConversation]);
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });

  describe('getConversationDetail', () => {
    it('should return conversation with messages for owner', async () => {
      const result = await service.getConversationDetail('conv-1', 'user-1');
      expect(result).toBeDefined();
      expect(result.messages).toEqual([]);
    });

    it('should throw NotFoundException when conversation not found', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getConversationDetail('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when userId does not match', async () => {
      await expect(service.getConversationDetail('conv-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateStatus', () => {
    it('should update the conversation status', async () => {
      await service.updateStatus('conv-1', 'HUMAN_HANDOFF');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { status: 'HUMAN_HANDOFF' },
      });
    });
  });

  describe('assignAgent', () => {
    it('should assign an agent to the conversation', async () => {
      await service.assignAgent('conv-1', 'agent-1');
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { assignedAgentId: 'agent-1' },
      });
    });
  });
});
