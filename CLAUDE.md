# Juba Rides — project notes for Claude

A ride-hailing app for Juba, South Sudan, built with the Replica skills (in `.claude/skills/`).
Owner: Aru Zakaria Atem (product owner, not a full-time developer — explain what you change in plain words).

## Where things are
- `replica/` — the plan: `recon.md` (screens S01–S13, flows F01–F04), `features.csv` (feature matrix), `architecture.md` (stack, API, build order). Read these before building.
- `supabase/migrations/` — the database. Never edit a migration that has been applied; add a new one.
- `apps/rider`, `apps/driver` — Expo (React Native) apps. `apps/admin` — Next.js dashboard. `packages/shared` — shared types. (Not created yet: `/replica-build` creates them.)

## Rules for this project
- Next Replica step: `/replica-design`, then `/replica-build` starting with the vertical slice in `architecture.md`.
- Juba first: cash is the default payment; pickups are map pins plus a landmark note; assume weak networks.
- Fixed fares only. No surge pricing.
- The client never sets fares or trip statuses directly; that goes through edge functions or the SQL functions.
- Never commit keys. Put variable names in `.env.example`; real values go in `.env.local`, which the owner fills in.
- Update the `clone` column in `replica/features.csv` as features are finished.

## Services
- Supabase project URL: https://kqaccrkgcxsptvidkpiq.supabase.co (public; keys stay in `.env.local`)
- GitHub: https://github.com/arudy20/aru-zakaria-juba-rides
