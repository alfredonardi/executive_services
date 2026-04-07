import { Injectable, Logger } from '@nestjs/common';
import { Message, MessageRole } from '@prisma/client';
import { AiService } from '../../ai/ai.service';
import { ChatMessage } from '../../ai/interfaces/ai-provider.interface';
import { MessageService } from './message.service';

const CONCIERGE_SYSTEM_PROMPT =
  'You are a professional executive concierge assistant serving high-profile clients in São Paulo. ' +
  'Respond with discretion, clarity, and brevity. ' +
  'If the request is complex, urgent, or clearly requires human attention, include [SUGGEST_HANDOFF] at the very end. ' +
  'Never create requests, trigger handoffs, or change any system state directly.';

const INTENT_CLASSIFICATION_PROMPT =
  'Classify the intent of the user message. ' +
  'Respond with JSON only, no other text: {"intent":"request"|"query"|"unclear","confidence":0.0-1.0}. ' +
  '"request" = user wants a task done or a service performed. ' +
  '"query" = user wants information or a recommendation. ' +
  '"unclear" = cannot determine intent.';

const MAX_CONTEXT_MESSAGES = 10;

@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly messageService: MessageService,
  ) {}

  async generateReply(
    conversationId: string,
    userId: string,
    recentMessages: { role: string; content: string }[],
    userMessage: string,
  ): Promise<{ message: Message; shouldSuggestHandoff: boolean }> {
    const history = recentMessages.slice(-MAX_CONTEXT_MESSAGES);

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: CONCIERGE_SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: this.mapRole(m.role),
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const aiResponse = await this.aiService.chat(chatMessages, {
      userId,
      purpose: 'concierge_chat',
    });

    const shouldSuggestHandoff = aiResponse.content.includes('[SUGGEST_HANDOFF]');
    const cleanContent = aiResponse.content.replace(/\[SUGGEST_HANDOFF\]/g, '').trim();

    const message = await this.messageService.persistAiMessage(
      conversationId,
      cleanContent,
      aiResponse.outputTokens,
    );

    return { message, shouldSuggestHandoff };
  }

  async classifyIntent(
    userMessage: string,
  ): Promise<{ intent: 'request' | 'query' | 'unclear'; confidence: number }> {
    const response = await this.aiService.chat(
      [
        { role: 'system', content: INTENT_CLASSIFICATION_PROMPT },
        { role: 'user', content: userMessage },
      ],
      { purpose: 'intent_classification' },
    );

    try {
      const parsed = JSON.parse(response.content) as {
        intent: 'request' | 'query' | 'unclear';
        confidence: number;
      };
      return { intent: parsed.intent, confidence: parsed.confidence };
    } catch (error) {
      this.logger.warn('Intent classification JSON parse failed', error);
      return { intent: 'unclear', confidence: 0 };
    }
  }

  private mapRole(role: string): 'user' | 'assistant' {
    if (role === MessageRole.USER || role === 'user') return 'user';
    return 'assistant';
  }
}
