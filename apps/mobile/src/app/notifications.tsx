import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../services/notification.service';
import { BorderRadius, Colors, Shadow, Spacing, Typography } from '../theme/tokens';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();
  const { data: notifications = [], isLoading, error, refetch } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationService.listNotifications(),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] }),
      ]);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] }),
      ]);
    },
  });

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              Concierge updates, request movement, and quiet reminders.
            </Text>
          </View>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={[styles.markAllButton, markAllMutation.isPending && styles.disabledButton]}
            disabled={markAllMutation.isPending}
            onPress={() => markAllMutation.mutate()}
          >
            <Text style={styles.markAllButtonText}>
              {markAllMutation.isPending ? 'Marking…' : 'Mark all read'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.gold} />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      )}

      {!isLoading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>We could not load your notifications.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void refetch()}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !error && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {notifications.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing waiting for you</Text>
              <Text style={styles.emptyBody}>
                When your concierge acknowledges a request or hands off a meaningful update, it will appear here.
              </Text>
            </View>
          )}

          {notifications.map((notification) => {
            const isUnread = !notification.readAt;
            return (
              <TouchableOpacity
                key={notification.id}
                activeOpacity={0.85}
                style={[styles.card, isUnread && styles.cardUnread]}
                onPress={() => {
                  if (isUnread && !markOneMutation.isPending) {
                    markOneMutation.mutate(notification.id);
                  }
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{notification.title}</Text>
                    {isUnread && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.cardTime}>{formatRelative(notification.createdAt)}</Text>
                </View>

                <Text style={styles.cardBody}>{notification.body}</Text>
                <Text style={styles.cardType}>{formatType(notification.type)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function formatType(type: string) {
  return type.replace('_', ' ');
}

function formatRelative(value: string) {
  const date = new Date(value);
  const now = Date.now();
  const diffMinutes = Math.round((now - date.getTime()) / 60_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffMinutes < 24 * 60) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[5],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing[3],
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.light,
  },
  headerSubtitle: {
    color: Colors.lightGray,
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
    marginTop: Spacing[2],
  },
  markAllButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing[4],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.goldDark,
  },
  markAllButtonText: {
    color: Colors.gold,
    fontSize: Typography.fontSize.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[8],
  },
  loadingText: {
    color: Colors.lightGray,
    marginTop: Spacing[3],
  },
  errorText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    marginBottom: Spacing[3],
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: Colors.gold,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
  },
  retryButtonText: {
    color: Colors.black,
    fontWeight: Typography.fontWeight.semibold,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing[6],
    paddingBottom: Spacing[10],
  },
  emptyCard: {
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing[5],
  },
  emptyTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    marginBottom: Spacing[2],
  },
  emptyBody: {
    color: Colors.lightGray,
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing[5],
    marginBottom: Spacing[3],
    ...Shadow.sm,
  },
  cardUnread: {
    borderColor: Colors.goldDark,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing[3],
  },
  cardTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  cardTitle: {
    flex: 1,
    color: Colors.white,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gold,
  },
  cardTime: {
    color: Colors.gray,
    fontSize: Typography.fontSize.xs,
  },
  cardBody: {
    color: Colors.lightGray,
    fontSize: Typography.fontSize.sm,
    lineHeight: 21,
    marginTop: Spacing[3],
  },
  cardType: {
    marginTop: Spacing[4],
    color: Colors.gold,
    fontSize: Typography.fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacing.widest,
  },
});
