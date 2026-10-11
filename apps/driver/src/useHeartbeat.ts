// Sends the driver's position to the server while they're online.
// Moves are sent as they happen (at most every 5 s / 20 m); a 20-second resend keeps the driver
// marked as fresh even when parked, because dispatch ignores drivers not seen for 2 minutes.
import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { setMyLocation, type LatLng } from '@juba/shared';

export function useHeartbeat(online: boolean) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const latest = useRef<{ pos: LatLng; heading: number | null } | null>(null);
  const sending = useRef(false);

  async function send(isOnline: boolean) {
    if (!latest.current || sending.current) return;
    sending.current = true;
    try {
      await setMyLocation(latest.current.pos, isOnline, latest.current.heading);
      setProblem(null);
    } catch (e) {
      setProblem((e as Error).message);
    } finally {
      sending.current = false;
    }
  }

  useEffect(() => {
    if (!online) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setProblem('Location is off. Turn it on to receive trips.');
        return;
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 20 },
        (loc) => {
          if (cancelled) return;
          const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          latest.current = { pos, heading: loc.coords.heading };
          setPosition(pos);
          send(true);
        },
      );
    })();
    const keepAlive = setInterval(() => send(true), 20000);
    return () => {
      cancelled = true;
      clearInterval(keepAlive);
      sub?.remove();
    };
  }, [online]);

  return { position, problem, goOffline: () => send(false) };
}
