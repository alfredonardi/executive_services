import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors, Typography, Spacing } from '../../theme/tokens';
import {
  requestService,
  type ApiRequest,
  type ApiRequestDetail,
  type RequestStatus,
} from '../../services/request.service';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RequestStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: Colors.gray },
  ACKNOWLEDGED: { label: 'Acknowledged', color: Colors.info },
  IN_PROGRESS: { label: 'In Progress', color: Colors.gold },
  COMPLETED: { label: 'Completed', color: Colors.success },
  CANCELLED: { label: 'Cancelled', color: Colors.error },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RequestsScreen() {
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create request modal
  const [createVisible, setCreateVisible] = useState(false);

  // Detail modal
  const [detailRequest, setDetailRequest] = useState<ApiRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const data = await requestService.listRequests();
      setRequests(data);
    } catch {
      setError('Could not load requests. Pull to refresh.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => void load(true);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await requestService.getRequest(id);
      setDetailRequest(detail);
    } catch {
      // silently ignore — card still shows summary
    } finally {
      setDetailLoading(false);
    }
  };

  const onRequestCreated = (newRequest: ApiRequest) => {
    setRequests((prev) => [newRequest, ...prev]);
    setCreateVisible(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const active = requests.filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED');
  const closed = requests.filter((r) => r.status === 'COMPLETED' || r.status === 'CANCELLED');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Requests</Text>
        <TouchableOpacity style={styles.newButton} onPress={() => setCreateVisible(true)}>
          <Text style={styles.newButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Loading */}
      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.gold} />
          <Text style={styles.loadingText}>Loading requests…</Text>
        </View>
      )}

      {/* Content */}
      {!isLoading && (
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
          {requests.length === 0 && !error && <EmptyState onNew={() => setCreateVisible(true)} />}

          {active.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ACTIVE</Text>
              {active.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  onPress={() => void openDetail(req.id)}
                />
              ))}
            </>
          )}

          {closed.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: Spacing[4] }]}>COMPLETED</Text>
              {closed.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  onPress={() => void openDetail(req.id)}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Detail modal */}
      <Modal
        visible={detailRequest !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailRequest(null)}
      >
        {detailRequest && (
          <RequestDetailSheet
            request={detailRequest}
            onClose={() => setDetailRequest(null)}
          />
        )}
      </Modal>

      {/* Create modal */}
      <Modal
        visible={createVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateVisible(false)}
      >
        <CreateRequestSheet
          onClose={() => setCreateVisible(false)}
          onCreated={onRequestCreated}
        />
      </Modal>

      {/* Detail loading overlay */}
      {detailLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      )}
    </View>
  );
}

// ─── Request card ─────────────────────────────────────────────────────────────

function RequestCard({ request, onPress }: { request: ApiRequest; onPress: () => void }) {
  const cfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.PENDING;
  const time = formatRelative(request.updatedAt);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { borderColor: cfg.color }]}>
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <Text style={styles.timeText}>{time}</Text>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {request.title}
      </Text>

      <View style={styles.cardFooter}>
        <Text style={styles.priorityText}>{request.priority}</Text>
        {request.category && (
          <Text style={styles.categoryChip}>{request.category}</Text>
        )}
        <Text style={styles.arrowText}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Request detail sheet ─────────────────────────────────────────────────────

