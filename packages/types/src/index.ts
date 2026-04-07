// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserRole = 'EXECUTIVE' | 'CONCIERGE_AGENT' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  nationality?: string;
  company?: string;
  title?: string;
  timezone: string;
  preferences: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  dietary: string[];
  wellness: string[];
  interests: string[];
  languages: string[];
  communicationStyle: 'BRIEF' | 'DETAILED';
  notificationsEnabled: boolean;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export type CalendarProvider = 'GOOGLE' | 'MICROSOFT';

export interface CalendarEvent {
  id: string;
  externalId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  isAllDay: boolean;
  provider: CalendarProvider;
}

export interface ScheduleWindow {
  startAt: string;
  endAt: string;
  durationMinutes: number;
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export type RecommendationCategory =
  | 'RESTAURANT'
  | 'WELLNESS'
  | 'SHORT_EXPERIENCE'
  | 'BUSINESS_SUPPORT'
  | 'MICRO_EXPERIENCE';

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  venue?: string;
  neighborhood?: string;
  durationMinutes?: number;
  priceLevel: 1 | 2 | 3 | 4;
  tags: string[];
  imageUrl?: string;
  reason?: string;
  relevanceScore?: number;
}

// ─── Concierge Chat ───────────────────────────────────────────────────────────

export type MessageRole = 'USER' | 'AI' | 'AGENT';

export type ConversationStatus = 'ACTIVE' | 'HUMAN_HANDOFF' | 'RESOLVED' | 'ARCHIVED';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  status: ConversationStatus;
  assignedAgentId?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export type RequestStatus =
  | 'PENDING'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type RequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface ConciergeRequest {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: RequestStatus;
  priority: RequestPriority;
  category?: string;
  assignedAgentId?: string;
  notes?: string;
  dueAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'REQUEST_UPDATE'
  | 'MESSAGE'
  | 'RECOMMENDATION'
  | 'SYSTEM'
  | 'REMINDER';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

// ─── API Common ───────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor?: string;
    hasMore: boolean;
    total?: number;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown[];
  requestId: string;
}
