import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiCalendarConnection,
  CalendarProvider,
  calendarService,
} from '../services/calendar.service';
import { BorderRadius, Colors, Shadow, Spacing, Typography } from '../theme/tokens';

WebBrowser.maybeCompleteAuthSession();

const PROVIDERS: Array<{ provider: CalendarProvider; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { provider: 'GOOGLE', label: 'Google Calendar', icon: 'logo-google' },
  { provider: 'MICROSOFT', label: 'Microsoft Outlook', icon: 'logo-microsoft' },
];

export function CalendarConnectionsPanel({
  connections,
  onChanged,
  title = 'Calendar Connections',
  subtitle = 'Connect the calendar your concierge should quietly work around.',
}: {
  connections: ApiCalendarConnection[];
  onChanged?: () => Promise<void> | void;
  title?: string;
  subtitle?: string;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const handleConnect = async (provider: CalendarProvider) => {
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'executive-concierge',
      path: `calendar/${provider.toLowerCase()}`,
    });

    setBusyKey(`connect-${provider}`);
    try {
      const { authorizationUrl } = await calendarService.initiateConnection(provider, redirectUri);
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectUri, {
        preferEphemeralSession: true,
      });

      if (result.type !== 'success' || !result.url) {
        return;
      }

      const parsed = Linking.parse(result.url);
      const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
      const state = typeof parsed.queryParams?.state === 'string' ? parsed.queryParams.state : null;

      if (!code || !state) {
        throw new Error('The calendar provider did not return a valid authorization code.');
      }

      const completed = await calendarService.completeConnection(provider, code, state);
      await calendarService.syncConnection(completed.connectionId);
      await onChanged?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'We could not complete the calendar connection. Please try again.';
      Alert.alert('Calendar connection failed', message);
    } finally {
      setBusyKey(null);
    }
  };

  const handleDisconnect = async (connection: ApiCalendarConnection) => {
    Alert.alert(
      'Disconnect calendar',
      `Remove ${connection.provider === 'GOOGLE' ? 'Google Calendar' : 'Microsoft Outlook'} from your account?`,
      [
        { text: 'Keep connected', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setBusyKey(`disconnect-${connection.id}`);
            try {
              await calendarService.disconnect(connection.id);
              await onChanged?.();
            } catch {
              Alert.alert(
                'Disconnect failed',
                'We could not disconnect that calendar right now.',
              );
            } finally {
              setBusyKey(null);
            }
          },
        },
      ],
    );
  };

  const handleSync = async (connection: ApiCalendarConnection) => {
    setBusyKey(`sync-${connection.id}`);
    try {
      await calendarService.syncConnection(connection.id);
      await onChanged?.();
    } catch {
      Alert.alert('Sync unavailable', 'We could not refresh this calendar right now.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>

      {PROVIDERS.map((providerConfig) => {
        const connection = connections.find((item) => item.provider === providerConfig.provider) ?? null;
        const isConnecting = busyKey === `connect-${providerConfig.provider}`;
        const isSyncing = connection ? busyKey === `sync-${connection.id}` : false;
        const isDisconnecting = connection ? busyKey === `disconnect-${connection.id}` : false;

        return (
          <View key={providerConfig.provider} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.providerBadge}>
                <Ionicons name={providerConfig.icon} size={16} color={Colors.gold} />
              </View>
              <View style={styles.providerCopy}>
                <Text style={styles.providerTitle}>{providerConfig.label}</Text>
                <Text style={styles.providerSubtitle}>
                  {connection?.email
                    ? connection.email
                    : 'Not connected yet'}
                </Text>
              </View>
              <View style={[styles.statePill, connection ? styles.statePillActive : null]}>
                <Text style={[styles.statePillText, connection ? styles.statePillTextActive : null]}>
                  {connection ? 'Connected' : 'Available'}
                </Text>
              </View>
            </View>

            <Text style={styles.cardMeta}>
              {connection?.syncedAt
                ? `Last synced ${formatShortDate(connection.syncedAt)}`
                : connection
                  ? 'Awaiting first sync'
                  : 'Read-only access to your schedule and free windows.'}
            </Text>

            <View style={styles.actionsRow}>
              {!connection && (
                <TouchableOpacity
                  style={[styles.primaryButton, isConnecting && styles.disabledButton]}
                  activeOpacity={0.85}
                  disabled={isConnecting}
                  onPress={() => void handleConnect(providerConfig.provider)}
                >
                  <Text style={styles.primaryButtonText}>
                    {isConnecting ? 'Connecting…' : 'Connect'}
                  </Text>
                </TouchableOpacity>
              )}

              {connection && (
                <>
                  <TouchableOpacity
                    style={[styles.secondaryButton, isSyncing && styles.disabledButton]}
                    activeOpacity={0.85}
                    disabled={isSyncing}
                    onPress={() => void handleSync(connection)}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {isSyncing ? 'Syncing…' : 'Sync now'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.ghostButton, isDisconnecting && styles.disabledButton]}
                    activeOpacity={0.85}
                    disabled={isDisconnecting}
                    onPress={() => handleDisconnect(connection)}
                  >
                    <Text style={styles.ghostButtonText}>
                      {isDisconnecting ? 'Removing…' : 'Disconnect'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  section: {
    marginTop: Spacing[6],
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing[2],
  },
  sectionSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
    marginBottom: Spacing[4],
    lineHeight: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing[3],
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerBadge: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  providerCopy: {
    flex: 1,
  },
  providerTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.white,
  },
  providerSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
    marginTop: 2,
  },
  statePill: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1],
  },
  statePillActive: {
    borderColor: Colors.gold,
  },
  statePillText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
    letterSpacing: Typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  statePillTextActive: {
    color: Colors.gold,
  },
  cardMeta: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
    lineHeight: 20,
    marginTop: Spacing[4],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing[2],
    marginTop: Spacing[4],
  },
  primaryButton: {
    backgroundColor: Colors.gold,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
  },
  primaryButtonText: {
    color: Colors.black,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  secondaryButton: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  secondaryButtonText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
  ghostButton: {
    justifyContent: 'center',
    paddingHorizontal: Spacing[3],
  },
  ghostButtonText: {
    color: Colors.gray,
    fontSize: Typography.fontSize.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
