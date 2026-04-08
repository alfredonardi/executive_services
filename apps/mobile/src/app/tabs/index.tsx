import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarConnectionsPanel } from '../../components/calendar-connections-panel';
import { ShellHeaderActions } from '../../components/shell-header-actions';
import { todayService, type TodayEvent, type TodayOverview, type TodayWindow } from '../../services/today.service';
import { BorderRadius, Colors, Shadow, Spacing, Typography } from '../../theme/tokens';

type TimelineItem =
  | { kind: 'event'; id: string; startAt: string; endAt: string; event: TodayEvent }
  | { kind: 'window'; id: string; startAt: string; endAt: string; window: TodayWindow };

export default function TodayScreen() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['today'],
    queryFn: () => todayService.getTodayOverview(),
  });

  const handleCalendarChanged = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['today'] }),
      queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] }),
    ]);
  };

  const onRefresh = async () => {
    await refetch();
  };

  const timelineItems = data ? buildTimelineItems(data) : [];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.gold} />
        <Text style={styles.loadingText}>Preparing your day brief…</Text>
      </View>
    );
  }

  if (!data || error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorTitle}>Today is temporarily unavailable</Text>
        <Text style={styles.errorSubtitle}>
          We could not load your live schedule. Please try again in a moment.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void refetch()}>
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerCopy}>
            <Text style={styles.greeting}>{buildGreeting(data.firstName)}</Text>
            <Text style={styles.date}>{formatHeaderDate(data.timezone)}</Text>
          </View>
          <ShellHeaderActions />
        </View>
        <Text style={styles.location}>
          {data.hasCalendarConnection
            ? 'Live schedule, quiet windows, and connection status.'
            : 'Connect a calendar to make Today fully live.'}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void onRefresh()}
            tintColor={Colors.gold}
          />
        }
      >
        {!data.hasCalendarConnection && (
          <>
            <StateCard
              eyebrow="Executive day brief"
              title="Connect your calendar"
              body="Your Today tab will quietly transform into a live schedule once we can read your agenda. Google Calendar and Microsoft Outlook are both supported."
            />
            <CalendarConnectionsPanel
              connections={data.connections}
              onChanged={handleCalendarChanged}
            />
          </>
        )}

        {data.hasCalendarConnection && (
          <>
            <HeroCard overview={data} />

            {data.needsInitialSync && (
              <StateCard
                eyebrow="First sync"
                title="Your calendar is settling in"
                body="The first sync has been started. Pull to refresh in a moment if your agenda has not appeared yet."
              />
            )}

            {!data.needsInitialSync && data.events.length === 0 && (
              <StateCard
                eyebrow="Open day"
                title="Nothing confirmed on the books"
                body="Your connected calendar does not show meetings today. We will still surface open windows as your day evolves."
              />
            )}

            <Text style={styles.sectionTitle}>TODAY'S SCHEDULE</Text>

            {timelineItems.length === 0 ? (
              <View style={styles.timelineEmpty}>
                <Text style={styles.timelineEmptyText}>
                  Once your first events arrive, your day will appear here.
                </Text>
              </View>
            ) : (
              timelineItems.map((item) => (
                <TimelineCard key={item.id} item={item} />
              ))
            )}

            <CalendarConnectionsPanel
              connections={data.connections}
              onChanged={handleCalendarChanged}
              title="Connected Calendars"
              subtitle="Refresh, disconnect, or add another provider without leaving the app."
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function HeroCard({ overview }: { overview: TodayOverview }) {
  const nextMeetingTime = overview.summary.nextMeetingStartsAt
    ? formatTime(overview.summary.nextMeetingStartsAt)
    : null;

  return (
    <View style={styles.heroCard}>
      <Text style={styles.heroEyebrow}>Executive Overview</Text>
      <Text style={styles.heroTitle}>
        {overview.summary.meetingCount > 0
          ? `${overview.summary.meetingCount} commitment${overview.summary.meetingCount === 1 ? '' : 's'} today`
          : 'A lighter day ahead'}
      </Text>
      <Text style={styles.heroBody}>
        {nextMeetingTime
          ? `Your next meeting begins at ${nextMeetingTime}, with ${overview.summary.opportunityWindowCount} recommendation-friendly window${overview.summary.opportunityWindowCount === 1 ? '' : 's'} around it.`
          : 'No meeting is currently holding the next slot on your calendar.'}
      </Text>

      <View style={styles.heroMetrics}>
        <MetricChip label="Density" value={overview.scheduleDensity} />
        <MetricChip
          label="Free windows"
          value={overview.summary.freeWindowCount.toString()}
        />
        <MetricChip
          label="Meal opening"
          value={overview.summary.hasMealOpportunity ? 'Yes' : 'No'}
        />
      </View>
    </View>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricChip}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function StateCard({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.stateCard}>
      <Text style={styles.stateEyebrow}>{eyebrow}</Text>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
    </View>
  );
}

function TimelineCard({ item }: { item: TimelineItem }) {
  const isWindow = item.kind === 'window';

  return (
    <View style={styles.timeBlock}>
      <View style={styles.timeColumn}>
        <Text style={styles.timeStart}>{formatTime(item.startAt)}</Text>
        <View style={[styles.timeLine, isWindow && styles.timeLineWindow]} />
        <Text style={styles.timeEnd}>{formatTime(item.endAt)}</Text>
      </View>

      <View style={styles.eventColumn}>
        {isWindow ? (
          <TouchableOpacity
            style={[styles.windowCard, item.window.durationMinutes >= 45 && styles.windowCardActionable]}
            activeOpacity={item.window.durationMinutes >= 45 ? 0.85 : 1}
            onPress={() => {
              if (item.window.durationMinutes >= 45) {
                router.push('/tabs/recommendations');
              }
            }}
          >
            <Text style={styles.windowLabel}>FREE WINDOW</Text>
            <Text style={styles.windowTitle}>{item.window.label}</Text>
            <Text style={styles.windowMeta}>{`${item.window.durationMinutes} minutes available`}</Text>
            {item.window.durationMinutes >= 45 && (
              <Text style={styles.windowCta}>See recommendations →</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.eventCard}>
            <View style={styles.eventTopRow}>
              <Text style={styles.eventTitle}>{item.event.title}</Text>
              <View style={styles.eventStatusPill}>
                <Text style={styles.eventStatusText}>
                  {item.event.status === 'in_progress'
                    ? 'Now'
                    : item.event.status === 'completed'
                      ? 'Done'
                      : 'Next'}
                </Text>
              </View>
            </View>

            <Text style={styles.eventMeta}>
              {[
                item.event.provider ? formatProvider(item.event.provider) : null,
                item.event.location,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function buildTimelineItems(data: TodayOverview): TimelineItem[] {
  const freeWindows = data.freeWindows.filter((window) => window.durationMinutes >= 20);

  return [
    ...data.events.map((event) => ({
      kind: 'event' as const,
      id: `event-${event.id}`,
      startAt: event.startAt,
      endAt: event.endAt,
      event,
    })),
    ...freeWindows.map((window, index) => ({
      kind: 'window' as const,
      id: `window-${index}-${window.startAt}`,
      startAt: window.startAt,
      endAt: window.endAt,
      window,
    })),
  ].sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
}

function buildGreeting(firstName: string) {
  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return `${salutation}, ${firstName}`;
}

function formatHeaderDate(timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date());
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatProvider(provider: TodayEvent['provider']) {
  if (provider === 'GOOGLE') return 'Google';
  if (provider === 'MICROSOFT') return 'Microsoft';
  return '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing[8],
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing[4],
  },
  headerCopy: {
    flex: 1,
  },
  greeting: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gold,
    letterSpacing: Typography.letterSpacing.wider,
    textTransform: 'uppercase',
    marginBottom: Spacing[1],
  },
  date: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
    marginBottom: Spacing[1],
  },
  location: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
    marginTop: Spacing[3],
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[6],
    paddingBottom: Spacing[12],
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius['2xl'],
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing[6],
    marginBottom: Spacing[5],
    ...Shadow.md,
  },
  heroEyebrow: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gold,
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing[2],
  },
  heroTitle: {
    fontSize: Typography.fontSize.xl,
    color: Colors.white,
    fontWeight: Typography.fontWeight.light,
    marginBottom: Spacing[2],
  },
  heroBody: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
    lineHeight: 22,
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: Spacing[2],
    flexWrap: 'wrap',
    marginTop: Spacing[5],
  },
  metricChip: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    backgroundColor: Colors.charcoal,
  },
  metricLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wider,
  },
  metricValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
    marginTop: 2,
  },
  stateCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing[5],
    marginBottom: Spacing[4],
  },
  stateEyebrow: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gold,
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing[2],
  },
  stateTitle: {
    fontSize: Typography.fontSize.lg,
    color: Colors.white,
    marginBottom: Spacing[2],
  },
  stateBody: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
    lineHeight: 21,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gray,
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing[4],
    marginTop: Spacing[2],
  },
  timeBlock: {
    flexDirection: 'row',
    marginBottom: Spacing[2],
    minHeight: 68,
  },
  timeColumn: {
    width: 60,
    alignItems: 'center',
    paddingTop: 4,
  },
  timeStart: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
  },
  timeLine: {
    flex: 1,
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  timeLineWindow: {
    backgroundColor: Colors.gold,
    opacity: 0.5,
  },
  timeEnd: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
  },
  eventColumn: {
    flex: 1,
    marginLeft: Spacing[3],
    paddingBottom: Spacing[3],
  },
  eventCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderLeftWidth: 2,
    borderLeftColor: Colors.borderLight,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing[3],
  },
  eventTitle: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.white,
    marginBottom: 4,
  },
  eventMeta: {
    fontSize: Typography.fontSize.xs,
    color: Colors.lightGray,
  },
  eventStatusPill: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
  },
  eventStatusText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.wide,
  },
  windowCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  windowCardActionable: {
    borderColor: Colors.goldDark,
  },
  windowLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gold,
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing[2],
  },
  windowTitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
    marginBottom: 4,
  },
  windowMeta: {
    fontSize: Typography.fontSize.xs,
    color: Colors.lightGray,
  },
  windowCta: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gold,
    marginTop: Spacing[3],
  },
  loadingText: {
    color: Colors.lightGray,
    marginTop: Spacing[3],
  },
  errorTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    marginBottom: Spacing[2],
  },
  errorSubtitle: {
    color: Colors.lightGray,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: Spacing[4],
  },
  retryButton: {
    backgroundColor: Colors.gold,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.full,
  },
  retryButtonText: {
    color: Colors.black,
    fontWeight: Typography.fontWeight.semibold,
  },
  timelineEmpty: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing[5],
    backgroundColor: Colors.surface,
  },
  timelineEmptyText: {
    color: Colors.lightGray,
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
  },
});
