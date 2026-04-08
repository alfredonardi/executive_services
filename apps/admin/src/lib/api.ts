/**
 * Minimal API client for the admin panel.
 * Auth token is read from localStorage (set after login).
 * Phase 5 will add a proper admin auth flow.
 */

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'admin_access_token';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearAdminToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConversationStatus = 'ACTIVE' | 'HUMAN_HANDOFF' | 'RESOLVED' | 'ARCHIVED';
export type MessageRole = 'USER' | 'AI' | 'AGENT';
export type RequestStatus = 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface RequestStatusUpdate {
  id: string;
  requestId: string;
  status: RequestStatus;
  notes: string | null;
  agentId: string | null;
  createdAt: string;
}

export interface AdminRequestSummary {
  id: string;
  status: RequestStatus;
  priority: RequestPriority;
  title: string;
  category: string | null;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    nationality: string | null;
  };
  assignedAgent: { id: string; firstName: string; lastName: string } | null;
  _count: { statusUpdates: number };
}

export interface AdminRequestDetail extends Omit<AdminRequestSummary, '_count'> {
  description: string;
  notes: string | null;
  dueAt: string | null;
  completedAt: string | null;
  conversationId: string | null;
  sourceRecommendationId: string | null;
  statusUpdates: RequestStatusUpdate[];
  conversation: { id: string; status: string; title: string | null } | null;
  user: AdminRequestSummary['user'] & { title: string | null; timezone: string };
}

export interface AdminConversationSummary {
  id: string;
  status: ConversationStatus;
  title: string | null;
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    nationality: string | null;
  };
  assignedAgent: { id: string; firstName: string; lastName: string } | null;
  _count: { messages: number };
}

export interface AdminMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  agentId: string | null;
  createdAt: string;
}

export interface AdminConversationDetail extends Omit<AdminConversationSummary, '_count'> {
  messages: AdminMessage[];
  user: AdminConversationSummary['user'] & {
    title: string | null;
    timezone: string;
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const adminApi = {
  listConversations(status?: ConversationStatus): Promise<AdminConversationSummary[]> {
    const qs = status ? `?status=${status}` : '';
    return request<AdminConversationSummary[]>(`/admin/conversations${qs}`);
  },

  getConversation(id: string): Promise<AdminConversationDetail> {
    return request<AdminConversationDetail>(`/admin/conversations/${id}`);
  },

  sendAgentMessage(conversationId: string, content: string): Promise<AdminMessage> {
    return request<AdminMessage>(`/admin/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  assignSelf(conversationId: string, agentId: string): Promise<unknown> {
    return request(`/conversations/${conversationId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
  },

  // ── Requests ────────────────────────────────────────────────────────────────

  listRequests(status?: RequestStatus): Promise<AdminRequestSummary[]> {
    const qs = status ? `?status=${status}` : '';
    return request<AdminRequestSummary[]>(`/admin/requests${qs}`);
  },

  getRequest(id: string): Promise<AdminRequestDetail> {
    return request<AdminRequestDetail>(`/admin/requests/${id}`);
  },

  updateRequestStatus(id: string, status: RequestStatus, notes?: string): Promise<unknown> {
    return request(`/admin/requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    });
  },

  assignRequest(id: string, agentId: string): Promise<unknown> {
    return request(`/admin/requests/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
  },
};
