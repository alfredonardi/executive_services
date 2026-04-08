import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { notificationService } from '../services/notification.service';
import { BorderRadius, Colors, Spacing } from '../theme/tokens';

export function ShellHeaderActions() {
  const { data: unreadNotifications = [] } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => notificationService.listNotifications(true),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const unreadCount = unreadNotifications.length;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.iconButton}
        activeOpacity={0.8}
        onPress={() => router.push('/notifications')}
      >
        <Ionicons name="notifications-outline" size={18} color={Colors.white} />
        {unreadCount > 0 && <View style={styles.unreadDot} />}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        activeOpacity={0.8}
        onPress={() => router.push('/settings')}
      >
        <Ionicons name="person-circle-outline" size={20} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gold,
  },
});
