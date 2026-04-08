import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarConnectionsPanel } from '../components/calendar-connections-panel';
import { calendarService } from '../services/calendar.service';
import { profileService } from '../services/profile.service';
import {
  recommendationService,
  type PreferenceProfile,
  type RecommendationCategory,
} from '../services/recommendation.service';
import { useAuthStore } from '../stores/auth.store';
import { BorderRadius, Colors, Shadow, Spacing, Typography } from '../theme/tokens';

const CATEGORY_OPTIONS: RecommendationCategory[] = [
  'RESTAURANT',
  'WELLNESS',
  'SHORT_EXPERIENCE',
  'BUSINESS_SUPPORT',
  'MICRO_EXPERIENCE',
];

const DEFAULT_PREFERENCE_PROFILE: PreferenceProfile = {
  id: 'draft',
  userId: 'draft',
  foodPreferences: [],
  dietaryConstraints: [],
  atmospherePreferences: [],
  preferredCategories: [],
  dislikedCategories: [],
  preferredDurationMin: 30,
  preferredDurationMax: 90,
  mobilityTolerance: 'moderate',
  preferredNeighborhoods: [],
  pacing: 'efficient',
  wellnessInterest: false,
  businessTravelStyle: 'premium',
  additionalNotes: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileService.getProfile(),
  });
  const { data: preferenceProfile, isLoading: preferenceLoading } = useQuery({
    queryKey: ['recommendation', 'profile'],
    queryFn: () => recommendationService.getPreferenceProfile(),
  });
  const { data: connections = [] } = useQuery({
    queryKey: ['calendar-connections'],
    queryFn: () => calendarService.listConnections(),
  });

  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    company: '',
    title: '',
    timezone: 'America/Sao_Paulo',
    languages: '',
    communicationStyle: 'BRIEF' as 'BRIEF' | 'DETAILED',
    notificationsEnabled: true,
  });
  const [preferenceForm, setPreferenceForm] = useState<PreferenceProfile>(DEFAULT_PREFERENCE_PROFILE);

  useEffect(() => {
    if (!profile) return;

    setProfileForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      company: profile.company ?? '',
      title: profile.title ?? '',
      timezone: profile.timezone,
      languages: profile.preferences.languages.join(', '),
      communicationStyle: profile.preferences.communicationStyle,
      notificationsEnabled: profile.preferences.notificationsEnabled,
    });
  }, [profile]);

  useEffect(() => {
    setPreferenceForm(preferenceProfile ?? DEFAULT_PREFERENCE_PROFILE);
  }, [preferenceProfile]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await profileService.updateProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        company: normalizeOptionalString(profileForm.company),
        title: normalizeOptionalString(profileForm.title),
        timezone: profileForm.timezone.trim() || 'America/Sao_Paulo',
        languages: parseCommaList(profileForm.languages),
        communicationStyle: profileForm.communicationStyle,
        notificationsEnabled: profileForm.notificationsEnabled,
      });

      await recommendationService.upsertPreferenceProfile({
        foodPreferences: preferenceForm.foodPreferences,
        dietaryConstraints: preferenceForm.dietaryConstraints,
        atmospherePreferences: preferenceForm.atmospherePreferences,
        preferredCategories: preferenceForm.preferredCategories,
        dislikedCategories: preferenceForm.dislikedCategories,
        preferredDurationMin: preferenceForm.preferredDurationMin,
        preferredDurationMax: preferenceForm.preferredDurationMax,
        mobilityTolerance: preferenceForm.mobilityTolerance,
        preferredNeighborhoods: preferenceForm.preferredNeighborhoods,
        pacing: preferenceForm.pacing,
        wellnessInterest: preferenceForm.wellnessInterest,
        businessTravelStyle: preferenceForm.businessTravelStyle,
        additionalNotes: preferenceForm.additionalNotes ?? undefined,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: ['recommendation', 'profile'] }),
        queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
        queryClient.invalidateQueries({ queryKey: ['today'] }),
      ]);
      Alert.alert('Saved', 'Your profile and preference updates have been applied.');
    },
    onError: () => {
      Alert.alert('Save failed', 'We could not save your changes right now.');
    },
  });

  const headerSubtitle = useMemo(() => {
    if (!profile) return 'Profile, calendar connections, and recommendation preferences.';
    return `${profile.email} · ${profile.company ?? 'Executive account'}`;
  }, [profile]);

  const isLoading = profileLoading || preferenceLoading;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
          </View>
        </View>
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.gold} />
          <Text style={styles.loadingText}>Loading your profile…</Text>
        </View>
      )}

      {!isLoading && profileError && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>We could not load your settings.</Text>
        </View>
      )}

      {!isLoading && !profileError && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SectionCard
            title="Profile"
            subtitle="Keep the app aligned with how you travel and operate."
          >
            <FormRow label="First name">
              <TextInput
                style={styles.input}
                value={profileForm.firstName}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, firstName: value }))}
                placeholder="First name"
                placeholderTextColor={Colors.gray}
              />
            </FormRow>

            <FormRow label="Last name">
              <TextInput
                style={styles.input}
                value={profileForm.lastName}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, lastName: value }))}
                placeholder="Last name"
                placeholderTextColor={Colors.gray}
              />
            </FormRow>

            <FormRow label="Company">
              <TextInput
                style={styles.input}
                value={profileForm.company}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, company: value }))}
                placeholder="Company"
                placeholderTextColor={Colors.gray}
              />
            </FormRow>

            <FormRow label="Title">
              <TextInput
                style={styles.input}
                value={profileForm.title}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, title: value }))}
                placeholder="Title"
                placeholderTextColor={Colors.gray}
              />
            </FormRow>

            <FormRow label="Timezone">
              <TextInput
                style={styles.input}
                value={profileForm.timezone}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, timezone: value }))}
                placeholder="America/Sao_Paulo"
                placeholderTextColor={Colors.gray}
              />
            </FormRow>
          </SectionCard>

          <SectionCard
            title="Account Preferences"
            subtitle="A few lightweight settings for tone, language, and notification posture."
          >
            <FormRow label="Languages">
              <TextInput
                style={styles.input}
                value={profileForm.languages}
                onChangeText={(value) => setProfileForm((current) => ({ ...current, languages: value }))}
                placeholder="English, Portuguese"
                placeholderTextColor={Colors.gray}
              />
              <Text style={styles.helperText}>Use a comma-separated list.</Text>
            </FormRow>

            <FormRow label="Communication style">
              <View style={styles.pillRow}>
                {(['BRIEF', 'DETAILED'] as const).map((style) => (
                  <PreferencePill
                    key={style}
                    label={style === 'BRIEF' ? 'Brief' : 'Detailed'}
                    selected={profileForm.communicationStyle === style}
                    onPress={() =>
                      setProfileForm((current) => ({ ...current, communicationStyle: style }))
                    }
                  />
                ))}
              </View>
            </FormRow>

            <ToggleRow
              label="In-app notifications"
              description="Show request and concierge updates inside the app."
              value={profileForm.notificationsEnabled}
              onValueChange={(value) =>
                setProfileForm((current) => ({ ...current, notificationsEnabled: value }))
              }
            />
          </SectionCard>

          <SectionCard
            title="Recommendation Preferences"
            subtitle="A practical first pass for what the recommendation engine should bias toward."
          >
            <FormRow label="Food preferences">
              <TextInput
                style={styles.input}
                value={preferenceForm.foodPreferences.join(', ')}
                onChangeText={(value) =>
                  setPreferenceForm((current) => ({
                    ...current,
                    foodPreferences: parseCommaList(value),
                  }))
                }
                placeholder="Japanese, Italian"
                placeholderTextColor={Colors.gray}
              />
            </FormRow>

            <FormRow label="Dietary constraints">
              <TextInput
                style={styles.input}
                value={preferenceForm.dietaryConstraints.join(', ')}
                onChangeText={(value) =>
                  setPreferenceForm((current) => ({
                    ...current,
                    dietaryConstraints: parseCommaList(value),
                  }))
                }
                placeholder="Vegetarian, gluten-free"
                placeholderTextColor={Colors.gray}
              />
            </FormRow>

            <FormRow label="Preferred neighborhoods">
              <TextInput
                style={styles.input}
                value={preferenceForm.preferredNeighborhoods.join(', ')}
                onChangeText={(value) =>
                  setPreferenceForm((current) => ({
                    ...current,
                    preferredNeighborhoods: parseCommaList(value),
                  }))
                }
                placeholder="Jardins, Itaim Bibi"
                placeholderTextColor={Colors.gray}
              />
            </FormRow>

            <FormRow label="Preferred categories">
              <View style={styles.pillRow}>
                {CATEGORY_OPTIONS.map((category) => (
                  <PreferencePill
                    key={category}
                    label={formatCategory(category)}
                    selected={preferenceForm.preferredCategories.includes(category)}
                    onPress={() =>
                      setPreferenceForm((current) => ({
                        ...current,
                        preferredCategories: toggleCategory(current.preferredCategories, category),
                      }))
                    }
                  />
                ))}
              </View>
            </FormRow>

            <View style={styles.inlineFieldRow}>
              <View style={styles.inlineField}>
                <Text style={styles.label}>Minimum duration</Text>
                <TextInput
                  style={styles.input}
                  value={String(preferenceForm.preferredDurationMin)}
                  onChangeText={(value) =>
                    setPreferenceForm((current) => ({
                      ...current,
                      preferredDurationMin: parseDuration(value, current.preferredDurationMin),
                    }))
                  }
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.gray}
                />
              </View>
              <View style={styles.inlineField}>
                <Text style={styles.label}>Maximum duration</Text>
                <TextInput
                  style={styles.input}
                  value={String(preferenceForm.preferredDurationMax)}
                  onChangeText={(value) =>
                    setPreferenceForm((current) => ({
                      ...current,
                      preferredDurationMax: parseDuration(value, current.preferredDurationMax),
                    }))
                  }
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.gray}
                />
              </View>
            </View>

            <ToggleRow
              label="Wellness interest"
              description="Bias toward recovery or wellness options when timing allows."
              value={preferenceForm.wellnessInterest}
              onValueChange={(value) =>
                setPreferenceForm((current) => ({ ...current, wellnessInterest: value }))
              }
            />

            <FormRow label="Additional notes">
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                value={preferenceForm.additionalNotes ?? ''}
                onChangeText={(value) =>
                  setPreferenceForm((current) => ({
                    ...current,
                    additionalNotes: value.trim() ? value : null,
                  }))
                }
                placeholder="Anything your concierge should keep in mind."
                placeholderTextColor={Colors.gray}
              />
            </FormRow>
          </SectionCard>

          <SectionCard
            title="Calendar"
            subtitle="Keep your schedule connected without leaving the app."
          >
            <CalendarConnectionsPanel
              connections={connections}
              onChanged={async () => {
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['calendar-connections'] }),
                  queryClient.invalidateQueries({ queryKey: ['today'] }),
                  queryClient.invalidateQueries({ queryKey: ['recommendations'] }),
                ]);
              }}
              title="Connections"
              subtitle="Google Calendar and Microsoft Outlook are both supported."
            />
          </SectionCard>

          <TouchableOpacity
            style={[styles.saveButton, saveMutation.isPending && styles.disabledButton]}
            disabled={saveMutation.isPending}
            onPress={() => saveMutation.mutate()}
          >
            <Text style={styles.saveButtonText}>
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              await logout();
              router.replace('/auth/login');
            }}
          >
            <Text style={styles.logoutButtonText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function FormRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.formRow}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.helperText}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.midGray, true: Colors.goldDark }}
        thumbColor={value ? Colors.gold : Colors.lightGray}
      />
    </View>
  );
}

