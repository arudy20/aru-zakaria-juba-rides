import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLng } from './types';

export type LocationState =
  | { status: 'locating' }
  | { status: 'denied' }
  | { status: 'unavailable'; message: string }
  | { status: 'ready'; position: LatLng; accuracy: number | null };

/** Asks once for location permission and gets a fix: last known first (fast), then a fresh one. */
export function useCurrentLocation() {
  const [state, setState] = useState<LocationState>({ status: 'locating' });

  const locate = useCallback(async () => {
    setState({ status: 'locating' });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState({ status: 'denied' });
        return;
      }
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
      if (last) {
        setState({ status: 'ready', position: { lat: last.coords.latitude, lng: last.coords.longitude }, accuracy: last.coords.accuracy });
      }
      const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setState({ status: 'ready', position: { lat: fresh.coords.latitude, lng: fresh.coords.longitude }, accuracy: fresh.coords.accuracy });
    } catch (e) {
      setState((prev) =>
        prev.status === 'ready' ? prev : { status: 'unavailable', message: 'Location is off. Turn it on so your driver can find you.' },
      );
    }
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  return { state, locate };
}
