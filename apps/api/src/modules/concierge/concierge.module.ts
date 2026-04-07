import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { ConciergeRequestService } from './services/concierge-request.service';
import { RequestWorkflowService } from './services/request-workflow.service';
import { HandoffService } from './services/handoff.service';
import { NotificationService } from './services/notification.service';
import { AiAssistantService } from './services/ai-assistant.service';
import { ConversationController } from './controllers/conversation.controller';
import { ConciergeRequestController } from './controllers/concierge-request.controller';
import { NotificationController } from './controllers/notification.controller';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [
    ConversationController,
    ConciergeRequestController,
    NotificationController,
  ],
  providers: [
    ConversationService,
    MessageService,
    ConciergeRequestService,
    RequestWorkflowService,
    HandoffService,
    NotificationService,
    AiAssistantService,
  ],
  exports: [NotificationService, ConversationService, ConciergeRequestService],
})
export class ConciergeModule {}
