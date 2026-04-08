import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors, Typography, Spacing } from '../../theme/tokens';
import { ShellHeaderActions } from '../../components/shell-header-actions';
import {
  conciergeService,
  type ApiMessage,
  type ConversationStatus,
} from '../../services/concierge.service';

// ─── State types ──────────────────────────────────────────────────────────────

interface LocalMessage {
  id: string;
  role: 'USER' | 'AI' | 'AGENT';
  content: string;
  createdAt: string;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ConciergeScreen() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('ACTIVE');
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // ── Load or create conversation on mount ──────────────────────────────────

  const initConversation = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Resume the most recent active conversation, or create a new one
      const list = await conciergeService.listConversations();
      const active = list.find((c) => c.status === 'ACTIVE' || c.status === 'HUMAN_HANDOFF');

      if (active) {
        const detail = await conciergeService.getConversation(active.id);
        setConversationId(detail.id);
        setConversationStatus(detail.status);
        setMessages(detail.messages.map(apiToLocal));
      } else {
        const created = await conciergeService.createConversation();
        setConversationId(created.id);
        setConversationStatus(created.status);
        setMessages([]);
      }
    } catch (err) {
      setError('Could not connect to your concierge. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void initConversation();
  }, [initConversation]);

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || isSending) return;

    const content = input.trim();
    setInput('');
    setError(null);

    // Optimistic: show user message immediately
    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: LocalMessage = {
      id: optimisticId,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setIsSending(true);

    try {
      const result = await conciergeService.sendMessage(conversationId, content);

      // Replace optimistic with persisted user message + append AI reply
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== optimisticId)
          .concat([apiToLocal(result.userMessage), apiToLocal(result.aiReply)]),
      );

      // If AI suggests handoff, surface it but don't auto-trigger
      if (result.shouldSuggestHandoff) {
        // The AI message already contains the appropriate language — no extra UI needed
      }
    } catch {
      // Remove optimistic message and show error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // ── Retry on error ────────────────────────────────────────────────────────

  const retry = () => {
    void initConversation();
  };

  // ── Header status label ───────────────────────────────────────────────────

  const statusLabel =
    conversationStatus === 'HUMAN_HANDOFF' ? 'With Concierge' : 'Available';
  const statusColor =
    conversationStatus === 'HUMAN_HANDOFF' ? Colors.gold : Colors.success;

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.loadingText}>Connecting to concierge…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Concierge</Text>
          <ShellHeaderActions />
        </View>
        <View style={styles.headerStatusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={styles.headerStatus}>{statusLabel}</Text>
        </View>
      </View>

      {/* Error banner */}
      {error && (
        <TouchableOpacity style={styles.errorBanner} onPress={retry}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      )}

      {/* Handoff notice */}
      {conversationStatus === 'HUMAN_HANDOFF' && (
        <View style={styles.handoffBanner}>
          <Text style={styles.handoffText}>
            A concierge agent is reviewing your conversation.
          </Text>
        </View>
      )}

      {/* Empty state */}
      {messages.length === 0 && !isLoading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Good day.</Text>
          <Text style={styles.emptyStateSubtitle}>
            I'm your São Paulo concierge. Ask me about restaurants, local recommendations,
            schedule assistance, or any other arrangements.
          </Text>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isSending && <TypingIndicator />}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask your concierge…"
          placeholderTextColor={Colors.gray}
          multiline
          maxLength={1000}
          editable={!isSending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={Colors.black} />
          ) : (
            <Text style={styles.sendButtonText}>→</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: LocalMessage }) {
  const isUser = message.role === 'USER';
  const isAgent = message.role === 'AGENT';

  const time = new Date(message.createdAt).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[styles.messageBubble, isUser && styles.messageBubbleUser]}>
      {!isUser && (
        <Text style={[styles.messageLabel, isAgent && styles.messageLabelAgent]}>
          {isAgent ? '● CONCIERGE' : '◆ AI'}
        </Text>
      )}
      <Text style={[styles.messageContent, isUser && styles.messageContentUser]}>
        {message.content}
      </Text>
      <Text style={styles.messageTime}>{time}</Text>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.typingIndicator}>
      <ActivityIndicator size="small" color={Colors.gold} />
      <Text style={styles.typingText}>Thinking…</Text>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiToLocal(msg: ApiMessage): LocalMessage {
  return {
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.createdAt,
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing[3],
    fontSize: Typography.fontSize.sm,
    color: Colors.gray,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: Spacing[6],
    paddingBottom: Spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
    flex: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing[4],
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing[3],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  headerStatus: {
    fontSize: Typography.fontSize.xs,
    color: Colors.lightGray,
  },
  errorBanner: {
    backgroundColor: '#3A1515',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#5A2020',
  },
  errorText: {
    fontSize: Typography.fontSize.xs,
    color: '#E57373',
  },
  retryText: {
    fontSize: Typography.fontSize.xs,
    color: '#E57373',
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  handoffBanner: {
    backgroundColor: '#1A1500',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: '#3A2F00',
  },
  handoffText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gold,
  },
  emptyState: {
    padding: Spacing[6],
    paddingTop: Spacing[8],
  },
  emptyStateTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
    marginBottom: Spacing[2],
  },
  emptyStateSubtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray,
    lineHeight: 20,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing[4],
    paddingBottom: Spacing[6],
  },
  messageBubble: {
    maxWidth: '80%',
    marginBottom: Spacing[4],
    padding: Spacing[4],
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  messageBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.midGray,
  },
  messageLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gold,
    letterSpacing: 1,
    marginBottom: 6,
  },
  messageLabelAgent: {
    color: '#A3C9A8',
  },
  messageContent: {
    fontSize: Typography.fontSize.sm,
    color: Colors.offWhite,
    lineHeight: 20,
  },
  messageContentUser: {
    color: Colors.white,
  },
  messageTime: {
    fontSize: 10,
    color: Colors.gray,
    marginTop: 6,
    textAlign: 'right',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[4],
  },
  typingText: {
    marginLeft: Spacing[2],
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
    fontStyle: 'italic',
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.charcoal,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    fontSize: Typography.fontSize.sm,
    color: Colors.white,
    marginRight: Spacing[2],
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.border,
  },
  sendButtonText: {
    fontSize: Typography.fontSize.lg,
    color: Colors.black,
    fontWeight: Typography.fontWeight.bold,
  },
});
