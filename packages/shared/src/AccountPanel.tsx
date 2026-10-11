// Account: who is signed in, change your name, sign out. Opens as a full-screen panel.
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut, updateMyName } from './api';
import { formatPhone } from './format';
import { getSupabase } from './supabase';
import { theme } from './theme';
import { Button, Field, Notice, Text } from './ui';

export function AccountPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMessage(null);
    setError(null);
    (async () => {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return;
      setContact(user.phone ? formatPhone(`+${user.phone.replace(/^\+/, '')}`) : user.email ?? '');
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      setName(profile?.full_name ?? '');
      setSavedName(profile?.full_name ?? '');
    })().catch(() => setError('No connection. Check your data and try again.'));
  }, [visible]);

  async function save() {
    if (name.trim().length < 2) {
      setError('Enter the name your driver should ask for.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateMyName(name);
      setSavedName(name.trim());
      setMessage('Name saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text variant="xl" accessibilityRole="header">
              Your account
            </Text>
            <Button label="Close" variant="secondary" size="md" onPress={onClose} />
          </View>
          <View style={styles.card}>
            <Text variant="xs" color="text-muted">
              Signed in as
            </Text>
            <Text variant="base">{contact || '…'}</Text>
          </View>
          <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" error={error} hint="Your driver sees this name." />
          {message && <Notice>{message}</Notice>}
          <Button label="Save name" onPress={save} loading={busy} disabled={name.trim() === savedName} />
          <Button
            label="Sign out"
            variant="ghost"
            size="md"
            onPress={async () => {
              onClose();
              await signOut();
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.bg },
  body: { padding: theme.layout['phone-gutter'], gap: theme.space[4] },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space[3] },
  card: { backgroundColor: theme.color.surface, borderRadius: theme.radius.md, padding: theme.space[3], gap: theme.space[1] },
});
