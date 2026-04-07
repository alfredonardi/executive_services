export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  userId?: string;
  purpose?: string;
}

export interface AIResponse {
  content: string;
  promptTokens: number;
  outputTokens: number;
  model: string;
  provider: string;
}

export interface EmbedOptions {
  model?: string;
}

export interface AIProvider {
  readonly name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<AIResponse>;
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncIterable<string>;
  embed(text: string, options?: EmbedOptions): Promise<number[]>;
}
