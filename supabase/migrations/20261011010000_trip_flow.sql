-- Juba Rides: the trip flow (vertical slice)
-- Every action in the apps goes through one of these functions, so the apps never set fares,
-- statuses or other people's data directly. Paste into the Supabase SQL editor after the first migration.

-- ---------------------------------------------------------------- schema changes
-- email sign-in is allowed during development, so a profile may not have a phone yet
alter table profiles alter column phone drop not null;

-- plain lat/lng next to the geography columns, so apps and realtime updates can read them directly
alter table driver_locations add column lat double precision, add column lng double precision;
alter table trips add column pickup_lat double precision, add column pickup_lng double precision,
                  add column dropoff_lat double precision, add column dropoff_lng double precision,
                  add column dispatch_started_at timestamptz not null default now();

-- ---------------------------------------------------------------- new users get a profile
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, phone, full_name)
  values (new.id, nullif(new.phone, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------- small helpers
create function geo(p_lat double precision, p_lng double precision) returns geography
language sql immutable as $$ select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography $$;

-- rough minutes for a distance in Juba traffic: 18 km/h average, roads 1.3x longer than a straight line
create function eta_minutes(p_metres double precision) returns integer
language sql immutable as $$
  select case when p_metres is null then null else greatest(1, ceil(p_metres * 1.3 / 1000.0 / 18.0 * 60.0))::integer end
$$;

-- Fixed fares rounded up to a cash-friendly amount: the nearest 100 SSP, or the nearest whole US dollar.
create or replace function quote_fare(p_class vehicle_class, p_pickup geography, p_dropoff geography, p_currency char(3) default 'SSP')
returns bigint language sql stable as $$
  select (ceil(greatest(r.minimum_minor,
                        r.base_minor + round(r.per_km_minor * (st_distance(p_pickup, p_dropoff) / 1000.0) * 1.3))
               / s.step) * s.step)::bigint
  from fare_rules r
  cross join lateral (select case when p_currency = 'SSP' then 10000.0 else 100.0 end as step) s
  where r.vehicle_class = p_class and r.currency = p_currency and r.is_active;
$$;

-- ---------------------------------------------------------------- profile
create function update_my_name(p_full_name text) returns void
language sql security definer set search_path = public as $$
  update profiles set full_name = left(trim(p_full_name), 80) where id = auth.uid();
$$;

-- ---------------------------------------------------------------- drivers
create function apply_as_driver(p_full_name text, p_class vehicle_class, p_make text, p_model text,
                                p_colour text, p_plate text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(trim(coalesce(p_plate, ''))) < 3 then raise exception 'Enter the number plate'; end if;
  update profiles set full_name = left(trim(p_full_name), 80), role = 'driver'
    where id = auth.uid() and role <> 'admin';
  insert into drivers (profile_id) values (auth.uid()) on conflict (profile_id) do nothing;
  update vehicles set is_active = false where driver_id = auth.uid();
  insert into vehicles (driver_id, class, make, model, colour, plate)
  values (auth.uid(), p_class, trim(p_make), trim(p_model), trim(p_colour), upper(trim(p_plate)))
  on conflict (plate) do update set is_active = true, class = excluded.class, make = excluded.make,
    model = excluded.model, colour = excluded.colour
    where vehicles.driver_id = auth.uid();
end $$;

create function my_driver_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'status', d.status,
    'commission_bps', d.commission_bps,
    'vehicle', (select json_build_object('class', v.class, 'make', v.make, 'model', v.model, 'colour', v.colour, 'plate', v.plate)
                from vehicles v where v.driver_id = d.profile_id and v.is_active limit 1),
    'is_online', coalesce((select l.is_online from driver_locations l where l.driver_id = d.profile_id), false))
  from drivers d where d.profile_id = auth.uid();
$$;

-- Driver heartbeat: called every few seconds while online, and to go online or offline.
create function set_my_location(p_lat double precision, p_lng double precision,
                                p_heading smallint default null, p_online boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare v_class vehicle_class;
begin
  if p_online and not exists (select 1 from drivers where profile_id = auth.uid() and status = 'approved') then
    raise exception 'Your driver account is not approved yet';
  end if;
  select class into v_class from vehicles where driver_id = auth.uid() and is_active limit 1;
  insert into driver_locations (driver_id, position, lat, lng, heading, is_online, vehicle_class, updated_at)
  values (auth.uid(), geo(p_lat, p_lng), p_lat, p_lng, p_heading, p_online, coalesce(v_class, 'car'), now())
  on conflict (driver_id) do update set position = excluded.position, lat = excluded.lat, lng = excluded.lng,
    heading = excluded.heading, is_online = excluded.is_online, vehicle_class = excluded.vehicle_class,
    updated_at = now();
end $$;

-- ---------------------------------------------------------------- quotes
-- Fixed fares for every vehicle class that has a price set, with how far the nearest free driver is.
create function quote_trip(p_pickup_lat double precision, p_pickup_lng double precision,
                           p_dropoff_lat double precision, p_dropoff_lng double precision)
returns table (vehicle_class vehicle_class, fare_minor bigint, currency char(3),
               drivers_nearby integer, pickup_eta_min integer, trip_km numeric)
language sql stable security definer set search_path = public as $$
  select r.vehicle_class,
         quote_fare(r.vehicle_class, geo(p_pickup_lat, p_pickup_lng), geo(p_dropoff_lat, p_dropoff_lng), r.currency),
         r.currency,
         (select count(*)::integer from nearest_drivers(geo(p_pickup_lat, p_pickup_lng), r.vehicle_class, 5000, 50)),
         (select eta_minutes(min(n.distance_m)) from nearest_drivers(geo(p_pickup_lat, p_pickup_lng), r.vehicle_class, 5000, 1) n),
         round((st_distance(geo(p_pickup_lat, p_pickup_lng), geo(p_dropoff_lat, p_dropoff_lng)) * 1.3 / 1000.0)::numeric, 1)
  from fare_rules r
  where r.is_active and r.minimum_minor > 0
  order by r.vehicle_class;
$$;

-- ---------------------------------------------------------------- requesting and dispatching
-- Offers the trip to the next nearest free driver when there is no live offer.
-- The rider app calls this every few seconds while searching, so dispatch keeps moving without a server job.
create function dispatch_trip(p_trip uuid) returns trip_status
language plpgsql security definer set search_path = public as $$
declare v_trip trips; v_driver uuid; v_offers integer;
begin
  select * into v_trip from trips where id = p_trip for update;
  if not found then raise exception 'Trip not found'; end if;
  if v_trip.rider_id <> auth.uid() and not is_admin() then raise exception 'Not your trip'; end if;
  if v_trip.status <> 'requested' then return v_trip.status; end if;

  update trip_offers set status = 'expired', responded_at = now()
    where trip_id = p_trip and status = 'offered' and expires_at < now();

  if exists (select 1 from trip_offers where trip_id = p_trip and status = 'offered') then
    return v_trip.status;
  end if;

  select count(*) into v_offers from trip_offers where trip_id = p_trip and created_at >= v_trip.dispatch_started_at;

  select l.driver_id into v_driver
  from driver_locations l
  join drivers d on d.profile_id = l.driver_id and d.status = 'approved'
  where l.is_online
    and l.vehicle_class = v_trip.vehicle_class
    and l.updated_at > now() - interval '2 minutes'
    and st_dwithin(l.position, v_trip.pickup, 5000)
    and not exists (select 1 from trips t where t.driver_id = l.driver_id and t.status in ('assigned','arrived','in_progress'))
    and not exists (select 1 from trip_offers o where o.trip_id = p_trip and o.driver_id = l.driver_id)
    and not exists (select 1 from trip_offers o where o.driver_id = l.driver_id and o.status = 'offered' and o.expires_at > now())
  order by l.position <-> v_trip.pickup
  limit 1;

  if v_driver is null or v_offers >= 6 then
    if v_trip.dispatch_started_at < now() - interval '3 minutes' or v_offers >= 6 then
      update trips set status = 'no_driver_found' where id = p_trip;
      return 'no_driver_found';
    end if;
    return v_trip.status;   -- keep searching; a driver may come online
  end if;

  insert into trip_offers (trip_id, driver_id, expires_at) values (p_trip, v_driver, now() + interval '20 seconds');
  return v_trip.status;
end $$;

create function request_trip(p_class vehicle_class,
                             p_pickup_lat double precision, p_pickup_lng double precision, p_pickup_note text,
                             p_dropoff_lat double precision, p_dropoff_lng double precision, p_dropoff_note text,
                             p_payment payment_method default 'cash') returns uuid
language plpgsql security definer set search_path = public as $$
declare v_fare bigint; v_currency char(3); v_id uuid; v_org uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if p_payment = 'invoice' then
    select org_id into v_org from profiles where id = auth.uid();
    if v_org is null then raise exception 'Company account payment is only for company riders'; end if;
  elsif p_payment <> 'cash' then
    raise exception 'Only cash is available for now';
  end if;

  select r.currency into v_currency from fare_rules r where r.vehicle_class = p_class and r.is_active limit 1;
  v_fare := quote_fare(p_class, geo(p_pickup_lat, p_pickup_lng), geo(p_dropoff_lat, p_dropoff_lng), v_currency);
  if v_fare is null or v_fare <= 0 then raise exception 'This ride type is not available'; end if;

  begin
    insert into trips (rider_id, org_id, vehicle_class, pickup, pickup_lat, pickup_lng, pickup_note,
                       dropoff, dropoff_lat, dropoff_lng, dropoff_note, currency, quoted_fare_minor, payment_method)
    values (auth.uid(), v_org, p_class, geo(p_pickup_lat, p_pickup_lng), p_pickup_lat, p_pickup_lng, left(p_pickup_note, 200),
            geo(p_dropoff_lat, p_dropoff_lng), p_dropoff_lat, p_dropoff_lng, left(p_dropoff_note, 200),
            v_currency, v_fare, p_payment)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You already have a trip in progress';
  end;

  perform dispatch_trip(v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------- driver side
create function my_offer() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'offer_id', o.id, 'trip_id', t.id, 'expires_at', o.expires_at,
    'pickup_lat', t.pickup_lat, 'pickup_lng', t.pickup_lng, 'pickup_note', t.pickup_note,
    'dropoff_lat', t.dropoff_lat, 'dropoff_lng', t.dropoff_lng, 'dropoff_note', t.dropoff_note,
    'fare_minor', t.quoted_fare_minor, 'currency', t.currency, 'payment_method', t.payment_method,
    'pickup_km', round((st_distance(l.position, t.pickup) * 1.3 / 1000.0)::numeric, 1),
    'trip_km', round((st_distance(t.pickup, t.dropoff) * 1.3 / 1000.0)::numeric, 1))
  from trip_offers o
  join trips t on t.id = o.trip_id and t.status = 'requested'
  left join driver_locations l on l.driver_id = o.driver_id
  where o.driver_id = auth.uid() and o.status = 'offered' and o.expires_at > now()
  order by o.created_at desc limit 1;
$$;

create function decline_offer(p_offer uuid) returns void
language sql security definer set search_path = public as $$
  update trip_offers set status = 'declined', responded_at = now()
  where id = p_offer and driver_id = auth.uid() and status = 'offered';
$$;

-- arrived -> start -> complete, only by the assigned driver, only in order
create function driver_update_trip(p_trip uuid, p_action text) returns trip_status
language plpgsql security definer set search_path = public as $$
declare v_trip trips;
begin
  select * into v_trip from trips where id = p_trip and driver_id = auth.uid() for update;
  if not found then raise exception 'Not your trip'; end if;

  if p_action = 'arrived' and v_trip.status = 'assigned' then
    update trips set status = 'arrived' where id = p_trip;
    return 'arrived';
  elsif p_action = 'start' and v_trip.status = 'arrived' then
    update trips set status = 'in_progress', started_at = now() where id = p_trip;
    return 'in_progress';
  elsif p_action = 'complete' and v_trip.status = 'in_progress' then
    update trips set status = 'completed', completed_at = now(), final_fare_minor = quoted_fare_minor where id = p_trip;
    insert into payments (trip_id, method, amount_minor, currency, status)
    values (p_trip, v_trip.payment_method, v_trip.quoted_fare_minor, v_trip.currency,
            case when v_trip.payment_method = 'cash' then 'paid' else 'pending' end::payment_status);
    return 'completed';
  end if;
  raise exception 'Cannot % a trip that is %', p_action, v_trip.status;
end $$;

-- ---------------------------------------------------------------- cancelling
-- A rider cancel ends the trip. A driver cancel puts it back to searching for another driver.
create function cancel_trip(p_trip uuid, p_reason text default null) returns trip_status
language plpgsql security definer set search_path = public as $$
declare v_trip trips;
begin
  select * into v_trip from trips where id = p_trip for update;
  if not found then raise exception 'Trip not found'; end if;

  if v_trip.rider_id = auth.uid() then
    if v_trip.status not in ('requested', 'assigned', 'arrived') then
      raise exception 'This trip can no longer be cancelled';
    end if;
    update trips set status = 'cancelled_by_rider', cancelled_at = now(), cancel_reason = left(p_reason, 200) where id = p_trip;
    update trip_offers set status = 'expired', responded_at = now() where trip_id = p_trip and status = 'offered';
    return 'cancelled_by_rider';
  elsif v_trip.driver_id = auth.uid() then
    if v_trip.status not in ('assigned', 'arrived') then
      raise exception 'This trip can no longer be cancelled';
    end if;
    update trips set status = 'requested', driver_id = null, vehicle_id = null, assigned_at = null,
                     dispatch_started_at = now(), cancel_reason = left(p_reason, 200)
      where id = p_trip;
    return 'requested';
  end if;
  raise exception 'Not your trip';
end $$;

-- ---------------------------------------------------------------- reading a trip
-- Everything a screen needs about one trip, for its rider, its driver or an admin.
create function get_trip(p_trip uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', t.id, 'status', t.status, 'vehicle_class', t.vehicle_class,
    'pickup_lat', t.pickup_lat, 'pickup_lng', t.pickup_lng, 'pickup_note', t.pickup_note,
    'dropoff_lat', t.dropoff_lat, 'dropoff_lng', t.dropoff_lng, 'dropoff_note', t.dropoff_note,
    'fare_minor', coalesce(t.final_fare_minor, t.quoted_fare_minor), 'currency', t.currency,
    'payment_method', t.payment_method, 'requested_at', t.requested_at, 'completed_at', t.completed_at,
    'driver', case when t.driver_id is null then null else (
      select json_build_object('id', p.id, 'name', p.full_name, 'phone', p.phone, 'photo_url', p.photo_url,
                               'rating', d.rating_avg, 'rating_count', d.rating_count)
      from profiles p join drivers d on d.profile_id = p.id where p.id = t.driver_id) end,
    'vehicle', case when t.vehicle_id is null then null else (
      select json_build_object('class', v.class, 'make', v.make, 'model', v.model, 'colour', v.colour, 'plate', v.plate)
      from vehicles v where v.id = t.vehicle_id) end,
    'driver_location', case when t.driver_id is null or t.status not in ('assigned','arrived','in_progress') then null else (
      select json_build_object('lat', l.lat, 'lng', l.lng, 'heading', l.heading, 'updated_at', l.updated_at)
      from driver_locations l where l.driver_id = t.driver_id) end,
    'rider', (select json_build_object('id', p.id, 'name', p.full_name, 'phone', p.phone)
              from profiles p where p.id = t.rider_id),
    'my_role', case when t.rider_id = auth.uid() then 'rider' when t.driver_id = auth.uid() then 'driver' else 'admin' end)
  from trips t
  where t.id = p_trip and (t.rider_id = auth.uid() or t.driver_id = auth.uid() or is_admin());
$$;

-- The trip to resume when an app reopens: an open trip for a rider, an active one for a driver.
create function my_active_trip() returns uuid
language sql stable security definer set search_path = public as $$
  select id from trips
  where (rider_id = auth.uid() and status in ('requested','assigned','arrived','in_progress'))
     or (driver_id = auth.uid() and status in ('assigned','arrived','in_progress'))
  order by requested_at desc limit 1;
$$;

-- ---------------------------------------------------------------- permissions
-- Signed-out visitors can call nothing; signed-in users can call only the functions the apps use.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function update_my_name, apply_as_driver, my_driver_status, set_my_location, quote_trip,
  dispatch_trip, request_trip, my_offer, decline_offer, accept_offer, driver_update_trip, cancel_trip,
  get_trip, my_active_trip to authenticated;
-- used inside policies, so signed-in users need to be able to run them
grant execute on function is_admin, my_role to authenticated;

-- ---------------------------------------------------------------- placeholder prices for testing
-- Stored in minor units (1 SSP = 100). THESE ARE NOT REAL JUBA PRICES: set real ones before any pilot.
update fare_rules set base_minor = 300000, per_km_minor = 150000, minimum_minor = 600000
  where vehicle_class = 'car' and currency = 'SSP' and minimum_minor = 0;
update fare_rules set base_minor = 150000, per_km_minor = 80000, minimum_minor = 300000
  where vehicle_class = 'tuk_tuk' and currency = 'SSP' and minimum_minor = 0;
-- bodas stay switched off (minimum 0 = not offered) until the boda product is ready
