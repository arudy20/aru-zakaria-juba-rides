// S01 Sign up / phone verification — shared by the rider and driver apps.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { devEmailSignIn, sendPhoneCode, verifyPhoneCode } from './api';
import { formatPhone, normaliseSouthSudanPhone } from './format';
import { devEmailLogin } from './supabase';
import { theme } from './theme';
import { Button, Field, Text } from './ui';

export function SignInScreen({ appName, subtitle }: { appName: string; subtitle: string }) {
  const [mode, setMode] = useState<'phone' | 'code' | 'email'>(devEmailLogin ? 'email' : 'phone');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      const normalised = normaliseSouthSudanPhone(phoneInput);
      if (!normalised) throw new Error('Enter a 9-digit South Sudan number, like 912 345 678.');
      await sendPhoneCode(normalised);
      setPhone(normalised);
      setMode('code');
    });

  const checkCode = () =>
    run(async () => {
      if (!phone) return;
      if (code.trim().length < 6) throw new Error('Enter the 6-digit code from the SMS.');
      await verifyPhoneCode(phone, code.trim());
    });

  const emailSignIn = () =>
    run(async () => {
      if (!email.includes('@') || password.length < 6) throw new Error('Enter an email and a password of at least 6 characters.');
      await devEmailSignIn(email.trim(), password);
    });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text variant="xl" accessibilityRole="header">
              {appName}
            </Text>
            <Text color="text-muted">{subtitle}</Text>
          </View>

          {mode === 'phone' && (
            <View style={styles.form}>
              <Field
                label="Phone number"
                value={phoneInput}
                onChangeText={setPhoneInput}
                placeholder="912 345 678"
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                error={error}
                hint="We'll send you a 6-digit code by SMS. South Sudan numbers only for now."
              />
              <Button label="Send code" onPress={sendCode} loading={busy} />
              {devEmailLogin && <Button label="Use email instead (testing)" variant="ghost" size="md" onPress={() => setMode('email')} />}
            </View>
          )}

          {mode === 'code' && (
            <View style={styles.form}>
              <Text>Enter the code we sent to {formatPhone(phone)}.</Text>
              <Field
                label="6-digit code"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="sms-otp"
                textContentType="oneTimeCode"
                maxLength={6}
                error={error}
              />
              <Button label="Continue" onPress={checkCode} loading={busy} />
              <Button label="Send a new code" variant="ghost" size="md" onPress={sendCode} disabled={busy} />
              <Button label="Change number" variant="ghost" size="md" onPress={() => { setMode('phone'); setCode(''); setError(null); }} />
            </View>
          )}

          {mode === 'email' && (
            <View style={styles.form}>
              <Text color="text-muted" variant="sm">
                Testing sign-in. Phone sign-in replaces this once an SMS provider is connected.
              </Text>
              <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry error={error} hint="New email? An account is created for you." />
              <Button label="Sign in" onPress={emailSignIn} loading={busy} />
              <Button label="Use phone number" variant="ghost" size="md" onPress={() => { setMode('phone'); setError(null); }} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bg },
  flex: { flex: 1 },
  body: { padding: theme.layout['phone-gutter'], paddingTop: theme.space[7], gap: theme.space[6] },
  header: { gap: theme.space[2] },
  form: { gap: theme.space[4] },
});
