import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing } from '../../theme/tokens';

interface TimeBlock {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  type: 'event' | 'window';
  location?: string;
}

const mockSchedule: TimeBlock[] = [
  {
    id: '1',
    startTime: '09:00',
    endTime: '10:30',
    title: 'Board Meeting — BTG Pactual HQ',
    type: 'event',
    location: 'Faria Lima, São Paulo',
  },
  {
    id: '2',
    startTime: '10:30',
    endTime: '12:00',
    title: '90-min window',
    type: 'window',
  },
  {
    id: '3',
    startTime: '12:00',
    endTime: '13:30',
    title: 'Lunch with Eduardo Salave',
    type: 'event',
    location: 'Dentro Restaurante, Itaim',
  },
  {
    id: '4',
    startTime: '14:00',
    endTime: '16:00',
    title: 'Due Diligence Session',
    type: 'event',
  },
  {
    id: '5',
    startTime: '16:00',
    endTime: '20:00',
    title: '4-hour window',
    type: 'window',
  },
];

export default function TodayScreen() {
  const today = new Date();
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning</Text>
        <Text style={styles.date}>
          {dayName}, {dateStr}
        </Text>
        <Text style={styles.location}>São Paulo · 24°C · Sunny</Text>
      </View>

      {/* Schedule */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.sectionTitle}>TODAY'S SCHEDULE</Text>

        {mockSchedule.map((block) => (
          <TimeBlockCard key={block.id} block={block} />
        ))}
      </ScrollView>
    </View>
  );
}

function TimeBlockCard({ block }: { block: TimeBlock }) {
  const isWindow = block.type === 'window';

  return (
    <View style={[styles.timeBlock, isWindow && styles.timeBlockWindow]}>
      <View style={styles.timeColumn}>
        <Text style={styles.timeStart}>{block.startTime}</Text>
        <View style={[styles.timeLine, isWindow && styles.timeLineDashed]} />
        <Text style={styles.timeEnd}>{block.endTime}</Text>
      </View>

      <View style={styles.eventColumn}>
        {isWindow ? (
          <TouchableOpacity style={styles.windowCard}>
            <Text style={styles.windowLabel}>FREE WINDOW</Text>
            <Text style={styles.windowTitle}>{block.title}</Text>
            <Text style={styles.windowCta}>See recommendations →</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.eventCard}>
            <Text style={styles.eventTitle}>{block.title}</Text>
            {block.location && (
              <Text style={styles.eventLocation}>{block.location}</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing[6],
    paddingTop: Spacing[6],
    paddingBottom: Spacing[10],
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gray,
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing[4],
  },
  timeBlock: {
    flexDirection: 'row',
    marginBottom: Spacing[2],
    minHeight: 60,
  },
  timeBlockWindow: {
    opacity: 0.9,
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
  timeLineDashed: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: Colors.gold,
    width: 1,
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
    borderRadius: 8,
    padding: Spacing[4],
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
  },
  eventTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.white,
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: Typography.fontSize.xs,
    color: Colors.lightGray,
  },
  windowCard: {
    backgroundColor: Colors.charcoal,
    borderRadius: 8,
    padding: Spacing[4],
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold,
  },
  windowLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gold,
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom: 4,
  },
  windowTitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
    marginBottom: Spacing[2],
  },
  windowCta: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gold,
  },
});