function PreferencePill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, selected && styles.pillSelected]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatCategory(category: RecommendationCategory) {
  return category.replace(/_/g, ' ');
}

function toggleCategory(
  list: RecommendationCategory[],
  category: RecommendationCategory,
) {
  return list.includes(category)
    ? list.filter((item) => item !== category)
    : [...list, category];
}

function parseCommaList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDuration(value: string, fallback: number) {
  const parsed = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeOptionalString(value: string) {
  return value.trim() ? value.trim() : undefined;
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing[8],
  },
  loadingText: {
    color: Colors.lightGray,
    marginTop: Spacing[3],
  },
  errorText: {
    color: Colors.white,
    fontSize: Typography.fontSize.base,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing[6],
    paddingBottom: Spacing[12],
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing[5],
    marginBottom: Spacing[4],
    ...Shadow.sm,
  },
  sectionTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.lg,
    marginBottom: Spacing[1],
  },
  sectionSubtitle: {
    color: Colors.lightGray,
    fontSize: Typography.fontSize.sm,
    lineHeight: 20,
  },
  sectionBody: {
    marginTop: Spacing[5],
  },
  formRow: {
    marginBottom: Spacing[4],
  },
  label: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
    letterSpacing: Typography.letterSpacing.widest,
    textTransform: 'uppercase',
    marginBottom: Spacing[2],
  },
  input: {
    backgroundColor: Colors.charcoal,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    color: Colors.white,
    fontSize: Typography.fontSize.base,
  },
  helperText: {
    color: Colors.gray,
    fontSize: Typography.fontSize.xs,
    lineHeight: 18,
    marginTop: Spacing[2],
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[2],
  },
  pill: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.charcoal,
  },
  pillSelected: {
    borderColor: Colors.goldDark,
    backgroundColor: '#231B10',
  },
  pillText: {
    color: Colors.lightGray,
    fontSize: Typography.fontSize.sm,
  },
  pillTextSelected: {
    color: Colors.goldLight,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[4],
    marginBottom: Spacing[4],
  },
  toggleCopy: {
    flex: 1,
  },
  inlineFieldRow: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginBottom: Spacing[4],
  },
  inlineField: {
    flex: 1,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: Colors.gold,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing[4],
    alignItems: 'center',
    marginTop: Spacing[2],
  },
  saveButtonText: {
    color: Colors.black,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
  },
  logoutButton: {
    marginTop: Spacing[4],
    alignItems: 'center',
    paddingVertical: Spacing[4],
  },
  logoutButtonText: {
    color: Colors.gray,
    fontSize: Typography.fontSize.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
});
