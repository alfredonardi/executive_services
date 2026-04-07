import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AIProvider, AIResponse, ChatMessage, ChatOptions, EmbedOptions } from './interfaces/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: AIProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly openaiProvider: OpenAIProvider,
  ) {
    const providerName = this.config.get<string>('ai.provider') ?? 'openai';
    this.provider = this.resolveProvider(providerName);
    this.logger.log(`AI provider initialized: ${this.provider.name}`);
  }

  private resolveProvider(name: string): AIProvider {
    switch (name) {
      case 'openai':
        return this.openaiProvider;
      default:
        this.logger.warn(`Unknown AI provider "${name}", falling back to OpenAI`);
        return this.openaiProvider;
    }
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions & { userId?: string; purpose?: string },
  ): Promise<AIResponse> {
    const start = Date.now();
    let response: AIResponse | null = null;
    let errorMessage: string | undefined;

    try {
      response = await this.provider.chat(messages, options);
      return response;
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      await this.logAiCall({
        userId: options?.userId,
        provider: this.provider.name,
        model: options?.model ?? 'default',
        promptTokens: response?.promptTokens ?? 0,
        outputTokens: response?.outputTokens ?? 0,
        durationMs: Date.now() - start,
        purpose: options?.purpose ?? 'unknown',
        success: !errorMessage,
        errorMessage,
      }).catch((err) => this.logger.error('Failed to log AI call', err));
    }
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): AsyncIterable<string> {
    yield* this.provider.chatStream(messages, options);
  }

  async embed(text: string, options?: EmbedOptions): Promise<number[]> {
    return this.provider.embed(text, options);
  }

  private async logAiCall(data: {
    userId?: string;
    provider: string;
    model: string;
    promptTokens: number;
    outputTokens: number;
    durationMs: number;
    purpose: string;
    success: boolean;
    errorMessage?: string;
  }) {
    await this.prisma.aiCallLog.create({
      data: {
        userId: data.userId,
        provider: data.provider,
        model: data.model,
        promptTokens: data.promptTokens,
        outputTokens: data.outputTokens,
        durationMs: data.durationMs,
        purpose: data.purpose,
        success: data.success,
        errorMessage: data.errorMessage,
      },
    });
  }
}
