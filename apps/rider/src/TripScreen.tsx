// S04 Finding / driver on the way, S05 trip in progress, and the end of the trip.
import React, { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import Phone from 'lucide-react-native/icons/phone';
import {
  Button,
  cancelTrip,
  dispatchTrip,
  DriverDot,
  DropoffPin,
  etaMinutes,
  FareDisplay,
  fareNumber,
  formatPhone,
  metresBetween,
  Notice,
  PickupPin,
  PlateChip,
  riderStatusLine,
  Sheet,
  Text,
  theme,
  useInterval,
  useLiveTrip,
  vehicleLabel,
  type Trip,
} from '@juba/shared';

export function TripScreen({ tripId, onFinished }: { tripId: string; onFinished: () => void }) {
  const { trip, error, refresh } = useLiveTrip(tripId);
  const mapRef = useRef<MapView>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // While searching, keep offering the trip to the next driver every few seconds.
  useInterval(
    () => {
      dispatchTrip(tripId)
        .then((status) => {
          if (status !== 'requested') refresh();
        })
        .catch(() => {});
    },
    4000,
    trip?.status === 'requested',
  );

  // Keep pickup, destination and driver in view.
  const driverLat = trip?.driver_location?.lat;
  const driverLng = trip?.driver_location?.lng;
  useEffect(() => {
    if (!trip) return;
    const points = [
      { latitude: trip.pickup_lat, longitude: trip.pickup_lng },
      { latitude: trip.dropoff_lat, longitude: trip.dropoff_lng },
    ];
    if (driverLat != null && driverLng != null) points.push({ latitude: driverLat, longitude: driverLng });
    mapRef.current?.fitToCoordinates(points, { edgePadding: { top: 80, right: 60, bottom: 80, left: 60 }, animated: true });
  }, [trip?.status, trip?.id, driverLat != null]);

  async function cancel() {
    setBusy(true);
    setActionError(null);
    try {
      await cancelTrip(tripId, 'Rider cancelled');
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
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
          <Text color="text-muted">Loading your trip…</Text>
        )}
      </SafeAreaView>
    );
  }

  const ended = ['completed', 'cancelled_by_rider', 'cancelled_by_driver', 'no_driver_found'].includes(trip.status);
  const canCancel = ['requested', 'assigned', 'arrived'].includes(trip.status);

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: trip.pickup_lat, longitude: trip.pickup_lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          toolbarEnabled={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Marker coordinate={{ latitude: trip.pickup_lat, longitude: trip.pickup_lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <PickupPin />
          </Marker>
          <Marker coordinate={{ latitude: trip.dropoff_lat, longitude: trip.dropoff_lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <DropoffPin />
          </Marker>
          {trip.driver_location && (
            <Marker
              coordinate={{ latitude: trip.driver_location.lat, longitude: trip.driver_location.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <DriverDot />
            </Marker>
          )}
        </MapView>
        {error && (
          <SafeAreaView edges={['top']} style={styles.top}>
            <Notice>No connection. We'll keep trying.</Notice>
          </SafeAreaView>
        )}
      </View>

      <Sheet style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <StatusLine trip={trip} />

          {trip.status === 'requested' && (
            <Text color="text-muted" variant="sm">
              We're offering your trip to the nearest {vehicleLabel[trip.vehicle_class].toLowerCase()} drivers. This usually takes under a minute.
            </Text>
          )}

          {trip.driver && trip.vehicle && !ended && <DriverCard trip={trip} />}

          {trip.status === 'arrived' && (
            <Notice>
              Your driver is at the pickup spot. Look for plate {trip.vehicle?.plate ?? ''}.
            </Notice>
          )}

          {(trip.status === 'assigned' || trip.status === 'arrived' || trip.status === 'in_progress') &&
            trip.payment_method === 'cash' && (
              <Notice>
                Cash trip: pay your driver {fareNumber(trip.fare_minor)} {trip.currency} at the end.
              </Notice>
            )}

          {trip.status === 'completed' && (
            <>
              <FareDisplay amount={fareNumber(trip.fare_minor)} currency={trip.currency} caption="Paid in cash. Thank you for riding." />
              <Button label="Done" onPress={onFinished} />
            </>
          )}

          {(trip.status === 'no_driver_found' || trip.status.startsWith('cancelled')) && (
            <Button label="Book another ride" onPress={onFinished} />
          )}

          {actionError && <Notice tone="danger">{actionError}</Notice>}

          {canCancel &&
            (confirmCancel ? (
              <View style={styles.confirm}>
                <Text>Cancel this trip?</Text>
                <View style={styles.row}>
                  <Button label="Keep trip" variant="secondary" style={styles.flex} onPress={() => setConfirmCancel(false)} />
                  <Button label="Cancel trip" variant="danger" style={styles.flex} onPress={cancel} loading={busy} />
                </View>
              </View>
            ) : (
              <Button label="Cancel trip" variant="ghost" size="md" onPress={() => setConfirmCancel(true)} />
            ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}

function StatusLine({ trip }: { trip: Trip }) {
  let line = riderStatusLine[trip.status];
  if (trip.status === 'assigned' && trip.driver_location) {
    const mins = etaMinutes(metresBetween(trip.driver_location, { lat: trip.pickup_lat, lng: trip.pickup_lng }));
    line = `Arriving in ${mins} min`;
  }
  const color = trip.status === 'arrived' || trip.status === 'completed' ? 'success' : trip.status === 'no_driver_found' ? 'text' : 'accent';
  return (
    <Text variant="lg" color={color} accessibilityRole="header" accessibilityLiveRegion="polite" numbers>
      {line}
    </Text>
  );
}

function DriverCard({ trip }: { trip: Trip }) {
  const d = trip.driver!;
  const v = trip.vehicle!;
  const initials = d.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={styles.driverCard}>
      <View style={styles.driverRow}>
        <View style={styles.avatar}>
          <Text variant="lg" color="accent">
            {initials || '?'}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="lg">{d.name || 'Your driver'}</Text>
          <Text variant="xs" color="text-muted" numbers>
            {d.rating ? `${d.rating.toFixed(1)} rating · ${d.rating_count} trips` : 'New driver'}
          </Text>
        </View>
        {d.phone && (
          <Button
            label="Call"
            accessibilityLabel={`Call your driver on ${formatPhone(d.phone)}`}
            variant="secondary"
            size="md"
            onPress={() => Linking.openURL(`tel:${d.phone}`)}
            style={styles.callButton}
          />
        )}
      </View>
      <View style={styles.carRow}>
        <PlateChip plate={v.plate} />
        <Text variant="sm">
          {v.colour} {v.make} {v.model}
        </Text>
      </View>
      {!d.phone && (
        <View style={styles.row}>
          <Phone size={16} color={theme.color['text-muted']} />
          <Text variant="xs" color="text-muted">
            Calling is available once your driver adds a phone number.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  mapArea: { flex: 1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, padding: theme.layout['phone-gutter'] },
  padded: { flex: 1, backgroundColor: theme.color.bg, padding: theme.layout['phone-gutter'], gap: theme.space[4] },
  sheet: { maxHeight: '62%' },
  sheetBody: { gap: theme.space[3] },
  driverCard: { gap: theme.space[3] },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3] },
  avatar: {
    width: theme.size['button-lg'],
    height: theme.size['button-lg'],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color['accent-soft'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButton: { paddingHorizontal: theme.space[3] },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space[3], flexWrap: 'wrap' },
  confirm: { gap: theme.space[2] },
  row: { flexDirection: 'row', gap: theme.space[2], alignItems: 'center' },
  flex: { flex: 1 },
});
