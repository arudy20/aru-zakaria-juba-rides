// S02 Home map + where to, and S03 ride options with the fixed fare.
// Pickup and destination are set by moving the map under a fixed pin, plus a landmark note,
// because many places in Juba have no usable street address.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  DropoffPin,
  fareNumber,
  Field,
  JUBA_CENTRE,
  Notice,
  OptionCard,
  PickupPin,
  quoteTrip,
  requestTrip,
  Sheet,
  Text,
  theme,
  useCurrentLocation,
  vehicleLabel,
  vehicleSeats,
  FareDisplay,
  type LatLng,
  type Place,
  type Quote,
  type VehicleClass,
  AccountPanel,
  baseMapType,
  MapAttribution,
  MapTiles,
} from '@juba/shared';

type Stage = 'pickup' | 'dropoff' | 'options';
const ZOOM = { latitudeDelta: 0.012, longitudeDelta: 0.012 };

export function BookingFlow({ onBooked }: { onBooked: (tripId: string) => void }) {
  const { state: location, locate } = useCurrentLocation();
  const mapRef = useRef<MapView>(null);
  const [stage, setStage] = useState<Stage>('pickup');
  const [centre, setCentre] = useState<LatLng>(JUBA_CENTRE);
  const [pickup, setPickup] = useState<Place | null>(null);
  const [dropoff, setDropoff] = useState<Place | null>(null);
  const [pickupNote, setPickupNote] = useState('');
  const [dropoffNote, setDropoffNote] = useState('');
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [selected, setSelected] = useState<VehicleClass | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const movedToUser = useRef(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Centre the map on the rider the first time their location arrives.
  useEffect(() => {
    if (location.status === 'ready' && !movedToUser.current) {
      movedToUser.current = true;
      setCentre(location.position);
      mapRef.current?.animateToRegion({ latitude: location.position.lat, longitude: location.position.lng, ...ZOOM }, 400);
    }
  }, [location]);

  // Tapping the map moves the pin to that spot, as well as dragging the map under the pin.
  function onMapPress(e: MapPressEvent) {
    if (stage === 'options') return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setCentre({ lat: latitude, lng: longitude });
    mapRef.current?.animateCamera({ center: { latitude, longitude } }, { duration: 250 });
  }

  function onRegionChangeComplete(r: Region) {
    if (stage !== 'options') setCentre({ lat: r.latitude, lng: r.longitude });
  }

  function confirmPickup() {
    setPickup({ ...centre, note: pickupNote.trim() });
    setStage('dropoff');
    setError(null);
  }

  async function confirmDropoff() {
    if (!pickup) return;
    const place = { ...centre, note: dropoffNote.trim() };
    setDropoff(place);
    setStage('options');
    setQuotes(null);
    setError(null);
    try {
      const q = await quoteTrip(pickup, place);
      setQuotes(q);
      const firstAvailable = q.find((x) => x.drivers_nearby > 0) ?? q[0];
      setSelected(firstAvailable?.vehicle_class ?? null);
      mapRef.current?.fitToCoordinates(
        [
          { latitude: pickup.lat, longitude: pickup.lng },
          { latitude: place.lat, longitude: place.lng },
        ],
        { edgePadding: { top: 80, right: 60, bottom: 80, left: 60 }, animated: true },
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function book() {
    if (!pickup || !dropoff || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const id = await requestTrip(selected, pickup, dropoff, 'cash');
      onBooked(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setError(null);
    if (stage === 'options') setStage('dropoff');
    else if (stage === 'dropoff') {
      setStage('pickup');
      if (pickup) mapRef.current?.animateToRegion({ latitude: pickup.lat, longitude: pickup.lng, ...ZOOM }, 300);
    }
  }

  const chosen = quotes?.find((q) => q.vehicle_class === selected) ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
      <MapView
        ref={mapRef}
          mapType={baseMapType}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: JUBA_CENTRE.lat, longitude: JUBA_CENTRE.lng, ...ZOOM }}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={onMapPress}
        showsUserLocation={location.status === 'ready'}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <MapTiles />
        {stage !== 'pickup' && pickup && (
          <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <PickupPin />
          </Marker>
        )}
        {stage === 'options' && dropoff && (
          <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <DropoffPin />
          </Marker>
        )}
      </MapView>
        <MapAttribution />

      {/* The fixed pin in the middle of the map marks the spot being chosen. */}
      {stage !== 'options' && (
        <View pointerEvents="none" style={styles.centrePin}>
          {stage === 'pickup' ? <PickupPin /> : <DropoffPin />}
        </View>
      )}

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          {stage === 'pickup' ? (
            <Button label="Account" variant="secondary" size="md" onPress={() => setAccountOpen(true)} />
          ) : (
            <Button label="Back" variant="secondary" size="md" onPress={back} />
          )}
        </View>
        {location.status === 'denied' || location.status === 'unavailable' ? (
          <View style={styles.topNotice}>
            <Notice>Location is off. Turn it on so your driver can find you, or move the map to your spot.</Notice>
            <Button label="Turn on location" size="md" variant="secondary" onPress={locate} />
          </View>
        ) : null}
      </SafeAreaView>
      </View>

      <Sheet style={styles.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
          {stage === 'pickup' && (
            <>
              <Text variant="lg" accessibilityRole="header">
                Where should we pick you up?
              </Text>
              <Text variant="sm" color="text-muted">
                {location.status === 'locating' ? 'Finding your location…' : 'Drag the map, or tap it, to put the red pin on your spot.'}
              </Text>
              <Field
                label="Landmark (optional)"
                value={pickupNote}
                onChangeText={setPickupNote}
                placeholder="Gate colour, nearby shop or landmark"
                maxLength={200}
              />
              <Button label="Confirm pickup" onPress={confirmPickup} />
            </>
          )}

          {stage === 'dropoff' && (
            <>
              <Text variant="lg" accessibilityRole="header">
                Where to?
              </Text>
              <Text variant="sm" color="text-muted">
                Drag the map, or tap it, to put the square on your destination.
              </Text>
              <Field
                label="Destination name"
                value={dropoffNote}
                onChangeText={setDropoffNote}
                placeholder="For example: Juba airport, Konyo Konyo market"
                maxLength={200}
              />
              <Button label="See prices" onPress={confirmDropoff} />
            </>
          )}

          {stage === 'options' && (
            <>
              <Text variant="lg" accessibilityRole="header">
                Choose a ride
              </Text>
              {!quotes && !error && <Text color="text-muted">Getting prices…</Text>}
              {quotes && quotes.length === 0 && <Notice>No ride types are available yet. Please try again later.</Notice>}
              <View accessibilityRole="radiogroup" style={styles.options}>
                {quotes?.map((q) => {
                  const none = q.drivers_nearby === 0;
                  return (
                    <OptionCard
                      key={q.vehicle_class}
                      selected={selected === q.vehicle_class}
                      onPress={() => setSelected(q.vehicle_class)}
                      label={`${vehicleLabel[q.vehicle_class]}, ${fareNumber(q.fare_minor)} ${q.currency}, ${
                        none ? 'no drivers nearby' : `${q.pickup_eta_min} minutes away`
                      }`}
                    >
                      <View style={styles.optionText}>
                        <Text variant="base" style={styles.bold}>
                          {vehicleLabel[q.vehicle_class]}
                        </Text>
                        <Text variant="xs" color="text-muted">
                          {vehicleSeats[q.vehicle_class]} seats · {none ? 'No drivers nearby' : `${q.pickup_eta_min} min away`}
                        </Text>
                      </View>
                      <Text variant="lg" numbers>
                        {fareNumber(q.fare_minor)}
                      </Text>
                    </OptionCard>
                  );
                })}
              </View>
              {chosen && (
                <>
                  <FareDisplay amount={fareNumber(chosen.fare_minor)} currency={chosen.currency} />
                  <View style={styles.payRow}>
                    <Text variant="sm">
                      Paying with <Text variant="sm" style={styles.bold}>Cash</Text>
                    </Text>
                    <Text variant="xs" color="text-muted">
                      Mobile money coming soon
                    </Text>
                  </View>
                  {chosen.drivers_nearby === 0 && (
                    <Notice>No {vehicleLabel[chosen.vehicle_class].toLowerCase()} drivers are free nearby right now. You can still book and we'll keep looking for 3 minutes.</Notice>
                  )}
                </>
              )}
              {error && <Notice tone="danger">{error}</Notice>}
              <Button
                label={chosen ? `Book ${vehicleLabel[chosen.vehicle_class].toLowerCase()}` : 'Book'}
                onPress={book}
                loading={busy}
                disabled={!chosen}
              />
            </>
          )}
          {stage !== 'options' && error && <Notice tone="danger">{error}</Notice>}
        </ScrollView>
      </Sheet>
      <AccountPanel visible={accountOpen} onClose={() => setAccountOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  mapArea: { flex: 1, minHeight: theme.layout['sheet-peek'] },
  centrePin: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, padding: theme.layout['phone-gutter'], gap: theme.space[2] },
  topRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' },
  topNotice: { gap: theme.space[2] },
  sheet: { maxHeight: '62%' },
  sheetBody: { gap: theme.space[3] },
  options: { gap: theme.space[2] },
  optionText: { flex: 1, gap: 2 },
  payRow: { borderTopWidth: 1, borderTopColor: theme.color.border, paddingTop: theme.space[2], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: theme.space[2] },
  bold: { fontFamily: 'AtkinsonHyperlegible_700Bold' },
});
