# Juba Rides

A ride-hailing service for Juba, South Sudan: vetted drivers, fixed prices shown up front, cash or mobile money, and corporate accounts for NGOs, hotels and businesses. "Juba Rides" is a working name.

## Status

Planning done, building next.

| step | status |
| --- | --- |
| Recon (how Uber works, adapted for Juba) | done — `replica/recon.md`, `replica/features.csv` |
| Architecture (stack, database, API, build order) | done — `replica/architecture.md` |
| Database schema | done and tested — `supabase/migrations/` |
| Design system | next — `/replica-design` |
| Build: rider app, driver app, admin dashboard | after design — `/replica-build` |

## How to work on it

Open this folder in Claude Code. The Replica skills are already in `.claude/skills/`, so the commands work straight away:

```
/replica-design     colours, type, components
/replica-build      builds the apps screen by screen, vertical slice first
/replica-backend    sign-in, database, payments, SMS
/replica-test       tests every flow for bugs
```

## What you need

- Node.js 20 or newer
- A free [Supabase](https://supabase.com) project (database, sign-in, live updates)
- The Expo Go app on an Android phone, to try the apps while they're built
- Later: a Google Maps API key and an SMS provider that covers South Sudan

Keys go in `.env.local` files, never in the repo.
