'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  adminApi,
  type AdminConversationDetail,
  type AdminMessage,
  type ConversationStatus,
} from '../../../lib/api';

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

const ROLE_LABELS: Record<string, string> = {
  USER: 'Client',
  AI: 'AI Concierge',
  AGENT: 'Agent',
};

const ROLE_COLORS: Record<string, string> = {
  USER: '#E8E5E0',
  AI: '#C9A96E',
  AGENT: '#A3C9A8',
};

export default function ConversationThreadPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;

  const [conversation, setConversation] = useState<AdminConversationDetail | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) return;
    setIsLoading(true);
    adminApi
      .getConversation(conversationId)
      .then((data) => {
        setConversation(data);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
        setIsLoading(false);
      });
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const sendReply = async () => {
    if (!replyContent.trim() || !conversationId || isSending) return;
    setSendError(null);
    setIsSending(true);
    const content = replyContent.trim();
    setReplyContent('');

    try {
      const message = await adminApi.sendAgentMessage(conversationId, content);
      setConversation((prev) =>
        prev ? { ...prev, messages: [...prev.messages, message] } : prev,
      );
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send reply');
      setReplyContent(content); // restore so agent can retry
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      void sendReply();
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div style={styles.stateBox}>
          <p style={styles.stateText}>Loading conversation…</p>
        </div>
      </Layout>
    );
  }

  if (error || !conversation) {
    return (
      <Layout>
        <div style={{ ...styles.stateBox, backgroundColor: '#1A0A0A', borderRadius: 10, border: '1px solid #3A1515' }}>
          <p style={styles.stateText}>{error ?? 'Conversation not found'}</p>
          <Link href="/conversations" style={{ color: '#C9A96E', fontSize: 13, marginTop: 12, display: 'block' }}>
            ← Back to conversations
          </Link>
        </div>
      </Layout>
    );
  }

  const { user } = conversation;

  return (
    <Layout>
      {/* Page header */}
      <div style={styles.threadHeader}>
        <Link href="/conversations" style={styles.backLink}>← Conversations</Link>
        <div style={styles.threadMeta}>
          <h1 style={styles.threadTitle}>
            {conversation.title ?? `Conversation with ${user.firstName}`}
          </h1>
          <div style={styles.threadMetaRow}>
            <span style={{ ...styles.statusBadge, borderColor: STATUS_COLORS[conversation.status], color: STATUS_COLORS[conversation.status] }}>
              {STATUS_LABELS[conversation.status]}
            </span>
            <span style={styles.metaItem}>
              {user.firstName} {user.lastName}
              {user.company ? ` · ${user.company}` : ''}
              {user.nationality ? ` · ${user.nationality}` : ''}
            </span>
            {conversation.assignedAgent && (
              <span style={styles.metaItem}>
                Assigned: {conversation.assignedAgent.firstName} {conversation.assignedAgent.lastName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Thread */}
      <div style={styles.thread}>
        {conversation.messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply form */}
      <div style={styles.replyForm}>
        {sendError && (
          <p style={styles.sendError}>{sendError}</p>
        )}
        <textarea
          style={styles.replyInput}
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your reply… (Cmd+Enter to send)"
          rows={4}
          disabled={isSending}
        />
        <div style={styles.replyActions}>
          <span style={styles.replyHint}>Cmd+Enter to send</span>
          <button
            style={{
              ...styles.replyBtn,
              ...((!replyContent.trim() || isSending) ? styles.replyBtnDisabled : {}),
            }}
            onClick={sendReply}
            disabled={!replyContent.trim() || isSending}
          >
            {isSending ? 'Sending…' : 'Send as Agent'}
          </button>
        </div>
      </div>
    </Layout>
  );
}

function MessageRow({ message }: { message: AdminMessage }) {
  const isUser = message.role === 'USER';
  const label = ROLE_LABELS[message.role] ?? message.role;
  const color = ROLE_COLORS[message.role] ?? '#E8E5E0';
  const time = new Date(message.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      style={{
        ...styles.messageRow,
        ...(isUser ? styles.messageRowUser : {}),
      }}
    >
      <div style={styles.messageMeta}>
        <span style={{ ...styles.messageRole, color }}>{label}</span>
        <span style={styles.messageTime}>{time}</span>
      </div>
      <div style={{ ...styles.messageBubble, ...(isUser ? styles.messageBubbleUser : {}) }}>
        {message.content}
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={styles.page}>
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
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh', backgroundColor: '#0A0A0A' },
  sidebar: {
    width: 220, backgroundColor: '#141414', borderRight: '1px solid #2C2C2C',
    padding: '24px 0', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh',
  },
  sidebarBrand: { padding: '0 20px 24px', borderBottom: '1px solid #2C2C2C', marginBottom: 8 },
  brandAccent: { display: 'block', fontSize: 10, fontWeight: 600, color: '#C9A96E', letterSpacing: 2, marginBottom: 4 },
  brandName: { display: 'block', fontSize: 16, fontWeight: 300, color: '#FFFFFF', marginBottom: 6 },
  brandBadge: { display: 'inline-block', fontSize: 10, backgroundColor: '#2C2C2C', color: '#9A9A9A', padding: '2px 8px', borderRadius: 4 },
  nav: { display: 'flex', flexDirection: 'column', padding: '8px 0' },
  navLink: { display: 'block', padding: '10px 20px', color: '#9A9A9A', textDecoration: 'none', fontSize: 14 },
  navLinkActive: { color: '#C9A96E', backgroundColor: '#1A1A00' },
  main: { marginLeft: 220, flex: 1, padding: 32, display: 'flex', flexDirection: 'column', maxHeight: '100vh', overflow: 'hidden' },

  threadHeader: { paddingBottom: 20, borderBottom: '1px solid #2C2C2C', marginBottom: 0, flexShrink: 0 },
  backLink: { fontSize: 13, color: '#9A9A9A', textDecoration: 'none', display: 'block', marginBottom: 12 },
  threadTitle: { fontSize: 22, fontWeight: 300, color: '#FFFFFF', margin: 0, marginBottom: 8 },
  threadMeta: {},
  threadMetaRow: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  statusBadge: { fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, border: '1px solid', letterSpacing: 0.5 },
  metaItem: { fontSize: 13, color: '#9A9A9A' },

  thread: {
    flex: 1, overflowY: 'auto', padding: '24px 0',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  messageRow: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '75%' },
  messageRowUser: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  messageMeta: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 },
  messageRole: { fontSize: 11, fontWeight: 600, letterSpacing: 0.5 },
  messageTime: { fontSize: 11, color: '#5A5A5A' },
  messageBubble: {
    backgroundColor: '#1E1E1E', border: '1px solid #2C2C2C',
    borderRadius: 10, padding: '12px 16px',
    fontSize: 14, color: '#E8E5E0', lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  },
  messageBubbleUser: { backgroundColor: '#141414', borderColor: '#3A3A3A' },

  replyForm: {
    flexShrink: 0, borderTop: '1px solid #2C2C2C',
    paddingTop: 20, marginTop: 0,
  },
  replyInput: {
    width: '100%', backgroundColor: '#141414', border: '1px solid #2C2C2C',
    borderRadius: 8, padding: '12px 16px', fontSize: 14, color: '#E8E5E0',
    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  replyActions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  replyHint: { fontSize: 12, color: '#5A5A5A' },
  replyBtn: {
    padding: '8px 20px', backgroundColor: '#C9A96E', color: '#0A0A0A',
    border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  replyBtnDisabled: { backgroundColor: '#3A3A3A', color: '#6A6A6A', cursor: 'not-allowed' },
  sendError: { fontSize: 12, color: '#E57373', marginBottom: 8 },
  stateBox: { padding: 48, textAlign: 'center' },
  stateText: { color: '#9A9A9A', fontSize: 14, margin: 0 },
};
