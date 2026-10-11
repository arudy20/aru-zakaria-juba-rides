// S09 Go online / waiting, and S10 incoming request.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import {
  acceptOffer,
  Button,
  declineOffer,
  DriverDot,
  DropoffPin,
  fareNumber,
  getSupabase,
  JUBA_CENTRE,
  myOffer,
  Notice,
  PickupPin,
  Sheet,
  signOut,
  Text,
  theme,
  useInterval,
  vehicleLabel,
  type DriverStatusInfo,
  type Offer,
  baseMapType,
  MapAttribution,
  MapTiles,
} from '@juba/shared';
import { useHeartbeat } from './useHeartbeat';

export function OnlineScreen({ driver, onTripAccepted }: { driver: DriverStatusInfo; onTripAccepted: (tripId: string) => void }) {
  const [online, setOnline] = useState(false);
  const { position, problem, goOffline } = useHeartbeat(online);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  async function checkOffer() {
    try {
      const next = await myOffer();
      setOffer((prev) => {
        if (prev && !next) setMessage('Request expired.');
        return next;
      });
    } catch {
      // keep the current state; the next check will retry
    }
  }

  // New offers arrive by realtime; a 3-second check covers dropped connections.
  useInterval(checkOffer, 3000, online);
  useEffect(() => {
    if (!online) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel('my-offers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_offers' }, () => checkOffer())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [online]);

  useEffect(() => {
    if (position) {
      mapRef.current?.animateCamera({ center: { latitude: position.lat, longitude: position.lng }, zoom: 15 }, { duration: 400 });
    }
  }, [position?.lat, position?.lng]);

  useEffect(() => {
    if (offer) {
      mapRef.current?.fitToCoordinates(
        [
          ...(position ? [{ latitude: position.lat, longitude: position.lng }] : []),
          { latitude: offer.pickup_lat, longitude: offer.pickup_lng },
          { latitude: offer.dropoff_lat, longitude: offer.dropoff_lng },
        ],
        { edgePadding: { top: 80, right: 60, bottom: 80, left: 60 }, animated: true },
      );
    }
  }, [offer?.offer_id]);

  async function toggleOnline() {
    setMessage(null);
    if (online) {
      await goOffline();
      setOnline(false);
      setOffer(null);
    } else {
      setOnline(true);
    }
  }

  async function accept() {
    if (!offer) return;
    setBusy('accept');
    try {
      const won = await acceptOffer(offer.offer_id);
      if (won) onTripAccepted(offer.trip_id);
      else {
        setOffer(null);
        setMessage('Another driver took this trip, or it expired.');
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function decline() {
    if (!offer) return;
    setBusy('decline');
    try {
      await declineOffer(offer.offer_id);
    } finally {
      setOffer(null);
      setBusy(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          mapType={baseMapType}
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: JUBA_CENTRE.lat, longitude: JUBA_CENTRE.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
          toolbarEnabled={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <MapTiles />
          {position && (
            <Marker coordinate={{ latitude: position.lat, longitude: position.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <DriverDot />
            </Marker>
          )}
          {offer && (
            <>
              <Marker coordinate={{ latitude: offer.pickup_lat, longitude: offer.pickup_lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <PickupPin />
              </Marker>
              <Marker coordinate={{ latitude: offer.dropoff_lat, longitude: offer.dropoff_lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                <DropoffPin />
              </Marker>
            </>
          )}
        </MapView>
        <MapAttribution />
        <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
          <View style={[styles.pill, { backgroundColor: online ? theme.color.success : theme.color.bg }]}>
            <Text variant="sm" color={online ? 'on-accent' : 'text'} style={styles.bold}>
              {online ? 'Online' : 'Offline'}
            </Text>
          </View>
        </SafeAreaView>
      </View>

      <Sheet>
        {offer ? (
          <RequestCard offer={offer} busy={busy} onAccept={accept} onDecline={decline} />
        ) : (
          <>
            <Text variant="lg" accessibilityRole="header" accessibilityLiveRegion="polite">
              {online ? "You're online. Requests will appear here." : "You're offline."}
            </Text>
            {driver.vehicle && (
              <Text variant="sm" color="text-muted">
                {`${vehicleLabel[driver.vehicle.class]} · ${driver.vehicle.colour} ${driver.vehicle.make} ${driver.vehicle.model} · ${driver.vehicle.plate}`}
              </Text>
            )}
            {problem && <Notice tone="danger">{problem}</Notice>}
            {message && <Notice>{message}</Notice>}
            {online && !position && !problem && <Text color="text-muted">Finding your location…</Text>}
            <Button label={online ? 'Go offline' : 'Go online'} variant={online ? 'secondary' : 'primary'} onPress={toggleOnline} />
            {!online && <Button label="Sign out" variant="ghost" size="md" onPress={signOut} />}
          </>
        )}
      </Sheet>
    </View>
  );
}

function RequestCard({
  offer,
  busy,
  onAccept,
  onDecline,
}: {
  offer: Offer;
  busy: 'accept' | 'decline' | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const total = 20;
  const [left, setLeft] = useState(() => secondsLeft(offer.expires_at));
  useEffect(() => {
    setLeft(secondsLeft(offer.expires_at));
    const id = setInterval(() => setLeft(secondsLeft(offer.expires_at)), 500);
    return () => clearInterval(id);
  }, [offer.expires_at]);

  const r = 22;
  const circumference = 2 * Math.PI * r;
  const ringSize = theme.size['button-lg'];
  return (
    <View style={styles.request}>
      <View style={styles.requestTop}>
        <Text variant="lg" accessibilityRole="header">
          New trip request
        </Text>
        <View accessible accessibilityLabel={`${left} seconds left`} accessibilityLiveRegion={left === 10 || left === 5 ? 'assertive' : 'none'}>
          <Svg width={ringSize} height={ringSize} viewBox="0 0 52 52">
            <Circle cx={26} cy={26} r={r} stroke={theme.color.border} strokeWidth={5} fill="none" />
            <Circle
              cx={26}
              cy={26}
              r={r}
              stroke={theme.color.accent}
              strokeWidth={5}
              fill="none"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={circumference * (1 - Math.max(0, left) / total)}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
            />
          </Svg>
          <View style={styles.ringLabel}>
            <Text variant="base" numbers style={styles.bold}>
              {Math.max(0, left)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.facts}>
        <View style={styles.fact}>
          <Text variant="xs" color="text-muted">
            Pickup
          </Text>
          <Text variant="lg" numbers>
            {offer.pickup_km != null ? `${offer.pickup_km} km` : '—'}
          </Text>
        </View>
        <View style={styles.fact}>
          <Text variant="xs" color="text-muted">
            Fare ({offer.payment_method === 'cash' ? 'cash' : 'account'})
          </Text>
          <Text variant="lg" numbers>
            {fareNumber(offer.fare_minor)} {offer.currency}
          </Text>
        </View>
      </View>
      <View style={styles.placeRow}>
        <PickupPin />
        <Text style={styles.flex}>{offer.pickup_note || 'No landmark given'}</Text>
      </View>
      <View style={styles.placeRow}>
        <DropoffPin />
        <Text style={styles.flex}>
          {offer.dropoff_note || 'Destination'} · {offer.trip_km} km trip
        </Text>
      </View>
      <View style={styles.buttons}>
        <Button label="Decline" variant="secondary" style={styles.decline} onPress={onDecline} loading={busy === 'decline'} disabled={busy === 'accept'} />
        <Button label="Accept" style={styles.accept} onPress={onAccept} loading={busy === 'accept'} disabled={busy === 'decline' || left <= 0} />
      </View>
    </View>
  );
}

function secondsLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 1000);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.surface },
  mapArea: { flex: 1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, padding: theme.layout['phone-gutter'], alignItems: 'flex-start' },
  pill: { borderRadius: theme.radius.pill, paddingHorizontal: theme.space[4], paddingVertical: theme.space[2], elevation: 4 },
  bold: { fontFamily: 'AtkinsonHyperlegible_700Bold' },
  request: { gap: theme.space[3] },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ringLabel: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', gap: theme.space[2] },
  fact: { flex: 1, backgroundColor: theme.color.surface, borderRadius: theme.radius.md, padding: theme.space[3] },
  placeRow: { flexDirection: 'row', gap: theme.space[3], alignItems: 'center' },
  flex: { flex: 1 },
  buttons: { flexDirection: 'row', gap: theme.space[3] },
  decline: { flex: 2 },
  accept: { flex: 3 },
});
