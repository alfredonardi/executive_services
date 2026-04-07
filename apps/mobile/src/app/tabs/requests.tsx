import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography, Spacing } from '../../theme/tokens';

interface Request {
  id: string;
  title: string;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: string;
  updatedAt: string;
}

const MOCK_REQUESTS: Request[] = [
  {
    id: '1',
    title: 'Book table for 2 tonight at Maní — 8:30 PM',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    updatedAt: '2 hours ago',
  },
  {
    id: '2',
    title: 'Arrange airport transfer to GRU — Friday 18:00',
    status: 'ACKNOWLEDGED',
    priority: 'NORMAL',
    updatedAt: 'Yesterday',
  },
  {
    id: '3',
    title: 'Wellness session at hotel spa — Wednesday PM',
    status: 'COMPLETED',
    priority: 'LOW',
    updatedAt: '2 days ago',
  },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: Colors.gray },
  ACKNOWLEDGED: { label: 'Acknowledged', color: Colors.info },
  IN_PROGRESS: { label: 'In Progress', color: Colors.gold },
  COMPLETED: { label: 'Completed', color: Colors.success },
  CANCELLED: { label: 'Cancelled', color: Colors.error },
};

export default function RequestsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Requests</Text>
        <TouchableOpacity style={styles.newButton}>
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_REQUESTS.map((request) => (
          <RequestCard key={request.id} request={request} />
        ))}
      </ScrollView>
    </View>
  );
}

function RequestCard({ request }: { request: Request }) {
  const statusConfig = STATUS_CONFIG[request.status] ?? STATUS_CONFIG['PENDING'];

  return (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { borderColor: statusConfig.color }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
        <Text style={styles.timeText}>{request.updatedAt}</Text>
      </View>

      <Text style={styles.cardTitle}>{request.title}</Text>

      <View style={styles.cardFooter}>
        <Text style={styles.priorityText}>{request.priority}</Text>
        <Text style={styles.arrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
  },
  newButton: {
    backgroundColor: Colors.gold,
    borderRadius: 6,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
  },
  newButtonText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.black,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing[6],
    gap: Spacing[3],
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.semibold,
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
  },
  cardTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.white,
    lineHeight: 20,
    marginBottom: Spacing[3],
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priorityText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
  },
  arrowText: {
    color: Colors.gold,
    fontSize: Typography.fontSize.sm,
  },
});
