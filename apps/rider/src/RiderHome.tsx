// Decides what the rider sees: their name (first time), the booking flow, or their current trip.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, getSupabase, myActiveTrip, Notice, Text, theme, updateMyName } from '@juba/shared';
import { BookingFlow } from './BookingFlow';
import { TripScreen } from './TripScreen';

export function RiderHome({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [needsName, setNeedsName] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: profileError } = await getSupabase().from('profiles').select('full_name').eq('id', userId).maybeSingle();
      if (profileError) throw profileError;
      setNeedsName(!data?.full_name);
      setTripId(await myActiveTrip());
    } catch (e) {
      setError('No connection. Check your data and try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.color.accent} size="large" />
      </View>
    );
  }
  if (error) {
    return (
      <SafeAreaView style={styles.padded}>
        <Notice>{error}</Notice>
        <Button label="Try again" onPress={load} />
      </SafeAreaView>
    );
  }
  if (needsName) return <NameStep onDone={() => setNeedsName(false)} />;
  if (tripId) return <TripScreen tripId={tripId} onFinished={() => setTripId(null)} />;
  return <BookingFlow onBooked={setTripId} />;
}

function NameStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (name.trim().length < 2) {
      setError('Enter the name your driver should ask for.');
      return;
    }
    setBusy(true);
    try {
      await updateMyName(name);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={styles.padded}>
      <Text variant="xl" accessibilityRole="header">
        What's your name?
      </Text>
      <Text color="text-muted">Your driver sees this when they pick you up.</Text>
      <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={error} />
      <Button label="Continue" onPress={save} loading={busy} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
  padded: { flex: 1, backgroundColor: theme.color.bg, padding: theme.layout['phone-gutter'], gap: theme.space[4], paddingTop: theme.space[7] },
});
