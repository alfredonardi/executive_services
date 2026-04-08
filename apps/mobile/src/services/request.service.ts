import { apiClient } from './api.client';

export type RequestStatus = 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface ApiRequestStatusUpdate {
  id: string;
  requestId: string;
  status: RequestStatus;
  notes: string | null;
  agentId: string | null;
  createdAt: string;
}

export interface ApiRequest {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: RequestStatus;
  priority: RequestPriority;
  category: string | null;
  notes: string | null;
  dueAt: string | null;
  completedAt: string | null;
  conversationId: string | null;
  sourceRecommendationId: string | null;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRequestDetail extends ApiRequest {
  statusUpdates: ApiRequestStatusUpdate[];
}

export interface CreateRequestDto {
  title: string;
  description: string;
  priority?: RequestPriority;
  category?: string;
  dueAt?: string;
  conversationId?: string;
}

export interface CreateFromRecommendationDto {
  catalogItemId: string;
  title: string;
  description: string;
  priority?: RequestPriority;
  timeWindowContext?: string;
  conversationId?: string;
}

export const requestService = {
  async listRequests(): Promise<ApiRequest[]> {
    const response = await apiClient.get<ApiRequest[]>('/concierge-requests');
    return response.data;
  },

  async getRequest(id: string): Promise<ApiRequestDetail> {
    const response = await apiClient.get<ApiRequestDetail>(`/concierge-requests/${id}`);
    return response.data;
  },

  async createRequest(dto: CreateRequestDto): Promise<ApiRequest> {
    const response = await apiClient.post<ApiRequest>('/concierge-requests', dto);
    return response.data;
  },

  async createFromRecommendation(dto: CreateFromRecommendationDto): Promise<ApiRequest> {
    const response = await apiClient.post<ApiRequest>(
      '/concierge-requests/from-recommendation',
      dto,
    );
    return response.data;
  },
};
