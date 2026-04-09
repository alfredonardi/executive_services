import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AIProvider, AIResponse, ChatMessage, ChatOptions, EmbedOptions } from '../interfaces/ai-provider.interface';

@Injectable()
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly apiKey?: string;
  private client: OpenAI | null = null;
  private readonly defaultModel: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('ai.openaiApiKey');
    this.defaultModel = this.config.get<string>('ai.model') ?? 'gpt-4o-mini';

    if (!this.apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY is not configured. The API can start, but AI endpoints will fail until a valid key is provided.',
      );
    }
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIResponse> {
    const model = options?.model ?? this.defaultModel;
    const start = Date.now();

    try {
      const response = await this.getClient().chat.completions.create({
        model,
        messages,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.7,
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw new Error('Empty response from OpenAI');
      }

      return {
        content: choice.message.content,
        promptTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model,
        provider: this.name,
      };
    } catch (error) {
      this.logger.error('OpenAI chat error', { error, durationMs: Date.now() - start });
      throw error;
    }
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string> {
    const model = options?.model ?? this.defaultModel;

    const stream = await this.getClient().chat.completions.create({
      model,
      messages,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  async embed(text: string, options?: EmbedOptions): Promise<number[]> {
    const model = options?.model ?? 'text-embedding-3-small';

    const response = await this.getClient().embeddings.create({
      model,
      input: text,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error('Empty embedding response from OpenAI');
    }

    return embedding;
  }

  private getClient(): OpenAI {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.apiKey });
    }

    return this.client;
  }
}
