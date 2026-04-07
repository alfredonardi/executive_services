import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';
import { Colors, Typography, Spacing } from '../../theme/tokens';

export default function MfaScreen() {
  const [code, setCode] = useState('');
  const { verifyMfa, isLoading } = useAuthStore();

  const handleVerify = async () => {
    if (code.length !== 6) {
      Alert.alert('Error', 'Please enter your 6-digit code');
      return;
    }

    try {
      await verifyMfa(code);
      router.replace('/tabs');
    } catch {
      Alert.alert('Verification Failed', 'Invalid code. Please try again.');
      setCode('');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Two-Factor Authentication</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code from your authenticator app.
        </Text>

        <TextInput
          style={styles.codeInput}
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          placeholderTextColor={Colors.gray}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={Colors.black} />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>← Back to login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing[8],
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
    marginBottom: Spacing[3],
  },
  subtitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
    marginBottom: Spacing[8],
    lineHeight: 20,
  },
  codeInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 4,
    paddingVertical: Spacing[5],
    paddingHorizontal: Spacing[4],
    fontSize: Typography.fontSize['2xl'],
    color: Colors.white,
    textAlign: 'center',
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom: Spacing[6],
  },
  button: {
    backgroundColor: Colors.gold,
    borderRadius: 4,
    paddingVertical: Spacing[4],
    alignItems: 'center',
    marginBottom: Spacing[6],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.black,
  },
  backLink: {
    textAlign: 'center',
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
  },
});
