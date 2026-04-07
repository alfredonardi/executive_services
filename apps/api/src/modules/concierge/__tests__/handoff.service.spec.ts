import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { HandoffService } from '../services/handoff.service';
import { ConversationService } from '../services/conversation.service';
import { MessageService } from '../services/message.service';
import { NotificationService } from '../services/notification.service';
import { PrismaService } from '../../../prisma/prisma.service';

const mockConversation = {
  id: 'conv-1',
  userId: 'user-1',
  status: 'ACTIVE' as const,
  assignedAgentId: null,
  title: null,
  context: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('HandoffService', () => {
  let service: HandoffService;
  let conversationService: jest.Mocked<ConversationService>;
  let messageService: jest.Mocked<MessageService>;
  let notificationService: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    const mockConversationService = {
      findById: jest.fn().mockResolvedValue(mockConversation),
      updateStatus: jest.fn().mockResolvedValue({ ...mockConversation, status: 'HUMAN_HANDOFF' }),
    };

    const mockMessageService = {
      persistAgentMessage: jest.fn().mockResolvedValue({}),
    };

    const mockNotificationService = {
      notifyHandoffInitiated: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoffService,
        { provide: PrismaService, useValue: {} },
        { provide: ConversationService, useValue: mockConversationService },
        { provide: MessageService, useValue: mockMessageService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<HandoffService>(HandoffService);
    conversationService = module.get(ConversationService);
    messageService = module.get(MessageService);
    notificationService = module.get(NotificationService);
  });

  describe('initiateHandoff', () => {
    it('should set conversation status to HUMAN_HANDOFF', async () => {
      const result = await service.initiateHandoff('conv-1', 'user-1');
      expect(conversationService.updateStatus).toHaveBeenCalledWith('conv-1', 'HUMAN_HANDOFF');
      expect(result.status).toBe('HUMAN_HANDOFF');
    });

    it('should persist an agent message preserving conversation history', async () => {
      await service.initiateHandoff('conv-1', 'user-1');
      expect(messageService.persistAgentMessage).toHaveBeenCalledWith(
        'conv-1',
        'user-1',
        expect.stringContaining('transferred'),
      );
    });

    it('should include handoff reason in agent message when provided', async () => {
      await service.initiateHandoff('conv-1', 'user-1', 'Complex booking needed');
      expect(messageService.persistAgentMessage).toHaveBeenCalledWith(
        'conv-1',
        'user-1',
        expect.stringContaining('Complex booking needed'),
      );
    });

    it('should call notifyHandoffInitiated', async () => {
      await service.initiateHandoff('conv-1', 'user-1');
      expect(notificationService.notifyHandoffInitiated).toHaveBeenCalledWith('user-1', 'conv-1');
    });

    it('should throw NotFoundException when conversation not found', async () => {
      conversationService.findById.mockResolvedValue(null);
      await expect(service.initiateHandoff('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when userId does not match', async () => {
      await expect(service.initiateHandoff('conv-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should NOT destroy existing message history', async () => {
      await service.initiateHandoff('conv-1', 'user-1');
      // persistAgentMessage adds a new message, does not delete existing ones
      expect(messageService.persistAgentMessage).toHaveBeenCalledTimes(1);
      // No delete calls
    });
  });
});
