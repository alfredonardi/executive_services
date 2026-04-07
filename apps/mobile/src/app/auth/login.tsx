import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';
import { Colors, Typography, Spacing } from '../../theme/tokens';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, requiresMfa } = useAuthStore();

  React.useEffect(() => {
    if (requiresMfa) {
      router.replace('/auth/mfa');
    }
  }, [requiresMfa]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }

    try {
      await login(email.trim().toLowerCase(), password);
      if (!requiresMfa) {
        router.replace('/tabs');
      }
    } catch {
      Alert.alert('Login Failed', 'Invalid credentials. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Logo / Brand */}
        <View style={styles.header}>
          <Text style={styles.brandLine}>EXECUTIVE</Text>
          <Text style={styles.brandName}>Concierge SP</Text>
          <Text style={styles.brandTagline}>São Paulo, at your service.</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={Colors.gray}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={Colors.gray}
            secureTextEntry
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Access is by invitation only. Contact your account manager.
        </Text>
      </View>
    </KeyboardAvoidingView>
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
    paddingBottom: Spacing[10],
  },
  header: {
    marginBottom: Spacing[12],
    alignItems: 'center',
  },
  brandLine: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.gold,
    letterSpacing: Typography.letterSpacing.widest,
    marginBottom: Spacing[1],
  },
  brandName: {
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.light,
    color: Colors.white,
    letterSpacing: Typography.letterSpacing.tight,
    marginBottom: Spacing[2],
  },
  brandTagline: {
    fontSize: Typography.fontSize.sm,
    color: Colors.lightGray,
    fontStyle: 'italic',
  },
  form: {
    marginBottom: Spacing[8],
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.lightGray,
    letterSpacing: Typography.letterSpacing.wider,
    marginBottom: Spacing[2],
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 4,
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[4],
    fontSize: Typography.fontSize.base,
    color: Colors.white,
    marginBottom: Spacing[5],
  },
  button: {
    backgroundColor: Colors.gold,
    borderRadius: 4,
    paddingVertical: Spacing[4],
    alignItems: 'center',
    marginTop: Spacing[2],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.black,
    letterSpacing: Typography.letterSpacing.wide,
  },
  footer: {
    textAlign: 'center',
    fontSize: Typography.fontSize.xs,
    color: Colors.gray,
    lineHeight: 18,
  },
});
