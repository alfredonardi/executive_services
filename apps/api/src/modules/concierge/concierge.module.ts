import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';
import { CalendarModule } from '../calendar/calendar.module';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { ConciergeRequestService } from './services/concierge-request.service';
import { RequestWorkflowService } from './services/request-workflow.service';
import { HandoffService } from './services/handoff.service';
import { NotificationService } from './services/notification.service';
import { AiAssistantService } from './services/ai-assistant.service';
import { ContextAssemblyService } from './services/context-assembly.service';
import { ConversationController } from './controllers/conversation.controller';
import { ConciergeRequestController } from './controllers/concierge-request.controller';
import { NotificationController } from './controllers/notification.controller';
import { AdminConversationController } from './controllers/admin-conversation.controller';
import { AdminRequestController } from './controllers/admin-request.controller';

@Module({
  imports: [PrismaModule, AiModule, CalendarModule],
  controllers: [
    ConversationController,
    ConciergeRequestController,
    NotificationController,
    AdminConversationController,
    AdminRequestController,
  ],
  providers: [
    ConversationService,
    MessageService,
    ConciergeRequestService,
    RequestWorkflowService,
    HandoffService,
    NotificationService,
    AiAssistantService,
    ContextAssemblyService,
  ],
  exports: [NotificationService, ConversationService, ConciergeRequestService],
})
export class ConciergeModule {}
