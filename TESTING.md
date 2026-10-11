# Try the apps on your phones

You need two Android phones with **Expo Go** installed from the Play Store: one plays the rider, one plays the driver. A computer runs the apps and sends them to the phones.

## 1. Update the database (once)

In Supabase → **SQL Editor** → **New query**, paste all of
[`supabase/migrations/20261011010000_trip_flow.sql`](supabase/migrations/20261011010000_trip_flow.sql) and click **Run**. It should say "Success".

## 2. Turn on test sign-in (once)

Phone codes need an SMS provider, which comes later. For testing, use email:

1. Supabase → **Authentication** → **Sign In / Providers** → make sure **Email** is enabled.
2. In the same place, turn **off** "Confirm email" so test accounts work straight away.

Turn "Confirm email" back on before real users arrive.

## 3. Get the code on your computer (once)

You need [Node.js 20 or newer](https://nodejs.org) and [Git](https://git-scm.com). Then in a terminal:

```
git clone https://github.com/arudy20/aru-zakaria-juba-rides.git
cd aru-zakaria-juba-rides
npm install
```

## 4. Add your Supabase key (once per app)

In Supabase, click **Connect** at the top of your project (or go to **Project Settings** → **API Keys**) and copy the **publishable** key, also called the **anon** key. Never use the **secret** / **service_role** key in an app.

In both `apps/rider` and `apps/driver`, copy `.env.example` to a new file called `.env.local` and paste the key after `EXPO_PUBLIC_SUPABASE_ANON_KEY=`.

## 5. Start an app

```
npm run rider
```

A QR code appears. Open **Expo Go** on the rider phone and scan it. The phone and computer must be on the same Wi-Fi; if they can't be, run `npx expo start --tunnel` inside `apps/rider` instead.

For the driver phone, open a second terminal and run `npm run driver`, then scan that QR code with the other phone.

## 6. Run one trip

1. **Driver phone:** sign in with a test email (any email and a 6+ character password creates an account). Fill in the vehicle form and send the application.
2. **Approve the driver:** Supabase → **Table Editor** → `drivers` → change that row's `status` to `approved` → Save. On the driver phone, tap **Check again**, then **Go online** and allow location.
3. **Rider phone:** sign in with a different test email, enter a name, confirm the pickup, move the map to a destination, tap **See prices**, then **Book car**.
4. **Driver phone:** the request appears with a 20-second countdown. Tap **Accept**.
5. **Rider phone:** you should see the driver's name, plate and the driver moving on the map.
6. **Driver phone:** tap **I've arrived**, **Start trip**, then **Complete trip** and confirm the cash.
7. **Rider phone:** the trip ends with the fare paid.

Both phones need to be within 5 km of each other for the driver to be offered the trip.

## Prices

The prices in the database are **placeholders, not real Juba prices**: car 3,000 SSP + 1,500 SSP per km (minimum 6,000), tuk-tuk 1,500 SSP + 800 SSP per km (minimum 3,000), rounded up to the nearest 100 SSP. Change them in Supabase → Table Editor → `fare_rules` (amounts are stored × 100, so 3,000 SSP is `300000`).

## If something goes wrong

Send a screenshot of the phone and of the terminal. Most first-run problems are a missing `.env.local`, a wrong key, or the phone and computer not being on the same network.
