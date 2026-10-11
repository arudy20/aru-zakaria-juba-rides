// S11 To pickup and trip: navigate, mark arrived, start, complete and collect cash.
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  cancelTrip,
  driverUpdateTrip,
  DriverDot,
  DropoffPin,
  FareDisplay,
  fareNumber,
  formatPhone,
  Notice,
  PickupPin,
  Sheet,
  Text,
  theme,
  useLiveTrip,
  baseMapType,
  MapAttribution,
  MapTiles,
} from '@juba/shared';
import { useHeartbeat } from './useHeartbeat';

export function DriverTrip({ tripId, onFinished }: { tripId: string; onFinished: () => void }) {
  const { trip, error, refresh } = useLiveTrip(tripId, 6000);
  const { position, problem } = useHeartbeat(true); // keep sharing location with the rider during the trip
  const mapRef = useRef<MapView>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'cancel' | 'complete' | null>(null);

  useEffect(() => {
    if (!trip) return;
    const target =
      trip.status === 'in_progress'
        ? { latitude: trip.dropoff_lat, longitude: trip.dropoff_lng }
        : { latitude: trip.pickup_lat, longitude: trip.pickup_lng };
    const points = [target, ...(position ? [{ latitude: position.lat, longitude: position.lng }] : [])];
    mapRef.current?.fitToCoordinates(points, { edgePadding: { top: 80, right: 60, bottom: 80, left: 60 }, animated: true });
  }, [trip?.status, position != null]);

  async function act(action: 'arrived' | 'start' | 'complete') {
    setBusy(true);
    setActionError(null);
    try {
      await driverUpdateTrip(tripId, action);
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function cancel() {
    setBusy(true);
    setActionError(null);
    try {
      await cancelTrip(tripId, 'Driver cancelled');
      onFinished();
    } catch (e) {
      setActionError((e as Error).message);
      setBusy(false);
      setConfirm(null);
    }
  }

  function navigate(lat: number, lng: number) {
    const url = Platform.OS === 'android' ? `google.navigation:q=${lat},${lng}` : `maps://?daddr=${lat},${lng}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`));
  }

  if (!trip) {
    return (
      <SafeAreaView style={styles.padded}>
        {error ? (
          <>
            <Notice>{error}</Notice>
            <Button label="Try again" onPress={refresh} />
          </>
        ) : (
          <Text color="text-muted">Loading trip…</Text>
        )}
      </SafeAreaView>
    );
  }

  // The rider cancelled, or the trip went back to searching after a cancel.
  if (trip.my_role !== 'driver' || trip.status === 'cancelled_by_rider') {
    return (
      <SafeAreaView style={styles.padded}>
        <Text variant="xl" accessibilityRole="header">
          The rider cancelled this trip
        </Text>
        <Button label="Back to requests" onPress={onFinished} />
      </SafeAreaView>
    );
  }

  const fare = `${fareNumber(trip.fare_minor)} ${trip.currency}`;
  const toPickup = trip.status === 'assigned' || trip.status === 'arrived';

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          mapType={baseMapType}
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: trip.pickup_lat, longitude: trip.pickup_lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          toolbarEnabled={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <MapTiles />
          {toPickup && (
            <Marker coordinate={{ latitude: trip.pickup_lat, longitude: trip.pickup_lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <PickupPin />
            </Marker>
          )}
          <Marker coordinate={{ latitude: trip.dropoff_lat, longitude: trip.dropoff_lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <DropoffPin />
          </Marker>
          {position && (
            <Marker coordinate={{ latitude: position.lat, longitude: position.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <DriverDot />
            </Marker>
          )}
        </MapView>
        <MapAttribution />
        {(error || problem) && (
          <SafeAreaView edges={['top']} style={styles.top}>
            <Notice>{problem ?? "No connection. We'll keep trying."}</Notice>
          </SafeAreaView>
        )}
      </View>

      <Sheet style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          {trip.status === 'completed' ? (
            <>
              <Text variant="lg" color="success" accessibilityRole="header">
                Trip complete
              </Text>
              <FareDisplay
                amount={fareNumber(trip.fare_minor)}
                currency={trip.currency}
                caption={trip.payment_method === 'cash' ? 'Collected in cash.' : 'Charged to the company account.'}
              />
              <Button label="Back to requests" onPress={onFinished} />
            </>
          ) : (
            <>
              <Text variant="lg" accessibilityRole="header" accessibilityLiveRegion="polite">
                {trip.status === 'assigned' && 'Go to the pickup'}
                {trip.status === 'arrived' && 'Waiting for your rider'}
                {trip.status === 'in_progress' && 'Take your rider to the destination'}
              </Text>
              <View style={styles.riderRow}>
                <View style={styles.flex}>
                  <Text variant="base" style={styles.bold}>
                    {trip.rider.name || 'Your rider'}
                  </Text>
                  <Text variant="sm" color="text-muted">
                    {toPickup ? trip.pickup_note || 'No landmark given' : trip.dropoff_note || 'Destination'}
                  </Text>
                </View>
                {trip.rider.phone && (
                  <Button
                    label="Call"
                    accessibilityLabel={`Call your rider on ${formatPhone(trip.rider.phone)}`}
                    variant="secondary"
                    size="md"
                    onPress={() => Linking.openURL(`tel:${trip.rider.phone}`)}
                  />
                )}
              </View>
              <Notice>
                {trip.payment_method === 'cash' ? `Cash trip: collect ${fare} at the end.` : `Company account trip: ${fare}. No cash to collect.`}
              </Notice>
              <Button
                label={toPickup ? 'Navigate to pickup' : 'Navigate to destination'}
                variant="secondary"
                onPress={() =>
                  toPickup ? navigate(trip.pickup_lat, trip.pickup_lng) : navigate(trip.dropoff_lat, trip.dropoff_lng)
                }
              />
              {actionError && <Notice tone="danger">{actionError}</Notice>}

              {trip.status === 'assigned' && <Button label="I've arrived" onPress={() => act('arrived')} loading={busy} />}
              {trip.status === 'arrived' && <Button label="Start trip" onPress={() => act('start')} loading={busy} />}
              {trip.status === 'in_progress' &&
                (confirm === 'complete' ? (
                  <View style={styles.confirm}>
                    <Text>{trip.payment_method === 'cash' ? `Have you collected ${fare}?` : 'End the trip?'}</Text>
                    <View style={styles.row}>
                      <Button label="Not yet" variant="secondary" style={styles.flex} onPress={() => setConfirm(null)} />
                      <Button label="Complete trip" style={styles.flex} onPress={() => act('complete')} loading={busy} />
                    </View>
                  </View>
                ) : (
                  <Button label="Complete trip" onPress={() => setConfirm('complete')} />
                ))}

              {toPickup &&
                (confirm === 'cancel' ? (
                  <View style={styles.confirm}>
                    <Text>Cancel this trip? It goes back to the next nearest driver.</Text>
                    <View style={styles.row}>
                      <Button label="Keep trip" variant="secondary" style={styles.flex} onPress={() => setConfirm(null)} />
                      <Button label="Cancel trip" variant="danger" style={styles.flex} onPress={cancel} loading={busy} />
                    </View>
                  </View>
                ) : (
                  <Button label="Cancel trip" variant="ghost" size="md" onPress={() => setConfirm('cancel')} />
                ))}
            </>
          )}
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  mapArea: { flex: 1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, padding: theme.layout['phone-gutter'] },
  padded: { flex: 1, backgroundColor: theme.color.bg, padding: theme.layout['phone-gutter'], gap: theme.space[4], paddingTop: theme.space[7] },
  sheet: { maxHeight: '62%' },
  sheetBody: { gap: theme.space[3] },
  riderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
  confirm: { gap: theme.space[2] },
  row: { flexDirection: 'row', gap: theme.space[2] },
  flex: { flex: 1 },
  bold: { fontFamily: 'AtkinsonHyperlegible_700Bold' },
});
