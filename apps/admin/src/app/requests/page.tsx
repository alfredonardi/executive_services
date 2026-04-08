'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, type AdminRequestSummary, type RequestStatus, type RequestPriority } from '../../lib/api';

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

const PRIORITY_COLORS: Record<RequestPriority, string> = {
  LOW: '#5A5A5A',
  NORMAL: '#9A9A9A',
  HIGH: '#C9A96E',
  URGENT: '#E53935',
};

type FilterStatus = RequestStatus | undefined;

export default function RequestsPage() {
  const [requests, setRequests] = useState<AdminRequestSummary[]>([]);
  const [filter, setFilter] = useState<FilterStatus>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    adminApi
      .listRequests(filter)
      .then(setRequests)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load requests'),
      )
      .finally(() => setIsLoading(false));
  }, [filter]);

  const filters: { label: string; value: FilterStatus }[] = [
    { label: 'All', value: undefined },
    { label: 'Pending', value: 'PENDING' },
    { label: 'In Progress', value: 'IN_PROGRESS' },
    { label: 'Completed', value: 'COMPLETED' },
  ];

  return (
    <div style={styles.page}>
      <Sidebar />

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Requests</h1>
            <p style={styles.pageSubtitle}>Operational concierge request queue</p>
          </div>
        </header>

        {/* Filter bar */}
        <div style={styles.filterBar}>
          {filters.map((f) => (
            <button
              key={f.label}
              onClick={() => setFilter(f.value)}
              style={{
                ...styles.filterBtn,
                ...(filter === f.value ? styles.filterBtnActive : {}),
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading && (
          <div style={styles.stateBox}>
            <p style={styles.stateText}>Loading…</p>
          </div>
        )}

        {!isLoading && error && (
          <div style={{ ...styles.stateBox, ...styles.errorBox }}>
            <p style={styles.stateText}>{error}</p>
          </div>
        )}

        {!isLoading && !error && requests.length === 0 && (
          <div style={styles.stateBox}>
            <p style={styles.stateText}>No requests found.</p>
          </div>
        )}

        {!isLoading && !error && requests.length > 0 && (
          <div style={styles.section}>
            <div style={styles.tableHeader}>
              <span style={{ flex: 3 }}>REQUEST</span>
              <span style={{ flex: 1 }}>CLIENT</span>
              <span style={{ flex: 1 }}>STATUS</span>
              <span style={{ flex: 1 }}>PRIORITY</span>
              <span style={{ flex: 1 }}>AGENT</span>
              <span style={{ flex: 1 }}>UPDATED</span>
            </div>
            {requests.map((req) => (
              <Link key={req.id} href={`/requests/${req.id}`} style={styles.tableRow}>
                <span style={{ flex: 3 }}>
                  <span style={styles.requestTitle}>{req.title}</span>
                  {req.category && (
                    <span style={styles.categoryChip}>{req.category}</span>
                  )}
                </span>
                <span style={{ flex: 1 }}>
                  <span style={styles.clientName}>
                    {req.user.firstName} {req.user.lastName}
                  </span>
                  {req.user.company && (
                    <span style={styles.clientCompany}>{req.user.company}</span>
                  )}
                </span>
                <span style={{ flex: 1 }}>
                  <StatusBadge status={req.status} />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ ...styles.priorityLabel, color: PRIORITY_COLORS[req.priority] }}>
                    {req.priority}
                  </span>
                </span>
                <span style={{ flex: 1, color: '#9A9A9A', fontSize: 13 }}>
                  {req.assignedAgent
                    ? `${req.assignedAgent.firstName} ${req.assignedAgent.lastName}`
                    : <span style={{ color: '#5A5A5A' }}>Unassigned</span>}
                </span>
                <span style={{ flex: 1, color: '#5A5A5A', fontSize: 13 }}>
                  {formatRelative(req.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 10, fontWeight: 600, padding: '2px 6px',
      borderRadius: 4, border: '1px solid', letterSpacing: 0.5,
      borderColor: STATUS_COLORS[status], color: STATUS_COLORS[status],
    }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Sidebar() {
  return (
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
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh', backgroundColor: '#0A0A0A' },
  sidebar: { width: 220, backgroundColor: '#141414', borderRight: '1px solid #2C2C2C', padding: '24px 0', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh' },
  sidebarBrand: { padding: '0 20px 24px', borderBottom: '1px solid #2C2C2C', marginBottom: 8 },
  brandAccent: { display: 'block', fontSize: 10, fontWeight: 600, color: '#C9A96E', letterSpacing: 2, marginBottom: 4 },
  brandName: { display: 'block', fontSize: 16, fontWeight: 300, color: '#FFFFFF', marginBottom: 6 },
  brandBadge: { display: 'inline-block', fontSize: 10, backgroundColor: '#2C2C2C', color: '#9A9A9A', padding: '2px 8px', borderRadius: 4 },
  nav: { display: 'flex', flexDirection: 'column', padding: '8px 0' },
  navLink: { display: 'block', padding: '10px 20px', color: '#9A9A9A', textDecoration: 'none', fontSize: 14 },
  navLinkActive: { color: '#C9A96E', backgroundColor: '#1A1400' },
  main: { marginLeft: 220, flex: 1, padding: 32 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #2C2C2C' },
  pageTitle: { fontSize: 28, fontWeight: 300, color: '#FFFFFF', margin: 0, marginBottom: 4 },
  pageSubtitle: { fontSize: 13, color: '#9A9A9A', margin: 0 },
  filterBar: { display: 'flex', gap: 8, marginBottom: 24 },
  filterBtn: { padding: '6px 16px', borderRadius: 6, border: '1px solid #3A3A3A', backgroundColor: 'transparent', color: '#9A9A9A', fontSize: 13, cursor: 'pointer' },
  filterBtnActive: { borderColor: '#C9A96E', color: '#C9A96E', backgroundColor: '#1A1400' },
  section: { backgroundColor: '#141414', borderRadius: 10, border: '1px solid #2C2C2C', overflow: 'hidden' },
  tableHeader: { display: 'flex', padding: '10px 24px', fontSize: 10, fontWeight: 600, color: '#5A5A5A', letterSpacing: 1, borderBottom: '1px solid #2C2C2C' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid #1E1E1E', textDecoration: 'none', cursor: 'pointer' },
  requestTitle: { display: 'block', fontSize: 13, color: '#E8E5E0', fontWeight: 500 },
  categoryChip: { display: 'inline-block', fontSize: 10, color: '#9A9A9A', backgroundColor: '#2C2C2C', padding: '1px 6px', borderRadius: 3, marginTop: 4, marginLeft: 6 },
  clientName: { display: 'block', fontSize: 13, color: '#E8E5E0' },
  clientCompany: { display: 'block', fontSize: 11, color: '#9A9A9A', marginTop: 2 },
  priorityLabel: { fontSize: 11, fontWeight: 600, letterSpacing: 0.5 },
  stateBox: { padding: 48, textAlign: 'center' },
  errorBox: { backgroundColor: '#1A0A0A', borderRadius: 10, border: '1px solid #3A1515' },
  stateText: { color: '#9A9A9A', fontSize: 14, margin: 0 },
};
