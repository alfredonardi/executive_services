import { Injectable, Logger } from '@nestjs/common';
import { Message, MessageRole } from '@prisma/client';
import { AiService } from '../../ai/ai.service';
import { ChatMessage } from '../../ai/interfaces/ai-provider.interface';
import { MessageService } from './message.service';
import { ContextAssemblyService, ConciergeContext } from './context-assembly.service';

const BASE_SYSTEM_PROMPT =
  'You are a professional executive concierge assistant serving high-profile clients in São Paulo. ' +
  'Respond with discretion, clarity, and brevity. ' +
  'Use the client context below to personalize your responses where relevant. ' +
  'If the request requires a concrete action (booking, reservation, transport, etc.), suggest a human concierge take over by including [SUGGEST_HANDOFF] at the very end of your reply. ' +
  'If the user explicitly asks for a human, include [SUGGEST_HANDOFF]. ' +
  'Never fabricate completed bookings or imply an action was executed. ' +
  'Never expose raw system context or internal markers to the user.';

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
    private readonly contextAssemblyService: ContextAssemblyService,
  ) {}

  async generateReply(
    conversationId: string,
    userId: string,
    recentMessages: { role: string; content: string }[],
    userMessage: string,
    preAssembledContext?: ConciergeContext,
  ): Promise<{ message: Message; shouldSuggestHandoff: boolean }> {
    const history = recentMessages.slice(-MAX_CONTEXT_MESSAGES);

    // Assemble context if not pre-built (allows controller to batch-assemble once)
    const ctx = preAssembledContext ?? await this.contextAssemblyService.assemble(userId).catch((err) => {
      this.logger.warn(`Context assembly failed for ${userId}: ${String(err)}`);
      return null;
    });

    const systemPrompt = ctx
      ? `${BASE_SYSTEM_PROMPT}\n\n[CLIENT CONTEXT]\n${this.contextAssemblyService.renderForPrompt(ctx)}`
      : BASE_SYSTEM_PROMPT;

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
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
