// Shapes returned by the database functions in supabase/migrations/20261011010000_trip_flow.sql

export type VehicleClass = 'car' | 'boda' | 'tuk_tuk';
export type PaymentMethod = 'cash' | 'mgurush' | 'momo' | 'invoice';
export type TripStatus =
  | 'requested'
  | 'assigned'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_rider'
  | 'cancelled_by_driver'
  | 'no_driver_found';
export type DriverStatus = 'pending' | 'approved' | 'suspended';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  note: string;
}

export interface Quote {
  vehicle_class: VehicleClass;
  fare_minor: number;
  currency: string;
  drivers_nearby: number;
  pickup_eta_min: number | null;
  trip_km: number;
}

export interface Vehicle {
  class: VehicleClass;
  make: string;
  model: string;
  colour: string;
  plate: string;
}

export interface Trip {
  id: string;
  status: TripStatus;
  vehicle_class: VehicleClass;
  pickup_lat: number;
  pickup_lng: number;
  pickup_note: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_note: string | null;
  fare_minor: number;
  currency: string;
  payment_method: PaymentMethod;
  requested_at: string;
  completed_at: string | null;
  driver: {
    id: string;
    name: string;
    phone: string | null;
    photo_url: string | null;
    rating: number | null;
    rating_count: number;
  } | null;
  vehicle: Vehicle | null;
  driver_location: { lat: number; lng: number; heading: number | null; updated_at: string } | null;
  rider: { id: string; name: string; phone: string | null };
  my_role: 'rider' | 'driver' | 'admin';
}

export interface Offer {
  offer_id: string;
  trip_id: string;
  expires_at: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_note: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_note: string | null;
  fare_minor: number;
  currency: string;
  payment_method: PaymentMethod;
  pickup_km: number | null;
  trip_km: number;
}

export interface DriverStatusInfo {
  status: DriverStatus;
  commission_bps: number;
  vehicle: Vehicle | null;
  is_online: boolean;
}
