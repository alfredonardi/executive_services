import { apiClient } from './api.client';

export type MessageRole = 'USER' | 'AI' | 'AGENT';
export type ConversationStatus = 'ACTIVE' | 'HUMAN_HANDOFF' | 'RESOLVED' | 'ARCHIVED';

export interface ApiMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  agentId: string | null;
  tokensUsed: number | null;
  createdAt: string;
}

export interface ApiConversation {
  id: string;
  userId: string;
  status: ConversationStatus;
  title: string | null;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiConversationDetail extends ApiConversation {
  messages: ApiMessage[];
}

export interface SendMessageResponse {
  userMessage: ApiMessage;
  aiReply: ApiMessage;
  shouldSuggestHandoff: boolean;
}

export const conciergeService = {
  async createConversation(title?: string): Promise<ApiConversation> {
    const response = await apiClient.post<ApiConversation>('/conversations', { title });
    return response.data;
  },

  async listConversations(): Promise<ApiConversation[]> {
    const response = await apiClient.get<ApiConversation[]>('/conversations');
    return response.data;
  },

  async getConversation(id: string): Promise<ApiConversationDetail> {
    const response = await apiClient.get<ApiConversationDetail>(`/conversations/${id}`);
    return response.data;
  },

  async sendMessage(conversationId: string, content: string): Promise<SendMessageResponse> {
    const response = await apiClient.post<SendMessageResponse>(
      `/conversations/${conversationId}/messages`,
      { content },
    );
    return response.data;
  },

  async initiateHandoff(conversationId: string, reason?: string): Promise<ApiConversation> {
    const response = await apiClient.post<ApiConversation>(
      `/conversations/${conversationId}/handoff`,
      { reason },
    );
    return response.data;
  },
};
