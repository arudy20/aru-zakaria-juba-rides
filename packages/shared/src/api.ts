// Every call the apps make to the database goes through here.
// Each function maps to one SQL function, so screens never build queries themselves.
import { getSupabase } from './supabase';
import type { DriverStatusInfo, LatLng, Offer, PaymentMethod, Place, Quote, Trip, TripStatus, VehicleClass } from './types';

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw new Error(friendlyError(error.message));
  return data as T;
}

/** Turns database and network errors into sentences a rider or driver can act on. */
export function friendlyError(message: string): string {
  if (/fetch|network|timed out|Failed to fetch/i.test(message)) return "No connection. Check your data and try again.";
  if (/JWT|not authenticated|Sign in first/i.test(message)) return 'Please sign in again.';
  return message;
}

// ---------------- sign-in
export async function sendPhoneCode(phone: string) {
  const { error } = await getSupabase().auth.signInWithOtp({ phone });
  if (error) throw new Error(friendlyError(error.message));
}

export async function verifyPhoneCode(phone: string, token: string) {
  const { error } = await getSupabase().auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) {
    if (/expired/i.test(error.message)) throw new Error('Code expired. Send a new one.');
    if (/invalid|token/i.test(error.message)) throw new Error("That code didn't match. Check the SMS and try again.");
    throw new Error(friendlyError(error.message));
  }
}

/** Development only: email and password, so testing doesn't need an SMS provider. */
export async function devEmailSignIn(email: string, password: string) {
  const supabase = getSupabase();
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.error) return;
  if (/invalid login credentials/i.test(signIn.error.message)) {
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error) throw new Error(friendlyError(signUp.error.message));
    if (!signUp.data.session) {
      throw new Error('Account created, but email confirmation is on. Turn off "Confirm email" in Supabase for testing.');
    }
    return;
  }
  throw new Error(friendlyError(signIn.error.message));
}

export async function signOut() {
  await getSupabase().auth.signOut();
}

export const updateMyName = (fullName: string) => rpc<void>('update_my_name', { p_full_name: fullName });

// ---------------- rider
export const quoteTrip = (pickup: LatLng, dropoff: LatLng) =>
  rpc<Quote[]>('quote_trip', {
    p_pickup_lat: pickup.lat,
    p_pickup_lng: pickup.lng,
    p_dropoff_lat: dropoff.lat,
    p_dropoff_lng: dropoff.lng,
  });

export const requestTrip = (vehicleClass: VehicleClass, pickup: Place, dropoff: Place, payment: PaymentMethod = 'cash') =>
  rpc<string>('request_trip', {
    p_class: vehicleClass,
    p_pickup_lat: pickup.lat,
    p_pickup_lng: pickup.lng,
    p_pickup_note: pickup.note,
    p_dropoff_lat: dropoff.lat,
    p_dropoff_lng: dropoff.lng,
    p_dropoff_note: dropoff.note,
    p_payment: payment,
  });

export const dispatchTrip = (tripId: string) => rpc<TripStatus>('dispatch_trip', { p_trip: tripId });
export const cancelTrip = (tripId: string, reason?: string) =>
  rpc<TripStatus>('cancel_trip', { p_trip: tripId, p_reason: reason ?? null });
export const getTrip = (tripId: string) => rpc<Trip | null>('get_trip', { p_trip: tripId });
export const myActiveTrip = () => rpc<string | null>('my_active_trip');

// ---------------- driver
export const applyAsDriver = (input: {
  fullName: string;
  vehicleClass: VehicleClass;
  make: string;
  model: string;
  colour: string;
  plate: string;
}) =>
  rpc<void>('apply_as_driver', {
    p_full_name: input.fullName,
    p_class: input.vehicleClass,
    p_make: input.make,
    p_model: input.model,
    p_colour: input.colour,
    p_plate: input.plate,
  });

export const myDriverStatus = () => rpc<DriverStatusInfo | null>('my_driver_status');
export const setMyLocation = (pos: LatLng, online: boolean, heading?: number | null) =>
  rpc<void>('set_my_location', {
    p_lat: pos.lat,
    p_lng: pos.lng,
    p_heading: heading == null || heading < 0 ? null : Math.round(heading),
    p_online: online,
  });
export const myOffer = () => rpc<Offer | null>('my_offer');
export const acceptOffer = (offerId: string) => rpc<boolean>('accept_offer', { p_offer_id: offerId });
export const declineOffer = (offerId: string) => rpc<void>('decline_offer', { p_offer: offerId });
export const driverUpdateTrip = (tripId: string, action: 'arrived' | 'start' | 'complete') =>
  rpc<TripStatus>('driver_update_trip', { p_trip: tripId, p_action: action });
