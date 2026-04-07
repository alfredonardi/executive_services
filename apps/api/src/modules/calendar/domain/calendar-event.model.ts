/**
 * Normalized internal calendar event model.
 *
 * This model is provider-agnostic. All business logic must work against this
 * model, never against Google-specific or Microsoft-specific schemas.
 * Provider adapters are responsible for mapping to this model.
 */
export interface NormalizedCalendarEvent {
  /** Provider-assigned unique ID for this event */
  externalId: string;
  /** Human-readable title. Sanitized — may be truncated if excessively long. */
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date;
  /** IANA timezone string, e.g. "America/Sao_Paulo" */
  timezone: string | null;
  isAllDay: boolean;
  location: string | null;
  /** First video conference URL found in the event (Meet, Teams, Zoom, etc.) */
  meetingUrl: string | null;
  /** Organizer email address */
  organizer: string | null;
  /** Simplified attendee list — only email and display name */
  attendees: NormalizedAttendee[];
  isCancelled: boolean;
  /** Raw provider payload — stored for debugging, never exposed to clients */
  raw: Record<string, unknown>;
}

export interface NormalizedAttendee {
  email: string;
  name: string | null;
  /** accepted | declined | tentative | needsAction | none */
  status: string;
}

/**
 * Result returned by a provider's fetchEvents() method.
 * Contains the normalized events plus the next sync cursor for incremental sync.
 */
export interface ProviderEventPage {
  events: NormalizedCalendarEvent[];
  /** Opaque cursor for the next incremental sync. Null if not supported. */
  nextSyncCursor: string | null;
}
