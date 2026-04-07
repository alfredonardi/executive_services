/**
 * Schedule context derived from normalized calendar events.
 * This model is the bridge between raw calendar data and the recommendation engine.
 * It never exposes raw event titles or attendee details.
 */

export type WindowType =
  | 'FREE'
  | 'OCCUPIED'
  | 'MEAL_OPPORTUNITY'
  | 'MORNING_START'
  | 'EVENING_FREE'
  | 'PRE_MEETING'
  | 'POST_MEETING'
  | 'ARRIVAL_RECOVERY';

export interface TimeWindow {
  start: Date;
  end: Date;
  durationMinutes: number;
  type: WindowType;
  /** Human-friendly label like "90-min gap between meetings" — no PII */
  label: string;
}

export interface ScheduleContext {
  userId: string;
  referenceDate: Date;
  timezone: string;
  occupiedWindows: TimeWindow[];
  freeWindows: TimeWindow[];
  /** Windows suitable for short (15-45 min) low-friction recommendations */
  opportunityWindows: TimeWindow[];
  /** Day-level density: low | moderate | high */
  scheduleDensity: 'low' | 'moderate' | 'high';
  /** True if the day appears to be a pure work day with dense meetings */
  isPrimaryWorkDay: boolean;
  hasMealOpportunity: boolean;
  hasEveningFree: boolean;
  nextMeetingStartsAt: Date | null;
  lastMeetingEndsAt: Date | null;
}
