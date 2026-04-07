import React, { useState, useRef } from 'react';
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

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'agent';
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: Message = {
  id: '0',
  role: 'assistant',
  content:
    "Good morning. I'm your São Paulo concierge. How can I help you today? You can ask me about restaurants, local recommendations, schedule assistance, or any other arrangements you need.",
  timestamp: new Date(),
};

export default function ConciergeScreen() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // TODO: call API
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          "I'm looking into that for you. I'll have a recommendation ready shortly. Is there a specific neighborhood or time preference I should consider?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Concierge</Text>
        <View style={styles.statusDot} />
        <Text style={styles.headerStatus}>Available</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isTyping && <TypingIndicator />}
      </ScrollView>

      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask your concierge..."
          placeholderTextColor={Colors.gray}
          multiline
          maxLength={1000}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!input.trim()}
        >
          <Text style={styles.sendButtonText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isAgent = message.role === 'agent';

  return (
    <View style={[styles.messageBubble, isUser && styles.messageBubbleUser]}>
      {!isUser && (
        <Text style={styles.messageLabel}>{isAgent ? '● CONCIERGE' : '◆ AI'}</Text>
      )}
      <Text style={[styles.messageContent, isUser && styles.messageContentUser]}>
        {message.content}
      </Text>
      <Text style={styles.messageTime}>
        {message.timestamp.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Text>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.typingIndicator}>
      <ActivityIndicator size="small" color={Colors.gold} />
      <Text style={styles.typingText}>Thinking...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
    marginRight: 6,
  },
  headerStatus: {
    fontSize: Typography.fontSize.xs,
    color: Colors.lightGray,
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
    borderRadius2: 4,
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
