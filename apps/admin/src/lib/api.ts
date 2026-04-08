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
};
