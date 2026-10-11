# Recon map: Uber (Android + iOS + web admin)

Scope: the core ride loop — request, match, track, pay, rate — plus driver onboarding and an ops dashboard. Adapted for Juba, South Sudan.
For: a Juba ride-hailing service, first sold to NGOs, hotels and businesses (vetted drivers, fixed prices, monthly invoicing), then opened to the public.
Date: 2026-10-11

Full sizing write-up, with market research and sources: the "Ride-Hailing in Juba: Replica Sizing" doc.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Uber rider app listing | https://apps.apple.com/app/uber-request-a-ride/id368677368 | screens, pitch |
| 2 | Uber driver app listing | https://apps.apple.com/app/uber-driver-drive-deliver/id1131342792 | driver screens |
| 3 | Uber help center | https://help.uber.com | feature list, policies |
| 4 | Shilu-ANA (local competitor) | https://apps.apple.com/us/app/id1480204287 | Juba incumbent since 2019 |
| 5 | TechCabal on Juba ride-hailing | https://techcabal.com/?p=171329 | market, failures, conditions |
| 6 | Unstar complaint analysis | https://unstar.app/blog/ride-sharing-app-reviews-uber-lyft-bolt-grab-2026 | rider complaints |
| 7 | Khusoko on Kenya driver lawsuit | https://khusoko.com/2025/11/06/uber-bolt-face-kenya-lawsuit-over-driver-exploitation/ | driver complaints |

## Core loop

A rider sets a pickup and destination, sees a fixed price, gets matched with the nearest vetted driver, tracks them live, rides, pays (cash or mobile money) and rates.

## Screens

| ID | screen | app / route | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign up / phone verification | rider + driver: `/auth` | account by phone + SMS code | phone input, OTP input | empty, sending, wrong code, expired |
| S02 | Home map + "Where to?" | rider: `/` | set pickup and destination | map, pin, search sheet, landmark note | locating, no GPS, filled |
| S03 | Ride options + fare | rider: `/quote` | pick vehicle class, see fixed price | option cards, fare, payment picker | loading, no service in area |
| S04 | Finding / driver on the way | rider: `/trip/:id` | live driver location, ETA, car + plate, call | map, driver card, cancel button | searching, no driver found, assigned, arriving |
| S05 | Trip in progress | rider: `/trip/:id` | live route, share trip, emergency | map, share sheet, SOS button | in progress, offline |
| S06 | Pay + rate | rider: `/trip/:id/done` | confirm payment, rate driver | fare summary, stars, comment | cash due, mobile money pending, paid |
| S07 | Trip history | rider: `/trips` | past trips, report a problem | list, receipt | empty, filled |
| S08 | Driver onboarding | driver: `/onboarding` | licence, vehicle, photo upload | form, file upload, status | draft, submitted, rejected, approved |
| S09 | Go online / waiting | driver: `/` | toggle availability | big toggle, map, today's earnings | offline, online, no requests |
| S10 | Incoming request | driver: modal | accept or decline within ~15 s | countdown, pickup distance, fare | offered, expired, taken by another |
| S11 | To pickup + trip | driver: `/trip/:id` | navigate, arrive, start, end | map, nav button, status buttons | to pickup, arrived, in progress |
| S12 | Earnings | driver: `/earnings` | earnings, commission, cash owed | totals, trip list | empty, filled |
| S13 | Ops dashboard | admin web: `/admin` | approve drivers, live map, fares, trips, disputes | tables, live map, forms | — |

## Flows

```
F01 Rider takes a trip
    S02 -> S03 -> S04 -> S05 -> S06
    happy path taps: 4 (set destination, confirm, ... ride ..., rate)
    edge: no driver nearby, driver cancels, rider cancels, GPS off, network drops mid-trip,
          driver never arrives, wrong pickup spot, cash dispute

F02 Driver completes a trip
    S09 -> S10 -> S11 -> S12
    edge: two drivers accept at once, request expires, rider no-show, phone dies mid-trip

F03 Driver joins
    S01 -> S08 -> admin approval in S13 -> S09
    edge: blurry document, expired licence, rejected then resubmitted

F04 Something goes wrong
    cancellation (either side), no driver found, payment fails, rider reports a problem -> S13 dispute
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, danger, ghost | default, pressed, disabled, loading | all |
| Map | rider, driver, admin | loading, no GPS, offline | S02–S05, S09, S11, S13 |
| Bottom sheet | search, options, driver card | collapsed, expanded | S02–S05 |
| Phone / OTP input | — | empty, invalid, sending, error | S01 |
| Driver card | — | arriving, arrived | S04, S05 |
| Request card | — | countdown, expired | S10 |
| Star rating | — | empty, selected | S06 |
| Status badge | trip, driver, payment | per status | S07, S08, S12, S13 |
| File upload | document, photo | empty, uploading, done, rejected | S08 |

## Inferred data model

```
Profile      id, phone, full_name, role (rider | driver | admin), photo_url
             evidence: S01, S08   confidence: high
Driver       profile_id, status (pending | approved | suspended), rating_avg, commission_rate
             evidence: S08, S12, S13   confidence: high
Vehicle      driver_id, class (car | boda | tuk_tuk), make, model, colour, plate
             evidence: S04, S08   confidence: high
DriverDocument  driver_id, kind (licence | vehicle_reg | photo | id), file, status
             evidence: S08   confidence: high
DriverLocation  driver_id, position (point), heading, is_online, updated_at
             evidence: S04, S09   confidence: high
FareRule     vehicle_class, base, per_km, per_min, minimum, currency
             evidence: S03 (fixed price up front)   confidence: medium
Trip         rider_id, driver_id, class, pickup, pickup_note, dropoff, status,
             quoted_fare, final_fare, currency, payment_method, org_id
             evidence: S03–S07, S11   confidence: high
TripOffer    trip_id, driver_id, status (offered | accepted | declined | expired), expires_at
             evidence: S10   confidence: medium (Uber's internals are hidden; this is our design)
Rating       trip_id, from_profile, to_profile, stars, comment
             evidence: S06   confidence: high
Payment      trip_id, method (cash | mgurush | momo | invoice), amount, status
             evidence: S06, S12   confidence: medium
Organization id, name, billing_contact, invoice_terms (new: corporate accounts)
             evidence: Uber for Business; our corporate angle   confidence: medium
```

Relationships: Profile 1-1 Driver, Driver 1-n Vehicle, Driver 1-n DriverDocument, Driver 1-1 DriverLocation,
Profile(rider) 1-n Trip, Driver 1-n Trip, Trip 1-n TripOffer, Trip 1-n Rating, Trip 1-n Payment,
Organization 1-n Profile (members), Organization 1-n Trip.

## Feature matrix

See `features.csv`. Must: 10, should: 6, could: 3, skip: 3.

## Out of scope (cannot or should not be cloned)

- Uber's riders and drivers (the network), its brand, its mapping and pricing data, its city licences.
- Surge pricing: deliberately left out, it is the top rider complaint.
- Food and parcel delivery: a different business.

## Size

Screens 13, flows 4, entities 11. Hard parts: live driver tracking, matching without double-assignment, payments (cash reconciliation, mobile money), patchy networks. Size: **L** (about a quarter to a working pilot).
