import { Test, TestingModule } from '@nestjs/testing';
import { MessageRole } from '@prisma/client';
import { MessageService } from '../services/message.service';
import { PrismaService } from '../../../prisma/prisma.service';

const makeMsg = (role: MessageRole) => ({
  id: 'msg-1',
  conversationId: 'conv-1',
  role,
  content: 'hello',
  agentId: null,
  tokensUsed: null,
  metadata: null,
  createdAt: new Date(),
});

describe('MessageService', () => {
  let service: MessageService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      message: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    prisma = module.get(PrismaService);
  });

  describe('sendUserMessage', () => {
    it('should create a USER message', async () => {
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMsg(MessageRole.USER));
      const result = await service.sendUserMessage('conv-1', 'hello');
      expect(result.role).toBe(MessageRole.USER);
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv-1', role: MessageRole.USER, content: 'hello' },
      });
    });
  });

  describe('persistAiMessage', () => {
    it('should create an AI message with tokensUsed', async () => {
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMsg(MessageRole.AI));
      const result = await service.persistAiMessage('conv-1', 'AI reply', 42);
      expect(result.role).toBe(MessageRole.AI);
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv-1', role: MessageRole.AI, content: 'AI reply', tokensUsed: 42 },
      });
    });
  });

  describe('persistAgentMessage', () => {
    it('should create an AGENT message with agentId', async () => {
      (prisma.message.create as jest.Mock).mockResolvedValue(makeMsg(MessageRole.AGENT));
      const result = await service.persistAgentMessage('conv-1', 'agent-1', 'Agent reply');
      expect(result.role).toBe(MessageRole.AGENT);
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: { conversationId: 'conv-1', role: MessageRole.AGENT, content: 'Agent reply', agentId: 'agent-1' },
      });
    });
  });

  describe('getMessages', () => {
    it('should return all messages for a conversation', async () => {
      (prisma.message.findMany as jest.Mock).mockResolvedValue([makeMsg(MessageRole.USER)]);
      const result = await service.getMessages('conv-1');
      expect(result).toHaveLength(1);
      expect(prisma.message.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'conv-1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});
