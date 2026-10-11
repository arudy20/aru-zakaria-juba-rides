# Build log

One line per screen: ID, date, status, what is missing, what was harder than expected.

| ID | screen | date | status | missing | notes |
| --- | --- | --- | --- | --- | --- |
| S01 | Sign-in (phone + code) | 2026-10-11 | partial | SMS provider not connected; email sign-in used for testing | shared by both apps |
| S02 | Home map + where to | 2026-10-11 | done | place search (typing a place name) | pickup and destination set by moving the map under a fixed pin, plus a landmark note |
| S03 | Ride options + fixed fare | 2026-10-11 | done | mobile money and company account options | fares rounded up to the nearest 100 SSP for cash; placeholder prices |
| S04 | Finding / driver on the way | 2026-10-11 | done | masked calling | rider app keeps offering the trip every 4 s while searching, so no server job is needed yet |
| S05 | Trip in progress | 2026-10-11 | partial | share trip, emergency contact | live route works; status shown |
| S06 | Pay + rate | 2026-10-11 | partial | ratings | end-of-trip screen shows the fare paid in cash |
| S07 | Trip history | — | not started | | |
| S08 | Driver onboarding | 2026-10-11 | partial | document upload, photo | vehicle details form; approval is done by hand in Supabase for now |
| S09 | Go online / waiting | 2026-10-11 | done | earnings on the map, background location | location sent every 5 s / 20 m and every 20 s when parked |
| S10 | Incoming request | 2026-10-11 | done | sound and vibration | 20-second countdown; two drivers can't win the same trip (tested in the database) |
| S11 | To pickup + trip | 2026-10-11 | done | in-app turn-by-turn | "Navigate" opens Google Maps; cash collection confirmed before completing |
| S12 | Earnings | — | not started | | |
| S13 | Admin dashboard | — | not started | | approve drivers in the Supabase table editor until then |

Harder than expected: none of the slice so far. Bigger than it looks, and worth planning for: background location for drivers (needs a development build, not Expo Go) and SMS delivery to South Sudan numbers.

Not yet tested on real phones: the apps type-check and bundle cleanly, and the database flow is tested end to end, but the first run on two phones is the real test.
