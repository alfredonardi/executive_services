'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, type AdminConversationSummary, type ConversationStatus } from '../../lib/api';

const STATUS_COLORS: Record<ConversationStatus, string> = {
  ACTIVE: '#4CAF50',
  HUMAN_HANDOFF: '#C9A96E',
  RESOLVED: '#1976D2',
  ARCHIVED: '#5A5A5A',
};

const STATUS_LABELS: Record<ConversationStatus, string> = {
  ACTIVE: 'Active',
  HUMAN_HANDOFF: 'Awaiting Agent',
  RESOLVED: 'Resolved',
  ARCHIVED: 'Archived',
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<AdminConversationSummary[]>([]);
  const [filter, setFilter] = useState<ConversationStatus | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    adminApi
      .listConversations(filter)
      .then(setConversations)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load conversations'),
      )
      .finally(() => setIsLoading(false));
  }, [filter]);

  return (
    <div style={styles.page}>
      {/* Sidebar */}
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
                ...(item.href === '/conversations' ? styles.navLinkActive : {}),
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Conversations</h1>
            <p style={styles.pageSubtitle}>Active chats and handoff queue</p>
          </div>
        </header>

        {/* Filter bar */}
        <div style={styles.filterBar}>
          {([undefined, 'HUMAN_HANDOFF', 'ACTIVE', 'RESOLVED'] as (ConversationStatus | undefined)[]).map(
            (s) => (
              <button
                key={s ?? 'all'}
                onClick={() => setFilter(s)}
                style={{
                  ...styles.filterBtn,
                  ...(filter === s ? styles.filterBtnActive : {}),
                }}
              >
                {s ? STATUS_LABELS[s] : 'All'}
              </button>
            ),
          )}
        </div>

        {/* Content */}
        {isLoading && (
          <div style={styles.stateBox}>
            <p style={styles.stateText}>Loading…</p>
          </div>
        )}

        {!isLoading && error && (
          <div style={styles.errorBox}>
            <p style={styles.stateText}>{error}</p>
            <p style={{ fontSize: 12, color: '#9A9A9A', marginTop: 8 }}>
              Make sure you are logged in and the API is running.
            </p>
          </div>
        )}

        {!isLoading && !error && conversations.length === 0 && (
          <div style={styles.stateBox}>
            <p style={styles.stateText}>No conversations found.</p>
          </div>
        )}

        {!isLoading && !error && conversations.length > 0 && (
          <div style={styles.section}>
            <div style={styles.tableHeader}>
              <span style={{ flex: 2 }}>CLIENT</span>
              <span style={{ flex: 2 }}>TITLE</span>
              <span style={{ flex: 1 }}>STATUS</span>
              <span style={{ flex: 1 }}>AGENT</span>
              <span style={{ flex: 1 }}>MESSAGES</span>
              <span style={{ flex: 1 }}>UPDATED</span>
            </div>
            {conversations.map((conv) => (
              <Link key={conv.id} href={`/conversations/${conv.id}`} style={styles.tableRow}>
                <span style={{ flex: 2 }}>
                  <span style={styles.clientName}>
                    {conv.user.firstName} {conv.user.lastName}
                  </span>
                  {conv.user.company && (
                    <span style={styles.clientCompany}>{conv.user.company}</span>
                  )}
                </span>
                <span style={{ flex: 2, color: '#E8E5E0', fontSize: 13 }}>
                  {conv.title ?? 'Conversation'}
                </span>
                <span style={{ flex: 1 }}>
                  <StatusBadge status={conv.status} />
                </span>
                <span style={{ flex: 1, color: '#9A9A9A', fontSize: 13 }}>
                  {conv.assignedAgent
                    ? `${conv.assignedAgent.firstName} ${conv.assignedAgent.lastName}`
                    : '—'}
                </span>
                <span style={{ flex: 1, color: '#9A9A9A', fontSize: 13 }}>
                  {conv._count.messages}
                </span>
                <span style={{ flex: 1, color: '#5A5A5A', fontSize: 13 }}>
                  {formatRelative(conv.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: ConversationStatus }) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 6px',
        borderRadius: 4,
        border: '1px solid',
        letterSpacing: 0.5,
        borderColor: STATUS_COLORS[status],
        color: STATUS_COLORS[status],
      }}
    >
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

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh', backgroundColor: '#0A0A0A' },
  sidebar: {
    width: 220,
    backgroundColor: '#141414',
    borderRight: '1px solid #2C2C2C',
    padding: '24px 0',
    flexShrink: 0,
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
  },
  sidebarBrand: { padding: '0 20px 24px', borderBottom: '1px solid #2C2C2C', marginBottom: 8 },
  brandAccent: { display: 'block', fontSize: 10, fontWeight: 600, color: '#C9A96E', letterSpacing: 2, marginBottom: 4 },
  brandName: { display: 'block', fontSize: 16, fontWeight: 300, color: '#FFFFFF', marginBottom: 6 },
  brandBadge: { display: 'inline-block', fontSize: 10, backgroundColor: '#2C2C2C', color: '#9A9A9A', padding: '2px 8px', borderRadius: 4 },
  nav: { display: 'flex', flexDirection: 'column', padding: '8px 0' },
  navLink: { display: 'block', padding: '10px 20px', color: '#9A9A9A', textDecoration: 'none', fontSize: 14 },
  navLinkActive: { color: '#C9A96E', backgroundColor: '#1A1A00' },
  main: { marginLeft: 220, flex: 1, padding: 32 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #2C2C2C' },
  pageTitle: { fontSize: 28, fontWeight: 300, color: '#FFFFFF', margin: 0, marginBottom: 4 },
  pageSubtitle: { fontSize: 13, color: '#9A9A9A', margin: 0 },
  filterBar: { display: 'flex', gap: 8, marginBottom: 24 },
  filterBtn: { padding: '6px 16px', borderRadius: 6, border: '1px solid #3A3A3A', backgroundColor: 'transparent', color: '#9A9A9A', fontSize: 13, cursor: 'pointer' },
  filterBtnActive: { borderColor: '#C9A96E', color: '#C9A96E', backgroundColor: '#1A1400' },
  section: { backgroundColor: '#141414', borderRadius: 10, border: '1px solid #2C2C2C', overflow: 'hidden' },
  tableHeader: { display: 'flex', padding: '10px 24px', fontSize: 10, fontWeight: 600, color: '#5A5A5A', letterSpacing: 1, borderBottom: '1px solid #2C2C2C' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #1E1E1E', textDecoration: 'none', cursor: 'pointer' },
  clientName: { display: 'block', fontSize: 13, color: '#E8E5E0', fontWeight: 500 },
  clientCompany: { display: 'block', fontSize: 11, color: '#9A9A9A', marginTop: 2 },
  stateBox: { padding: 48, textAlign: 'center' },
  errorBox: { padding: 48, textAlign: 'center', backgroundColor: '#1A0A0A', borderRadius: 10, border: '1px solid #3A1515' },
  stateText: { color: '#9A9A9A', fontSize: 14, margin: 0 },
};
