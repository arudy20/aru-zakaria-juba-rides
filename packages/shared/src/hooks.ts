import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { getTrip } from './api';
import type { Trip } from './types';

/** The signed-in session, or null. `ready` is false until the stored session has been read. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

/**
 * Keeps one trip up to date. Realtime changes to the trip row and the driver's location
 * trigger a fresh read; a slow poll covers dropped connections on weak networks.
 */
export function useLiveTrip(tripId: string | null, pollMs = 8000) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const driverIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    try {
      const next = await getTrip(tripId);
      setTrip(next);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      setTrip(null);
      return;
    }
    refresh();
    const supabase = getSupabase();
    const channel = supabase
      .channel(`trip-${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, refresh)
      .subscribe();
    const timer = setInterval(refresh, pollMs);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [tripId, pollMs, refresh]);

  // Follow the assigned driver's position live, without a full trip read for every move.
  const driverId = trip?.driver?.id ?? null;
  useEffect(() => {
    driverIdRef.current = driverId;
    if (!driverId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          const row = payload.new as { lat: number; lng: number; heading: number | null; updated_at: string; driver_id: string };
          if (row.driver_id !== driverIdRef.current) return;
          setTrip((t) =>
            t && t.driver_location !== undefined
              ? { ...t, driver_location: { lat: row.lat, lng: row.lng, heading: row.heading, updated_at: row.updated_at } }
              : t,
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  return { trip, error, refresh };
}

/** Runs `fn` every `ms` while `active`, and once straight away. */
export function useInterval(fn: () => void, ms: number, active: boolean) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (!active) return;
    saved.current();
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms, active]);
}
