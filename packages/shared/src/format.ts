import type { TripStatus, VehicleClass } from './types';

/** 1228200 minor units in SSP -> "12,282 SSP". Fares are whole pounds or dollars. */
export function formatFare(minor: number, currency: string): string {
  const major = Math.round(minor / 100);
  return `${major.toLocaleString('en-US')} ${currency}`;
}

/** Just the number, for the big fare display: "12,300". */
export function fareNumber(minor: number): string {
  return Math.round(minor / 100).toLocaleString('en-US');
}

export const vehicleLabel: Record<VehicleClass, string> = {
  car: 'Car',
  tuk_tuk: 'Tuk-tuk',
  boda: 'Boda',
};

export const vehicleSeats: Record<VehicleClass, number> = { car: 4, tuk_tuk: 3, boda: 1 };

/** What the rider sees at each stage. */
export const riderStatusLine: Record<TripStatus, string> = {
  requested: 'Finding you a driver',
  assigned: 'Your driver is on the way',
  arrived: 'Your driver has arrived',
  in_progress: 'On the way to your destination',
  completed: 'You have arrived',
  cancelled_by_rider: 'Trip cancelled',
  cancelled_by_driver: 'Your driver cancelled',
  no_driver_found: 'No drivers are free nearby right now. Try again in a few minutes.',
};

/** South Sudan numbers: +211 then 9 digits starting with 9 (e.g. 912 345 678). */
export function normaliseSouthSudanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^211/, '').replace(/^0/, '');
  return /^9\d{8}$/.test(digits) ? `+211${digits}` : null;
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return '';
  const d = e164.replace(/\D/g, '').replace(/^211/, '');
  return d.length === 9 ? `+211 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : e164;
}

/** Straight-line distance in metres, for local ETAs between server updates. */
export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

/** Same rule as the database: 18 km/h average in Juba, roads 1.3x a straight line. */
export function etaMinutes(metres: number): number {
  return Math.max(1, Math.ceil(((metres * 1.3) / 1000 / 18) * 60));
}

/** Juba city centre, used before the phone's location is known. */
export const JUBA_CENTRE = { lat: 4.8517, lng: 31.5825 };
