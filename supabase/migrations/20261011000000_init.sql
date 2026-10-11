-- Juba Rides: first migration
-- Postgres on Supabase, with PostGIS for "nearest driver" and Row Level Security for access.
-- Money is stored as integer minor units (piasters / cents) plus a currency code.
-- All times are timestamptz (UTC).

create extension if not exists postgis;

-- ---------------------------------------------------------------- enums
create type user_role       as enum ('rider', 'driver', 'admin');
create type driver_status   as enum ('pending', 'approved', 'suspended');
create type vehicle_class   as enum ('car', 'boda', 'tuk_tuk');
create type document_kind   as enum ('licence', 'vehicle_registration', 'photo', 'national_id');
create type document_status as enum ('submitted', 'approved', 'rejected');
create type trip_status     as enum ('requested', 'assigned', 'arrived', 'in_progress',
                                     'completed', 'cancelled_by_rider', 'cancelled_by_driver',
                                     'no_driver_found');
create type offer_status    as enum ('offered', 'accepted', 'declined', 'expired');
create type payment_method  as enum ('cash', 'mgurush', 'momo', 'invoice');
create type payment_status  as enum ('pending', 'paid', 'failed', 'refunded');

-- ---------------------------------------------------------------- organizations (corporate accounts)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  billing_contact_phone text,
  billing_contact_email text,
  invoice_currency char(3) not null default 'USD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- profiles (one per auth user)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text not null unique,
  full_name text not null default '',
  role user_role not null default 'rider',
  photo_url text,
  org_id uuid references organizations(id) on delete set null,
  emergency_contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on profiles (org_id);

