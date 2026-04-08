import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Typography, Spacing } from '../../theme/tokens';
import {
  recommendationService,
  type RecommendationResult,
  type RecommendationResponse,
} from '../../services/recommendation.service';
import { requestService, type ApiRequest } from '../../services/request.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemState = 'idle' | 'requesting' | 'saving' | 'dismissing' | 'done_request' | 'done_save' | 'dismissed';

const CATEGORY_LABELS: Record<string, string> = {
  RESTAURANT: 'DINING',
  WELLNESS: 'WELLNESS',
  SHORT_EXPERIENCE: 'EXPERIENCE',
  BUSINESS_SUPPORT: 'BUSINESS',
  MICRO_EXPERIENCE: 'MICRO',
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RecommendationsScreen() {
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks per-item UI state (requesting, saved, dismissed, etc.)
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({});

  // Request confirmation sheet
  const [requestSheet, setRequestSheet] = useState<{
    rec: RecommendationResult;
    sessionId: string;
  } | null>(null);

  const setItemState = (catalogItemId: string, state: ItemState) =>
    setItemStates((prev) => ({ ...prev, [catalogItemId]: state }));

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    setItemStates({});

    try {
      const data = await recommendationService.getRecommendations();
      setResponse(data);
    } catch {
      setError('Could not load recommendations. Pull to refresh.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => void load(true);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleRequestThis = (rec: RecommendationResult) => {
    if (!response) return;
    setRequestSheet({ rec, sessionId: response.sessionId });
  };

  const handleSave = async (rec: RecommendationResult) => {
    if (!response) return;
    setItemState(rec.catalogItemId, 'saving');
    try {
      await recommendationService.submitFeedback(
        response.sessionId,
        rec.catalogItemId,
        'SAVED',
      );
      setItemState(rec.catalogItemId, 'done_save');
    } catch {
      setItemState(rec.catalogItemId, 'idle');
    }
  };

  const handleDismiss = async (rec: RecommendationResult) => {
    if (!response) return;
    setItemState(rec.catalogItemId, 'dismissing');
    try {
      await recommendationService.submitFeedback(
        response.sessionId,
        rec.catalogItemId,
        'DISMISSED',
      );
      setItemState(rec.catalogItemId, 'dismissed');
    } catch {
      setItemState(rec.catalogItemId, 'idle');
    }
  };

  const onRequestCreated = (_req: ApiRequest, catalogItemId: string, sessionId: string) => {
    // Record ACTED feedback
    void recommendationService
      .submitFeedback(sessionId, catalogItemId, 'ACTED')
      .catch(() => undefined);
    setItemState(catalogItemId, 'done_request');
    setRequestSheet(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const visibleRecs = response?.recommendations.filter(
    (r) => itemStates[r.catalogItemId] !== 'dismissed',
  ) ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>For You</Text>
        <Text style={styles.headerSubtitle}>
          {response
            ? `Curated for today's schedule · ${response.scheduleDensity} day`
            : 'Curated for today's schedule'}
        </Text>
      </View>

      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.gold} />
          <Text style={styles.loadingText}>Loading recommendations…</Text>
        </View>
      )}

      {!isLoading && error && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !error && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={Colors.gold}
            />
          }
        >
          {visibleRecs.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No recommendations right now</Text>
              <Text style={styles.emptySubtitle}>
                Connect your calendar to get personalised suggestions based on your schedule.
              </Text>
            </View>
          )}

          {visibleRecs.map((rec) => (
            <RecommendationCard
              key={rec.catalogItemId}
              rec={rec}
              state={itemStates[rec.catalogItemId] ?? 'idle'}
              onRequestThis={() => handleRequestThis(rec)}
              onSave={() => void handleSave(rec)}
              onDismiss={() => void handleDismiss(rec)}
            />
          ))}

          <View style={{ height: Spacing[8] }} />
        </ScrollView>
      )}

      {/* Request creation sheet */}
      <Modal
        visible={requestSheet !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRequestSheet(null)}
      >
        {requestSheet && (
          <RequestFromRecSheet
            rec={requestSheet.rec}
            sessionId={requestSheet.sessionId}
            onClose={() => setRequestSheet(null)}
            onCreated={(req) =>
              onRequestCreated(req, requestSheet.rec.catalogItemId, requestSheet.sessionId)
            }
          />
        )}
      </Modal>
    </View>
  );
}

