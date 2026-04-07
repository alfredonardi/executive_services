import { Test, TestingModule } from '@nestjs/testing';
import { ConversationController } from '../controllers/conversation.controller';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';
import { AiAssistantService } from '../services/ai-assistant.service';
import { HandoffService } from '../services/handoff.service';

const mockUser = { id: 'user-1', role: 'EXECUTIVE' };

const mockConversation = {
  id: 'conv-1',
  userId: 'user-1',
  status: 'ACTIVE',
  title: null,
  assignedAgentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  messages: [],
};

const mockMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  role: 'USER',
  content: 'hello',
  agentId: null,
  tokensUsed: null,
  createdAt: new Date(),
};

const mockAiMessage = { ...mockMessage, id: 'msg-2', role: 'AI', content: 'AI reply' };

describe('ConversationController', () => {
  let controller: ConversationController;
  let conversationService: jest.Mocked<ConversationService>;
  let messageService: jest.Mocked<MessageService>;
  let aiAssistantService: jest.Mocked<AiAssistantService>;
  let handoffService: jest.Mocked<HandoffService>;

  beforeEach(async () => {
    const mockConversationService = {
      createConversation: jest.fn().mockResolvedValue(mockConversation),
      listConversations: jest.fn().mockResolvedValue([mockConversation]),
      getConversationDetail: jest.fn().mockResolvedValue({ ...mockConversation, messages: [] }),
      assignAgent: jest.fn().mockResolvedValue({ ...mockConversation, assignedAgentId: 'agent-1' }),
    };

    const mockMessageService = {
      sendUserMessage: jest.fn().mockResolvedValue(mockMessage),
      getMessages: jest.fn().mockResolvedValue([mockMessage]),
    };

    const mockAiAssistantService = {
      generateReply: jest.fn().mockResolvedValue({ message: mockAiMessage, shouldSuggestHandoff: false }),
    };

    const mockHandoffService = {
      initiateHandoff: jest.fn().mockResolvedValue({ ...mockConversation, status: 'HUMAN_HANDOFF' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationController],
      providers: [
        { provide: ConversationService, useValue: mockConversationService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: AiAssistantService, useValue: mockAiAssistantService },
        { provide: HandoffService, useValue: mockHandoffService },
      ],
    }).compile();

    controller = module.get<ConversationController>(ConversationController);
    conversationService = module.get(ConversationService);
    messageService = module.get(MessageService);
    aiAssistantService = module.get(AiAssistantService);
    handoffService = module.get(HandoffService);
  });

  describe('POST /conversations', () => {
    it('should create a conversation', async () => {
      const result = await controller.createConversation(mockUser, { title: 'Test' });
      expect(conversationService.createConversation).toHaveBeenCalledWith('user-1', 'Test');
      expect(result).toEqual(mockConversation);
    });
  });

  describe('GET /conversations', () => {
    it('should list conversations for the user', async () => {
      const result = await controller.listConversations(mockUser);
      expect(conversationService.listConversations).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockConversation]);
    });
  });

  describe('GET /conversations/:id', () => {
    it('should return conversation detail', async () => {
      const result = await controller.getConversationDetail(mockUser, 'conv-1');
      expect(conversationService.getConversationDetail).toHaveBeenCalledWith('conv-1', 'user-1');
      expect(result).toBeDefined();
    });
  });

  describe('POST /conversations/:id/messages', () => {
    it('should persist user message and return AI reply', async () => {
      const result = await controller.sendMessage(mockUser, 'conv-1', { content: 'hello' });
      expect(messageService.sendUserMessage).toHaveBeenCalledWith('conv-1', 'hello');
      expect(aiAssistantService.generateReply).toHaveBeenCalled();
      expect(result.userMessage).toEqual(mockMessage);
      expect(result.aiReply).toEqual(mockAiMessage);
      expect(result.shouldSuggestHandoff).toBe(false);
    });
  });

  describe('POST /conversations/:id/handoff', () => {
    it('should initiate handoff via handoffService', async () => {
      const result = await controller.initiateHandoff(mockUser, 'conv-1', { reason: 'complex' });
      expect(handoffService.initiateHandoff).toHaveBeenCalledWith('conv-1', 'user-1', 'complex');
      expect(result.status).toBe('HUMAN_HANDOFF');
    });
  });

  describe('POST /conversations/:id/assign', () => {
    it('should assign agent to conversation', async () => {
      const result = await controller.assignAgent('conv-1', { agentId: 'agent-1' });
      expect(conversationService.assignAgent).toHaveBeenCalledWith('conv-1', 'agent-1');
      expect(result.assignedAgentId).toBe('agent-1');
    });
  });
});