-- ---------------------------------------------------------------- drivers, vehicles, documents
create table drivers (
  profile_id uuid primary key references profiles(id) on delete cascade,
  status driver_status not null default 'pending',
  commission_bps integer not null default 1000 check (commission_bps between 0 and 3000), -- 1000 = 10%
  rating_avg numeric(3,2),
  rating_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on drivers (status);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(profile_id) on delete cascade,
  class vehicle_class not null default 'car',
  make text not null,
  model text not null,
  colour text not null,
  plate text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on vehicles (driver_id);

create table driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references drivers(profile_id) on delete cascade,
  kind document_kind not null,
  storage_path text not null,           -- Supabase Storage, private bucket
  status document_status not null default 'submitted',
  reviewer_note text,
  expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on driver_documents (driver_id, kind);

-- One row per driver, updated every few seconds while online. Realtime is enabled on this table.
create table driver_locations (
  driver_id uuid primary key references drivers(profile_id) on delete cascade,
  position geography(point, 4326) not null,
  heading smallint,
  is_online boolean not null default false,
  vehicle_class vehicle_class not null default 'car',
  updated_at timestamptz not null default now()
);
create index driver_locations_online_gix on driver_locations using gist (position) where is_online;

-- ---------------------------------------------------------------- fares
create table fare_rules (
  id uuid primary key default gen_random_uuid(),
  vehicle_class vehicle_class not null,
  currency char(3) not null default 'SSP',
  base_minor bigint not null check (base_minor >= 0),
  per_km_minor bigint not null check (per_km_minor >= 0),
  minimum_minor bigint not null check (minimum_minor >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- only one active rule per class + currency
create unique index fare_rules_one_active on fare_rules (vehicle_class, currency) where is_active;

-- ---------------------------------------------------------------- trips
create table trips (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references profiles(id) on delete restrict,
  driver_id uuid references drivers(profile_id) on delete restrict,
  vehicle_id uuid references vehicles(id) on delete set null,
  org_id uuid references organizations(id) on delete set null,
  vehicle_class vehicle_class not null default 'car',
  pickup geography(point, 4326) not null,
  pickup_note text,                     -- "blue gate opposite Jebel market"
  dropoff geography(point, 4326) not null,
  dropoff_note text,
  status trip_status not null default 'requested',
  currency char(3) not null default 'SSP',
  quoted_fare_minor bigint not null check (quoted_fare_minor >= 0),  -- fixed price shown up front
  final_fare_minor bigint check (final_fare_minor >= 0),
  payment_method payment_method not null default 'cash',
  requested_at timestamptz not null default now(),
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on trips (rider_id, requested_at desc);
create index on trips (driver_id, requested_at desc);
create index on trips (org_id, requested_at desc);
create index on trips (status);
-- a driver can only be on one active trip at a time
create unique index trips_one_active_per_driver on trips (driver_id)
  where status in ('assigned', 'arrived', 'in_progress');
-- a rider can only have one open trip at a time
create unique index trips_one_open_per_rider on trips (rider_id)
  where status in ('requested', 'assigned', 'arrived', 'in_progress');

create table trip_offers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  driver_id uuid not null references drivers(profile_id) on delete cascade,
  status offer_status not null default 'offered',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (trip_id, driver_id)
);
create index on trip_offers (driver_id, status);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  from_profile uuid not null references profiles(id) on delete cascade,
  to_profile uuid not null references profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (trip_id, from_profile)
);
create index on ratings (to_profile);

create table payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete restrict,
  method payment_method not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null,
  status payment_status not null default 'pending',
  provider_ref text,                    -- mobile money transaction id; unique to stop double-counting
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on payments (trip_id);
create unique index payments_provider_ref_unique on payments (method, provider_ref) where provider_ref is not null;

-- ---------------------------------------------------------------- updated_at trigger
create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['organizations','profiles','drivers','vehicles','driver_documents',
                           'fare_rules','trips','payments'] loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- helpers
create function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- the caller's current role, read without going through RLS (avoids policy recursion on profiles)
create function my_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

-- Fixed fare: straight-line distance x 1.3 road factor, priced by the active rule. No surge.
create function quote_fare(p_class vehicle_class, p_pickup geography, p_dropoff geography, p_currency char(3) default 'SSP')
returns bigint language sql stable as $$
  select greatest(r.minimum_minor,
                  r.base_minor + round(r.per_km_minor * (st_distance(p_pickup, p_dropoff) / 1000.0) * 1.3)::bigint)
  from fare_rules r
  where r.vehicle_class = p_class and r.currency = p_currency and r.is_active;
$$;

-- Driver accepts an offer. Row lock + the unique index above make double-assignment impossible:
-- if two drivers tap "accept" at once, exactly one wins and the other gets false.
create function accept_offer(p_offer_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_offer trip_offers; v_trip trips; v_vehicle uuid;
begin
  select * into v_offer from trip_offers
    where id = p_offer_id and driver_id = auth.uid() for update;
  if not found or v_offer.status <> 'offered' or v_offer.expires_at < now() then
    return false;
  end if;

  select * into v_trip from trips where id = v_offer.trip_id for update;
  if v_trip.status <> 'requested' then
    update trip_offers set status = 'expired', responded_at = now() where id = p_offer_id;
    return false;
  end if;

  select id into v_vehicle from vehicles
    where driver_id = auth.uid() and is_active and class = v_trip.vehicle_class limit 1;

  update trips set driver_id = auth.uid(), vehicle_id = v_vehicle, status = 'assigned', assigned_at = now()
    where id = v_trip.id;
  update trip_offers set status = 'accepted', responded_at = now() where id = p_offer_id;
  update trip_offers set status = 'expired', responded_at = now()
    where trip_id = v_trip.id and id <> p_offer_id and status = 'offered';
  return true;
end $$;

-- Nearest online, approved drivers of the right class within a radius (default 5 km).
create function nearest_drivers(p_pickup geography, p_class vehicle_class, p_radius_m integer default 5000, p_limit integer default 5)
returns table (driver_id uuid, distance_m double precision)
language sql stable security definer set search_path = public as $$
  select l.driver_id, st_distance(l.position, p_pickup)
  from driver_locations l
  join drivers d on d.profile_id = l.driver_id and d.status = 'approved'
  where l.is_online
    and l.vehicle_class = p_class
    and l.updated_at > now() - interval '2 minutes'
    and st_dwithin(l.position, p_pickup, p_radius_m)
    and not exists (select 1 from trips t where t.driver_id = l.driver_id
                    and t.status in ('assigned','arrived','in_progress'))
  order by l.position <-> p_pickup
  limit p_limit;
$$;

-- ---------------------------------------------------------------- row level security
alter table organizations    enable row level security;
alter table profiles         enable row level security;
alter table drivers          enable row level security;
alter table vehicles         enable row level security;
alter table driver_documents enable row level security;
alter table driver_locations enable row level security;
alter table fare_rules       enable row level security;
alter table trips            enable row level security;
alter table trip_offers      enable row level security;
alter table ratings          enable row level security;
alter table payments         enable row level security;

-- admins can do everything
do $$ declare t text; begin
  foreach t in array array['organizations','profiles','drivers','vehicles','driver_documents',
                           'driver_locations','fare_rules','trips','trip_offers','ratings','payments'] loop
    execute format('create policy admin_all on %I for all using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

create policy own_profile_read   on profiles for select using (id = auth.uid());
create policy own_profile_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = my_role());  -- cannot promote yourself
-- riders see the name and photo of their assigned driver, and drivers see their rider
create policy trip_party_profile on profiles for select using (
  exists (select 1 from trips t where t.status in ('assigned','arrived','in_progress','completed')
          and ((t.rider_id = auth.uid() and t.driver_id = profiles.id)
            or (t.driver_id = auth.uid() and t.rider_id = profiles.id))));

create policy own_driver_read on drivers for select using (profile_id = auth.uid());
create policy own_driver_apply on drivers for insert with check (profile_id = auth.uid() and status = 'pending');

create policy own_vehicles on vehicles for all using (driver_id = auth.uid()) with check (driver_id = auth.uid());
create policy rider_sees_vehicle on vehicles for select using (
  exists (select 1 from trips t where t.vehicle_id = vehicles.id and t.rider_id = auth.uid()));

create policy own_documents on driver_documents for select using (driver_id = auth.uid());
create policy upload_documents on driver_documents for insert
  with check (driver_id = auth.uid() and status = 'submitted');

create policy own_location_write on driver_locations for all
  using (driver_id = auth.uid()) with check (driver_id = auth.uid());
-- a rider sees only their assigned driver's location, only during the trip
create policy rider_sees_driver_location on driver_locations for select using (
  exists (select 1 from trips t where t.driver_id = driver_locations.driver_id and t.rider_id = auth.uid()
          and t.status in ('assigned','arrived','in_progress')));

create policy fares_public_read on fare_rules for select using (is_active);

create policy rider_trips_read on trips for select using (rider_id = auth.uid());
create policy driver_trips_read on trips for select using (driver_id = auth.uid());
-- trip creation, status changes and cancellation go through server functions (edge functions),
-- so the client never sets fares or statuses directly.

create policy own_offers_read on trip_offers for select using (driver_id = auth.uid());

create policy ratings_read_own on ratings for select using (from_profile = auth.uid() or to_profile = auth.uid());
create policy ratings_insert on ratings for insert with check (
  from_profile = auth.uid() and exists (
    select 1 from trips t where t.id = trip_id and t.status = 'completed'
      and ((t.rider_id = auth.uid() and t.driver_id = to_profile)
        or (t.driver_id = auth.uid() and t.rider_id = to_profile))));

create policy payments_read_party on payments for select using (
  exists (select 1 from trips t where t.id = trip_id and (t.rider_id = auth.uid() or t.driver_id = auth.uid())));

-- ---------------------------------------------------------------- realtime
alter publication supabase_realtime add table driver_locations, trips, trip_offers;

-- ---------------------------------------------------------------- seed fares (placeholders, set real prices in the admin dashboard)
insert into fare_rules (vehicle_class, currency, base_minor, per_km_minor, minimum_minor) values
  ('car',     'SSP', 0, 0, 0),
  ('boda',    'SSP', 0, 0, 0),
  ('tuk_tuk', 'SSP', 0, 0, 0);