// ─── Recommendation card ──────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  state,
  onRequestThis,
  onSave,
  onDismiss,
}: {
  rec: RecommendationResult;
  state: ItemState;
  onRequestThis: () => void;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const durationLabel =
    rec.estimatedDurationMinutes >= 60
      ? `${Math.round(rec.estimatedDurationMinutes / 60)}h`
      : `${rec.estimatedDurationMinutes} min`;

  const priceLabel = rec.priceLevel > 0 ? '$'.repeat(rec.priceLevel) : '';

  const reasonSummary =
    rec.reasons.length > 0
      ? rec.reasons[0]?.detail ?? rec.reasons[0]?.label ?? ''
      : 'Curated for you';

  const requestedAlready = state === 'done_request';
  const savedAlready = state === 'done_save';

  return (
    <View style={styles.card}>
      {/* Category badge */}
      <View style={styles.categoryBadge}>
        <Text style={styles.categoryText}>
          {CATEGORY_LABELS[rec.category] ?? rec.category}
        </Text>
      </View>

      {/* Title */}
      <Text style={styles.cardTitle}>{rec.title}</Text>

      {/* Meta */}
      <Text style={styles.cardMeta}>
        {[rec.neighborhood, durationLabel, priceLabel].filter(Boolean).join(' · ')}
      </Text>

      {/* Summary */}
      <Text style={styles.cardDescription}>{rec.summary}</Text>

      {/* Why this */}
      {reasonSummary.length > 0 && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>WHY THIS</Text>
          <Text style={styles.reasonText}>{reasonSummary}</Text>
        </View>
      )}

      {/* Actions */}
      {requestedAlready ? (
        <View style={styles.confirmedBanner}>
          <Text style={styles.confirmedText}>✓ Request submitted to your concierge</Text>
        </View>
      ) : savedAlready ? (
        <View style={[styles.confirmedBanner, { backgroundColor: '#0D1F0D' }]}>
          <Text style={[styles.confirmedText, { color: Colors.success }]}>✓ Saved</Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionPrimary, state === 'requesting' && styles.actionDisabled]}
            onPress={onRequestThis}
            disabled={state !== 'idle'}
          >
            {state === 'requesting' ? (
              <ActivityIndicator color={Colors.black} size="small" />
            ) : (
              <Text style={styles.actionPrimaryText}>Request this</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionSecondary, state === 'saving' && styles.actionDisabled]}
            onPress={onSave}
            disabled={state !== 'idle'}
          >
            {state === 'saving' ? (
              <ActivityIndicator color={Colors.lightGray} size="small" />
            ) : (
              <Text style={styles.actionSecondaryText}>Save</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionSecondary, state === 'dismissing' && styles.actionDisabled]}
            onPress={onDismiss}
            disabled={state !== 'idle'}
          >
            {state === 'dismissing' ? (
              <ActivityIndicator color={Colors.lightGray} size="small" />
            ) : (
              <Text style={styles.actionSecondaryText}>Dismiss</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─── Request from rec sheet ───────────────────────────────────────────────────

function RequestFromRecSheet({
  rec,
  sessionId,
  onClose,
  onCreated,
}: {
  rec: RecommendationResult;
  sessionId: string;
  onClose: () => void;
  onCreated: (r: ApiRequest) => void;
}) {
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const defaultTitle = `Book: ${rec.title}`;

  const submit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const created = await requestService.createFromRecommendation({
        catalogItemId: rec.catalogItemId,
        title: defaultTitle,
        description:
          message.trim() ||
          `I'd like to proceed with: ${rec.title}. ${rec.summary}`,
        timeWindowContext:
          rec.suitableWindows.length > 0
            ? `Suitable windows: ${rec.suitableWindows.join(', ')}`
            : undefined,
      });
      onCreated(created);
    } catch {
      setSubmitError('Could not submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.sheetContainer}
    >
      <View style={styles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetCategory}>
            {CATEGORY_LABELS[rec.category] ?? rec.category}
          </Text>
          <Text style={styles.sheetTitle} numberOfLines={2}>
            {rec.title}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.sheetClose}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
        <Text style={styles.sheetDescription}>{rec.summary}</Text>

        {rec.neighborhood && (
          <Text style={styles.sheetMeta}>
            {rec.neighborhood} · {'$'.repeat(rec.priceLevel)}
          </Text>
        )}

        <Text style={styles.fieldLabel}>ANY MESSAGE FOR YOUR CONCIERGE? (OPTIONAL)</Text>
        <TextInput
          style={[styles.fieldInput, styles.fieldInputMulti]}
          value={message}
          onChangeText={setMessage}
          placeholder="E.g. I'd prefer a private room, dinner for 2, around 8pm…"
          placeholderTextColor={Colors.gray}
          multiline
          maxLength={1000}
          textAlignVertical="top"
        />

        {submitError && <Text style={styles.submitError}>{submitError}</Text>}

        <TouchableOpacity
          style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.black} size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit to Concierge</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: Spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: Spacing[8],
  },
  loadingText: { marginTop: Spacing[3], fontSize: Typography.fontSize.sm, color: Colors.gray },
  errorText: { fontSize: Typography.fontSize.sm, color: Colors.error, textAlign: 'center', marginBottom: Spacing[4] },
  retryBtn: { backgroundColor: Colors.surface, borderRadius: 8, paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderWidth: 1, borderColor: Colors.border },
  retryBtnText: { fontSize: Typography.fontSize.sm, color: Colors.gold },

  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
    marginBottom: 4,
  },
  headerSubtitle: { fontSize: Typography.fontSize.sm, color: Colors.lightGray },

  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing[6], gap: Spacing[4] },

  emptyState: { alignItems: 'center', paddingTop: Spacing[12] },
  emptyTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.light, color: Colors.white, marginBottom: Spacing[2] },
  emptySubtitle: { fontSize: Typography.fontSize.sm, color: Colors.gray, textAlign: 'center', lineHeight: 20 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing[5],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.midGray,
    borderRadius: 4,
    paddingHorizontal: Spacing[2],
    paddingVertical: 2,
    marginBottom: Spacing[3],
  },
  categoryText: { fontSize: 10, fontWeight: Typography.fontWeight.semibold, color: Colors.gold, letterSpacing: Typography.letterSpacing.wider },
  cardTitle: { fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.medium, color: Colors.white, marginBottom: 4 },
  cardMeta: { fontSize: Typography.fontSize.xs, color: Colors.gray, marginBottom: Spacing[3] },
  cardDescription: { fontSize: Typography.fontSize.sm, color: Colors.lightGray, lineHeight: 20, marginBottom: Spacing[4] },

  reasonBox: { backgroundColor: Colors.charcoal, borderRadius: 8, padding: Spacing[3], marginBottom: Spacing[4] },
  reasonLabel: { fontSize: 10, fontWeight: Typography.fontWeight.semibold, color: Colors.gold, letterSpacing: Typography.letterSpacing.wider, marginBottom: 4 },
  reasonText: { fontSize: Typography.fontSize.xs, color: Colors.lightGray, lineHeight: 18, fontStyle: 'italic' },

  actions: { flexDirection: 'row', gap: Spacing[2] },
  actionPrimary: { flex: 1, backgroundColor: Colors.gold, borderRadius: 6, paddingVertical: Spacing[3], alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  actionPrimaryText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.black },
  actionSecondary: { paddingHorizontal: Spacing[3], paddingVertical: Spacing[3], borderRadius: 6, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', minHeight: 38 },
  actionSecondaryText: { fontSize: Typography.fontSize.sm, color: Colors.lightGray },
  actionDisabled: { opacity: 0.5 },

  confirmedBanner: { backgroundColor: '#0D1A00', borderRadius: 8, padding: Spacing[3], alignItems: 'center' },
  confirmedText: { fontSize: Typography.fontSize.xs, color: Colors.gold, fontWeight: Typography.fontWeight.medium },

  sheetContainer: { flex: 1, backgroundColor: Colors.background },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: Spacing[6],
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetCategory: { fontSize: 10, fontWeight: Typography.fontWeight.semibold, color: Colors.gold, letterSpacing: 1.5, marginBottom: 4 },
  sheetTitle: { fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.light, color: Colors.white },
  sheetClose: { fontSize: Typography.fontSize.lg, color: Colors.gray, paddingTop: 4 },
  sheetBody: { flex: 1, padding: Spacing[6] },
  sheetDescription: { fontSize: Typography.fontSize.sm, color: Colors.offWhite, lineHeight: 20, marginBottom: Spacing[2] },
  sheetMeta: { fontSize: Typography.fontSize.xs, color: Colors.gray, marginBottom: Spacing[5] },

  fieldLabel: { fontSize: 10, fontWeight: Typography.fontWeight.semibold, color: Colors.gray, letterSpacing: 1.5, marginBottom: Spacing[2], marginTop: Spacing[4] },
  fieldInput: { backgroundColor: Colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], fontSize: Typography.fontSize.sm, color: Colors.white },
  fieldInputMulti: { minHeight: 100, paddingTop: Spacing[3] },
  submitError: { fontSize: Typography.fontSize.xs, color: Colors.error, marginTop: Spacing[3] },
  submitBtn: { backgroundColor: Colors.gold, borderRadius: 8, paddingVertical: Spacing[4], alignItems: 'center', marginTop: Spacing[6] },
  submitBtnDisabled: { backgroundColor: Colors.midGray },
  submitBtnText: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, color: Colors.black },
});
