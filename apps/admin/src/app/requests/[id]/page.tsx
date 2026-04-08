'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  adminApi,
  type AdminRequestDetail,
  type RequestStatus,
  type RequestPriority,
} from '../../../lib/api';

const STATUS_COLORS: Record<RequestStatus, string> = {
  PENDING: '#5A5A5A',
  ACKNOWLEDGED: '#1976D2',
  IN_PROGRESS: '#C9A96E',
  COMPLETED: '#4CAF50',
  CANCELLED: '#E53935',
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Pending',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const ALL_STATUSES: RequestStatus[] = ['PENDING', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const requestId = params.id;

  const [request, setRequest] = useState<AdminRequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status update form
  const [newStatus, setNewStatus] = useState<RequestStatus | ''>('');
  const [statusNotes, setStatusNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Agent assignment form
  const [agentId, setAgentId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) return;
    setIsLoading(true);
    adminApi
      .getRequest(requestId)
      .then((data) => {
        setRequest(data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load request');
        setIsLoading(false);
      });
  }, [requestId]);

  const handleUpdateStatus = async () => {
    if (!newStatus || !requestId) return;
    setIsUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(false);
    try {
      await adminApi.updateRequestStatus(requestId, newStatus, statusNotes || undefined);
      // Refresh
      const updated = await adminApi.getRequest(requestId);
      setRequest(updated);
      setNewStatus('');
      setStatusNotes('');
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssign = async () => {
    if (!agentId.trim() || !requestId) return;
    setIsAssigning(true);
    setAssignError(null);
    try {
      await adminApi.assignRequest(requestId, agentId.trim());
      const updated = await adminApi.getRequest(requestId);
      setRequest(updated);
      setAgentId('');
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : 'Failed to assign agent');
    } finally {
      setIsAssigning(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div style={styles.stateBox}><p style={styles.stateText}>Loading…</p></div>
      </Layout>
    );
  }

  if (error || !request) {
    return (
      <Layout>
        <div style={{ ...styles.stateBox, backgroundColor: '#1A0A0A', borderRadius: 10, border: '1px solid #3A1515' }}>
          <p style={styles.stateText}>{error ?? 'Request not found'}</p>
          <Link href="/requests" style={{ color: '#C9A96E', fontSize: 13, marginTop: 12, display: 'block' }}>
            ← Back to requests
          </Link>
        </div>
      </Layout>
    );
  }

  const { user } = request;
  const currentStatusColor = STATUS_COLORS[request.status];

  return (
    <Layout>
      {/* Header */}
      <div style={styles.pageHeader}>
        <Link href="/requests" style={styles.backLink}>← Requests</Link>
        <h1 style={styles.pageTitle}>{request.title}</h1>
        <div style={styles.metaRow}>
          <StatusBadge status={request.status} />
          <span style={{ ...styles.priorityTag, color: priorityColor(request.priority) }}>
            {request.priority}
          </span>
          {request.category && (
            <span style={styles.categoryTag}>{request.category}</span>
          )}
        </div>
      </div>

      <div style={styles.grid}>
        {/* Left: request details */}
        <div style={styles.main}>

          {/* Description */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Description</h3>
            <p style={styles.descText}>{request.description}</p>
          </div>

          {/* Status history */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Status History</h3>
            {request.statusUpdates.length === 0 ? (
              <p style={styles.stateText}>No history yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {request.statusUpdates.map((upd) => (
                  <div key={upd.id} style={styles.historyRow}>
                    <div style={{ ...styles.historyDot, backgroundColor: STATUS_COLORS[upd.status] ?? '#5A5A5A' }} />
                    <div>
                      <span style={{ ...styles.historyStatus, color: STATUS_COLORS[upd.status] ?? '#5A5A5A' }}>
                        {STATUS_LABELS[upd.status] ?? upd.status}
                      </span>
                      <span style={styles.historyTime}>{formatDate(upd.createdAt)}</span>
                      {upd.notes && <p style={styles.historyNote}>{upd.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked conversation */}
          {request.conversation && (
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Linked Conversation</h3>
              <Link href={`/conversations/${request.conversation.id}`} style={styles.convLink}>
                {request.conversation.title ?? `Conversation ${request.conversation.id.slice(0, 8)}`}
                <span style={{ color: STATUS_COLORS[request.conversation.status as RequestStatus] ?? '#9A9A9A', fontSize: 11, marginLeft: 8 }}>
                  {request.conversation.status}
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Right: sidebar */}
        <div style={styles.sidebar2}>

          {/* Client info */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Client</h3>
            <p style={styles.sidebarValue}>{user.firstName} {user.lastName}</p>
            {user.title && <p style={styles.sidebarMeta}>{user.title}</p>}
            {user.company && <p style={styles.sidebarMeta}>{user.company}</p>}
            {user.nationality && <p style={styles.sidebarMeta}>{user.nationality}</p>}
          </div>

          {/* Dates */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Timeline</h3>
            <Row label="Created" value={formatDate(request.createdAt)} />
            {request.dueAt && <Row label="Due" value={formatDate(request.dueAt)} />}
            {request.completedAt && <Row label="Completed" value={formatDate(request.completedAt)} />}
          </div>

          {/* Assigned agent */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Assigned Agent</h3>
            {request.assignedAgent ? (
              <p style={styles.sidebarValue}>
                {request.assignedAgent.firstName} {request.assignedAgent.lastName}
              </p>
            ) : (
              <p style={styles.sidebarMeta}>Unassigned</p>
            )}

            <div style={{ marginTop: 12 }}>
              <input
                style={styles.input}
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="Agent user ID"
              />
              {assignError && <p style={styles.errorMsg}>{assignError}</p>}
              <button
                style={{ ...styles.btn, marginTop: 8, opacity: isAssigning || !agentId.trim() ? 0.5 : 1 }}
                onClick={handleAssign}
                disabled={isAssigning || !agentId.trim()}
              >
                {isAssigning ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>

          {/* Update status */}
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Update Status</h3>
            <select
              style={styles.select}
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as RequestStatus | '')}
            >
              <option value="">Select new status…</option>
              {ALL_STATUSES.filter((s) => s !== request.status).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>

            <textarea
              style={{ ...styles.input, minHeight: 70, marginTop: 8, resize: 'vertical' }}
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="Optional note for client or team…"
            />

            {updateError && <p style={styles.errorMsg}>{updateError}</p>}
            {updateSuccess && <p style={{ ...styles.errorMsg, color: '#4CAF50' }}>Status updated.</p>}

            <button
              style={{ ...styles.btn, marginTop: 8, opacity: isUpdating || !newStatus ? 0.5 : 1 }}
              onClick={handleUpdateStatus}
              disabled={isUpdating || !newStatus}
            >
              {isUpdating ? 'Updating…' : 'Update Status'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 6px',
      borderRadius: 4, border: '1px solid', letterSpacing: 0.5,
      borderColor: STATUS_COLORS[status], color: STATUS_COLORS[status],
    }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: '#5A5A5A' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#9A9A9A' }}>{value}</span>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0A0A0A' }}>
      <aside style={styles.sidebar}>
        <div style={styles.sidebarBrand}>
          <span style={styles.brandAccent}>EXECUTIVE</span>
          <span style={styles.brandName}>Concierge SP</span>
          <span style={styles.brandBadge}>Admin</span>
        </div>
        <nav style={styles.nav}>
          {[
            { href: '/dashboard', label: 'Dashboard' },
            { href: '/conversations', label: 'Conversations' },
            { href: '/requests', label: 'Requests' },
            { href: '/users', label: 'Users' },
            { href: '/settings', label: 'Settings' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...styles.navLink,
                ...(item.href === '/requests' ? styles.navLinkActive : {}),
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main style={{ marginLeft: 220, flex: 1, padding: 32 }}>{children}</main>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priorityColor(p: RequestPriority): string {
  const map: Record<RequestPriority, string> = { LOW: '#5A5A5A', NORMAL: '#9A9A9A', HIGH: '#C9A96E', URGENT: '#E53935' };
  return map[p] ?? '#9A9A9A';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: { width: 220, backgroundColor: '#141414', borderRight: '1px solid #2C2C2C', padding: '24px 0', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh' },
  sidebarBrand: { padding: '0 20px 24px', borderBottom: '1px solid #2C2C2C', marginBottom: 8 },
  brandAccent: { display: 'block', fontSize: 10, fontWeight: 600, color: '#C9A96E', letterSpacing: 2, marginBottom: 4 },
  brandName: { display: 'block', fontSize: 16, fontWeight: 300, color: '#FFFFFF', marginBottom: 6 },
  brandBadge: { display: 'inline-block', fontSize: 10, backgroundColor: '#2C2C2C', color: '#9A9A9A', padding: '2px 8px', borderRadius: 4 },
  nav: { display: 'flex', flexDirection: 'column', padding: '8px 0' },
  navLink: { display: 'block', padding: '10px 20px', color: '#9A9A9A', textDecoration: 'none', fontSize: 14 },
  navLinkActive: { color: '#C9A96E', backgroundColor: '#1A1400' },

  pageHeader: { marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid #2C2C2C' },
  backLink: { fontSize: 13, color: '#9A9A9A', textDecoration: 'none', display: 'block', marginBottom: 12 },
  pageTitle: { fontSize: 24, fontWeight: 300, color: '#FFFFFF', margin: 0, marginBottom: 12 },
  metaRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  priorityTag: { fontSize: 11, fontWeight: 600, letterSpacing: 0.5 },
  categoryTag: { fontSize: 10, color: '#9A9A9A', backgroundColor: '#2C2C2C', padding: '2px 8px', borderRadius: 4 },

  grid: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 },
  main: { display: 'flex', flexDirection: 'column', gap: 20 },
  sidebar2: { display: 'flex', flexDirection: 'column', gap: 16 },

  card: { backgroundColor: '#141414', border: '1px solid #2C2C2C', borderRadius: 10, padding: '16px 20px' },
  cardTitle: { fontSize: 11, fontWeight: 600, color: '#5A5A5A', letterSpacing: 1, margin: 0, marginBottom: 12 },
  descText: { fontSize: 14, color: '#E8E5E0', lineHeight: '1.6', margin: 0 },

  historyRow: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  historyDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4 },
  historyStatus: { fontSize: 12, fontWeight: 600, marginRight: 8 },
  historyTime: { fontSize: 11, color: '#5A5A5A' },
  historyNote: { fontSize: 12, color: '#9A9A9A', marginTop: 4, fontStyle: 'italic', margin: 0 },

  convLink: { fontSize: 13, color: '#C9A96E', textDecoration: 'none' },

  sidebarValue: { fontSize: 14, color: '#E8E5E0', margin: 0, marginBottom: 4 },
  sidebarMeta: { fontSize: 12, color: '#9A9A9A', margin: 0, marginBottom: 2 },

  input: {
    width: '100%', backgroundColor: '#0A0A0A', border: '1px solid #2C2C2C',
    borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#E8E5E0',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  },
  select: {
    width: '100%', backgroundColor: '#0A0A0A', border: '1px solid #2C2C2C',
    borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#E8E5E0',
    outline: 'none', fontFamily: 'inherit',
  },
  btn: {
    width: '100%', padding: '8px 0', backgroundColor: '#C9A96E', color: '#0A0A0A',
    border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  errorMsg: { fontSize: 12, color: '#E57373', margin: '6px 0 0' },
  stateBox: { padding: 48, textAlign: 'center' },
  stateText: { color: '#9A9A9A', fontSize: 14, margin: 0 },
};
