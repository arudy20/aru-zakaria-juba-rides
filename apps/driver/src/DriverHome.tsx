// Routes a driver to the right screen: apply, waiting for approval, online/offline, or their current trip.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  applyAsDriver,
  Button,
  Field,
  myActiveTrip,
  myDriverStatus,
  Notice,
  OptionCard,
  signOut,
  Text,
  theme,
  vehicleLabel,
  type DriverStatusInfo,
  type VehicleClass,
} from '@juba/shared';
import { OnlineScreen } from './OnlineScreen';
import { DriverTrip } from './DriverTrip';

export function DriverHome() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DriverStatusInfo | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await myDriverStatus();
      setStatus(s);
      if (s?.status === 'approved') setTripId(await myActiveTrip());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

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
  if (!status) return <ApplyScreen onApplied={load} />;
  if (status.status === 'pending') {
    return (
      <SafeAreaView style={styles.padded}>
        <Text variant="xl" accessibilityRole="header">
          Application received
        </Text>
        <Text>
          We're checking your details. Once you're approved, you can go online and start receiving trips. Our team will call you to
          arrange a document check.
        </Text>
        {status.vehicle && (
          <Notice>
            {`${status.vehicle.colour} ${status.vehicle.make} ${status.vehicle.model} · ${status.vehicle.plate} · ${vehicleLabel[status.vehicle.class]}`}
          </Notice>
        )}
        <Button label="Check again" onPress={load} />
        <Button label="Sign out" variant="ghost" size="md" onPress={signOut} />
      </SafeAreaView>
    );
  }
  if (status.status === 'suspended') {
    return (
      <SafeAreaView style={styles.padded}>
        <Text variant="xl" accessibilityRole="header">
          Your account is paused
        </Text>
        <Text>You can't go online right now. Please contact the Juba Rides team to talk it through.</Text>
        <Button label="Sign out" variant="ghost" size="md" onPress={signOut} />
      </SafeAreaView>
    );
  }
  if (tripId) return <DriverTrip tripId={tripId} onFinished={() => setTripId(null)} />;
  return <OnlineScreen driver={status} onTripAccepted={setTripId} />;
}

function ApplyScreen({ onApplied }: { onApplied: () => void }) {
  const [fullName, setFullName] = useState('');
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>('car');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [colour, setColour] = useState('');
  const [plate, setPlate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (fullName.trim().length < 2 || !make.trim() || !model.trim() || !colour.trim() || plate.trim().length < 3) {
      setError('Fill in your name and all vehicle details.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await applyAsDriver({ fullName, vehicleClass, make, model, colour, plate });
      onApplied();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text variant="xl" accessibilityRole="header">
          Drive with Juba Rides
        </Text>
        <Text color="text-muted">Tell us about you and your vehicle. Document upload comes next.</Text>
        <Field label="Your full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
        <Text variant="sm" style={styles.bold}>
          Vehicle type
        </Text>
        <View accessibilityRole="radiogroup" style={styles.options}>
          {(['car', 'tuk_tuk'] as VehicleClass[]).map((v) => (
            <OptionCard key={v} selected={vehicleClass === v} onPress={() => setVehicleClass(v)} label={vehicleLabel[v]}>
              <Text>{vehicleLabel[v]}</Text>
            </OptionCard>
          ))}
        </View>
        <Field label="Make" value={make} onChangeText={setMake} placeholder="Toyota" />
        <Field label="Model" value={model} onChangeText={setModel} placeholder="Corolla" />
        <Field label="Colour" value={colour} onChangeText={setColour} placeholder="White" />
        <Field label="Number plate" value={plate} onChangeText={setPlate} autoCapitalize="characters" placeholder="CES 4821" error={error} />
        <Button label="Send application" onPress={submit} loading={busy} />
        <Button label="Sign out" variant="ghost" size="md" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg },
  safe: { flex: 1, backgroundColor: theme.color.bg },
  padded: { flex: 1, backgroundColor: theme.color.bg, padding: theme.layout['phone-gutter'], gap: theme.space[4], paddingTop: theme.space[7] },
  form: { padding: theme.layout['phone-gutter'], gap: theme.space[4], paddingTop: theme.space[6] },
  options: { flexDirection: 'row', gap: theme.space[2] },
  bold: { fontFamily: 'AtkinsonHyperlegible_700Bold' },
});