function RequestDetailSheet({
  request,
  onClose,
}: {
  request: ApiRequestDetail;
  onClose: () => void;
}) {
  const cfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.PENDING;

  return (
    <View style={styles.sheetContainer}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle} numberOfLines={2}>
          {request.title}
        </Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.sheetClose}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
        {/* Status + meta */}
        <View style={styles.detailMeta}>
          <View style={[styles.statusBadge, { borderColor: cfg.color }]}>
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.detailMetaText}>{request.priority} priority</Text>
          {request.category && (
            <Text style={styles.detailMetaText}>{request.category}</Text>
          )}
        </View>

        {/* Description */}
        <Text style={styles.detailSectionLabel}>DESCRIPTION</Text>
        <Text style={styles.detailDescription}>{request.description}</Text>

        {/* Timestamps */}
        <Text style={styles.detailSectionLabel}>TIMELINE</Text>
        <View style={styles.timelineBox}>
          <Text style={styles.timelineItem}>
            Created: {formatDate(request.createdAt)}
          </Text>
          {request.dueAt && (
            <Text style={styles.timelineItem}>Due: {formatDate(request.dueAt)}</Text>
          )}
          {request.completedAt && (
            <Text style={styles.timelineItem}>
              Completed: {formatDate(request.completedAt)}
            </Text>
          )}
        </View>

        {/* Status history */}
        {request.statusUpdates.length > 0 && (
          <>
            <Text style={styles.detailSectionLabel}>STATUS HISTORY</Text>
            {request.statusUpdates.map((upd) => {
              const updCfg = STATUS_CONFIG[upd.status] ?? STATUS_CONFIG.PENDING;
              return (
                <View key={upd.id} style={styles.historyRow}>
                  <View style={[styles.historyDot, { backgroundColor: updCfg.color }]} />
                  <View style={styles.historyContent}>
                    <Text style={[styles.historyStatus, { color: updCfg.color }]}>
                      {updCfg.label}
                    </Text>
                    <Text style={styles.historyTime}>{formatDate(upd.createdAt)}</Text>
                    {upd.notes && (
                      <Text style={styles.historyNote}>{upd.notes}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: Spacing[8] }} />
      </ScrollView>
    </View>
  );
}

// ─── Create request sheet ─────────────────────────────────────────────────────

function CreateRequestSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (r: ApiRequest) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = title.trim().length >= 3 && description.trim().length >= 10;

  const submit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const created = await requestService.createRequest({
        title: title.trim(),
        description: description.trim(),
      });
      onCreated(created);
    } catch {
      setSubmitError('Could not create request. Please try again.');
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
        <Text style={styles.sheetTitle}>New Request</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.sheetClose}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>TITLE</Text>
        <TextInput
          style={styles.fieldInput}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Book table at Maní for Friday 8pm"
          placeholderTextColor={Colors.gray}
          maxLength={200}
          returnKeyType="next"
        />

        <Text style={styles.fieldLabel}>DETAILS</Text>
        <TextInput
          style={[styles.fieldInput, styles.fieldInputMulti]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what you need, any preferences, timing or context…"
          placeholderTextColor={Colors.gray}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />

        {submitError && <Text style={styles.submitError}>{submitError}</Text>}

        <TouchableOpacity
          style={[styles.submitBtn, (!canSubmit || isSubmitting) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.black} size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Request</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: Spacing[8] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>No requests yet</Text>
      <Text style={styles.emptyStateSubtitle}>
        Tap New to submit a request to your concierge team, or use "Request this" from a
        recommendation.
      </Text>
      <TouchableOpacity style={styles.emptyStateBtn} onPress={onNew}>
        <Text style={styles.emptyStateBtnText}>Create your first request</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing[8] },
  loadingText: { marginTop: Spacing[3], fontSize: Typography.fontSize.sm, color: Colors.gray },

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

  errorBanner: {
    backgroundColor: '#1A0808',
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#3A1515',
  },
  errorText: { fontSize: Typography.fontSize.xs, color: Colors.error },

  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing[6], gap: Spacing[3] },

  sectionLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gray,
    letterSpacing: 1.5,
    marginBottom: Spacing[2],
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing[3],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],
  },
  statusBadge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: Spacing[2], paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: Typography.fontWeight.semibold, letterSpacing: 0.5 },
  timeText: { fontSize: Typography.fontSize.xs, color: Colors.gray },
  cardTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.white,
    lineHeight: 20,
    marginBottom: Spacing[3],
  },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  priorityText: { fontSize: Typography.fontSize.xs, color: Colors.gray },
  categoryChip: {
    fontSize: 10,
    color: Colors.lightGray,
    backgroundColor: Colors.midGray,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  arrowText: { color: Colors.gold, fontSize: Typography.fontSize.sm, marginLeft: 'auto' },

  emptyState: { alignItems: 'center', paddingTop: Spacing[12], paddingHorizontal: Spacing[6] },
  emptyStateTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
    marginBottom: Spacing[2],
  },
  emptyStateSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing[6],
  },
  emptyStateBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 8,
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[3],
  },
  emptyStateBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.black,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Sheet ──
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
  sheetTitle: {
    flex: 1,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
    paddingRight: Spacing[4],
  },
  sheetClose: { fontSize: Typography.fontSize.lg, color: Colors.gray, paddingTop: 4 },
  sheetBody: { flex: 1, padding: Spacing[6] },

  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], marginBottom: Spacing[5] },
  detailMetaText: { fontSize: Typography.fontSize.xs, color: Colors.lightGray },
  detailSectionLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gray,
    letterSpacing: 1.5,
    marginBottom: Spacing[2],
    marginTop: Spacing[4],
  },
  detailDescription: {
    fontSize: Typography.fontSize.sm,
    color: Colors.offWhite,
    lineHeight: 20,
  },

  timelineBox: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: Spacing[4],
    gap: Spacing[2],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timelineItem: { fontSize: Typography.fontSize.xs, color: Colors.lightGray },

  historyRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing[3] },
  historyDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, marginRight: Spacing[3] },
  historyContent: { flex: 1 },
  historyStatus: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold },
  historyTime: { fontSize: 10, color: Colors.gray, marginTop: 2 },
  historyNote: { fontSize: Typography.fontSize.xs, color: Colors.lightGray, marginTop: 4, fontStyle: 'italic' },

  fieldLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gray,
    letterSpacing: 1.5,
    marginBottom: Spacing[2],
    marginTop: Spacing[4],
  },
  fieldInput: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
  },
  fieldInputMulti: { minHeight: 120, paddingTop: Spacing[3] },
  submitError: { fontSize: Typography.fontSize.xs, color: Colors.error, marginTop: Spacing[3] },
  submitBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 8,
    paddingVertical: Spacing[4],
    alignItems: 'center',
    marginTop: Spacing[6],
  },
  submitBtnDisabled: { backgroundColor: Colors.midGray },
  submitBtnText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.black,
  },
});
