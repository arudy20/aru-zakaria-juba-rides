# Architecture: Juba Rides (working name; a rebuild of Uber's core ride loop for Juba)

Reads `replica/recon.md` and `replica/features.csv`. Next step: `/replica-design`.

## Stack

| layer | choice | why |
| --- | --- | --- |
| rider app | Expo (React Native) + TypeScript, `apps/rider` | one codebase for Android and iPhone; test on a phone with Expo Go |
| driver app | Expo (React Native) + TypeScript, `apps/driver` | same tools as the rider app; background location via `expo-location` |
| admin dashboard | Next.js (App Router) + TypeScript + Tailwind, `apps/admin` | runs in any browser; fast to build tables and forms |
| shared code | `packages/shared` (types, fare formatting, status labels) | rider, driver and admin speak the same language |
| database | Postgres on Supabase, with PostGIS | one database; PostGIS answers "nearest driver" in one query |
| live updates | Supabase Realtime on `driver_locations`, `trips`, `trip_offers` | live driver dot and trip status without running our own socket server |
| auth | Supabase Auth, phone + SMS one-time code | no email needed; open question: an SMS provider that delivers reliably to Zain and MTN South Sudan numbers |
| server logic | Supabase Edge Functions (TypeScript) | trip requests, matching, cancellations, payments; the client never sets fares or statuses |
| maps | Google Maps SDK (apps) + Maps JavaScript API (admin) | best coverage to start; compare Mapbox/OpenStreetMap on Juba streets before launch |
| files | Supabase Storage, private bucket `driver-documents` | licences and vehicle papers; admins only |
| SMS booking + alerts | an SMS gateway with South Sudan coverage (to choose) | should-have; reaches riders without data |
| payments | cash first; m-Gurush / MTN MoMo when merchant API access is confirmed | Stripe does not serve South Sudan; mobile money is the card here |
| hosting | Supabase (database + functions), Vercel (admin), Expo EAS (app builds) | managed, cheap at zero users |

Monorepo with npm workspaces: `apps/rider`, `apps/driver`, `apps/admin`, `packages/shared`, `supabase/`.

## Schema

Tables: 11. Access rules: Postgres row level security; every table has RLS on, admins see everything.
SQL: `supabase/migrations/20261011000000_init.sql` (tested on Postgres 16 + PostGIS 3).

| table | holds | notes |
| --- | --- | --- |
| organizations | corporate clients (NGOs, hotels) | invoice currency, billing contact |
| profiles | one per user: phone, name, role, org | role can't be self-promoted |
| drivers | approval status, commission, rating | commission in basis points (1000 = 10%) |
| vehicles | class, make, model, colour, plate | plate unique |
| driver_documents | licence, registration, photo, ID | files in private storage |
| driver_locations | one live row per driver | GIST index on online drivers |
| fare_rules | base, per km, minimum, per class + currency | one active rule per class |
| trips | pickup/dropoff + landmark notes, status, fixed quoted fare | one active trip per driver and per rider, enforced by unique indexes |
| trip_offers | which drivers were offered a trip, expiry | at most one accepted |
| ratings | both directions, 1–5 stars | only after a completed trip, only between its rider and driver |
| payments | cash / mobile money / invoice | provider ref unique, so a mobile money callback can't count twice |

Server functions already in SQL:
- `quote_fare(class, pickup, dropoff)` — fixed price: straight-line km × 1.3 road factor × per-km rate + base, at least the minimum. No surge.
- `nearest_drivers(pickup, class, radius, limit)` — online, approved, fresh (seen in the last 2 min), not on a trip, nearest first.
- `accept_offer(offer_id)` — locks the trip; exactly one driver wins if two tap at once.

## API (edge functions)

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| POST /quote | price for each vehicle class | rider | pickup, dropoff | fares per class | F01 |
| POST /trips | create trip at the quoted fare, offer to nearest drivers | rider | pickup, notes, dropoff, class, payment method | trip | F01 |
| POST /trips/:id/cancel | cancel with reason | rider or driver | reason | trip | F04 |
| RPC accept_offer | take the trip | driver | offer id | true/false | F02 |
| POST /offers/:id/decline | decline, offer moves to next driver | driver | — | — | F02 |
| POST /trips/:id/arrived · /start · /complete | advance status; complete records cash payment | assigned driver | — | trip | F02 |
| PUT driver_locations (direct, RLS) | heartbeat every 5 s while online | driver | lat, lng, heading | — | F02 |
| POST /ratings (direct, RLS) | rate the other party | rider or driver | stars, comment | — | F01, F02 |
| POST /drivers/apply + storage upload | submit documents | driver | vehicle, files | driver | F03 |
| POST /admin/drivers/:id/approve · /suspend | review drivers | admin | note | driver | F03 |
| PUT /admin/fares | set prices | admin | rule | rule | — |

Webhooks in: mobile money payment callbacks (later). Webhooks out: none.
Jobs (Supabase cron, every 15 s): expire unanswered offers and offer the trip to the next nearest driver; after 3 rounds or 3 minutes, mark `no_driver_found` and tell the rider.

## The parts that bite

- **Live tracking:** drivers send their position every 5 s; on a weak network, send the latest only (never a backlog), and show "last seen 40 s ago" rather than a frozen dot.
- **Races:** two drivers accepting at once is handled in the database (row lock + unique index), not in the app. Tested.
- **Offline / patchy data:** every status change is retried until the server confirms; the server is the source of truth. The rider app must survive the app closing mid-trip and pick up where it was.
- **Cash:** the driver collects the fare and owes the commission. The earnings screen shows a running "commission owed" balance; ops settles weekly.
- **Idempotency:** mobile money callbacks can arrive twice; the unique provider reference stops double payment.
- **Currency:** pounds lose value fast; fares live in `fare_rules` so ops can reprice without an app update. Corporate accounts can be billed in USD.
- **Location privacy:** a rider sees a driver's location only while that driver is assigned to their trip (RLS). Tested.
- **Phone numbers:** shown to the other party only during an active trip; masked calling later.

## Build order

1. **Vertical slice** — one trip end to end, ugly, cash only, cars only.
   Screens S01, S02, S03, S04, S09, S10, S11. Tables: profiles, drivers, vehicles, driver_locations, fare_rules, trips, trip_offers.
   Routes: /quote, /trips, accept_offer, /arrived, /start, /complete, location heartbeat. Done when: a rider on one phone books, a driver on another accepts, both see each other move, the trip completes.
2. **Must-haves** — S05 trip in progress, S06 pay + rate, S07 history, S08 onboarding with documents, S12 earnings with commission owed, S13 admin (approve drivers, live map, fares, trips), cancellations, no-driver-found.
3. **Should-haves** — share trip + emergency contact, ratings both ways shown, corporate accounts + monthly invoice export, low-data mode, SMS booking, mobile money.
4. **Fixes from the sizing research** — published fixed fares (done in schema), visible commission, a human support line, cancellation penalties for repeat cancellers, a driver appeal before suspension.
