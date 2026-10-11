# Components — Juba Rides

Every component used by the 13 screens in `replica/recon.md`. Tokens come from `tokens.json`; components never use raw hex or pixel values.
Icons: [Lucide](https://lucide.dev) (ISC licence) — `lucide-react-native` in the apps, `lucide-react` in admin. No Uber icons, illustrations or copy.

Design rules that apply everywhere:
- **Sunlight first:** text is `text` on `bg`/`surface`; muted text only for secondary facts. Never put information in colour alone; pair it with a word or icon.
- **Bumpy-ride targets:** nothing tappable under 48 px; the main action on each screen is a 56 px full-width button in thumb reach.
- **Weak network:** every action that talks to the server has a loading state and an offline state, and keeps the label visible while loading.
- **Numbers:** fares, ETAs, plates and earnings use tabular figures and the `lg` or `fare` size.

---

```
Button
  variants  primary (accent), secondary (surface + border), ghost (text only), danger
  sizes     lg 56px (screen's main action, full width), md 48px, sm 40px (admin tables only)
  states    default, pressed (8% darker overlay), focus-visible (2px focus ring, 2px offset),
            disabled (border colour fill, text-muted label), loading (spinner + label stays), offline (disabled + "No connection")
  tokens    bg accent, text on-accent, radius md, type base/700
  a11y      real button role; loading sets accessibilityState busy; label never replaced by the spinner
  used on   all screens
```

```
Map
  variants  rider (pickup + dropoff pins, driver dot), driver (own position, pickup pin), admin (all online drivers)
  states    loading (surface fill + "Finding your location"), no GPS (notice panel + "Turn on location" button),
            offline (last known map, notice panel), filled
  tokens    pickup pin colour pickup, dropoff pin dropoff, driver dot accent with white ring, shadow pin
  a11y      map is decorative for screen readers; every fact on it (pickup, driver ETA) is repeated as text in the sheet
  used on   S02, S03, S04, S05, S09, S11, S13
```

```
Pickup pin / dropoff pin
  pickup    filled circle, colour pickup (red laterite), white centre
  dropoff   filled square, colour dropoff (ink)
  why       shape differs as well as colour, so colour-blind riders can tell them apart
  used on   S02–S05, S11
```

```
Bottom sheet
  variants  search (S02), ride options (S03), driver card (S04–S05), request (S10 driver)
  states    peek (280px), expanded (to 90% height), dragging
  tokens    bg surface-raised, radius sheet (top corners), shadow sheet, 4px handle in border
  a11y      handle has an "Expand" / "Collapse" action; content reachable without dragging
  used on   S02–S05, S09–S11
```

```
Place field (pickup / destination)
  parts     icon (pickup circle or dropoff square), place name, landmark note field under pickup
  states    empty ("Where to?"), focused, filled, error ("Outside our service area")
  landmark  optional free text, placeholder "Gate colour, nearby shop or landmark"; sent to the driver with the pin
  tokens    border border-input, radius md, type base, min height 48
  used on   S02, S03
```

```
Ride option card
  parts     vehicle class name, seats, ETA to pickup, fixed fare
  states    default, selected (2px accent border + accent-soft fill + check icon), unavailable ("No cars nearby"), loading (skeleton)
  tokens    fare type lg tabular; selected border accent
  used on   S03
```

```
Fare display
  parts     amount in fare size (40/44 bold, tabular), currency, the words "Fixed fare — this is what you pay"
  why       the product's promise: the price shown is the price paid. This is the one bold element on the booking screens.
  states    loading (skeleton the width of 5 digits), quoted, final (after trip, same amount)
  used on   S03, S06, S10
```

```
Payment picker
  options   Cash (default), m-Gurush, MTN MoMo, Company account (only for corporate riders)
  states    default, selected, unavailable ("Coming soon" while mobile money isn't connected)
  used on   S03, S06
```

```
Driver card
  parts     photo, name, rating, car colour + make + model, plate chip, call button, status line
  status    "Arriving in 4 min", "Your driver has arrived", "On the way to your destination"
  tokens    name type lg; status line accent when arriving, success when arrived
  used on   S04, S05
```

```
Plate chip
  look      plate number in lg/700 tabular, ink-panel background, on-ink-panel text, radius sm
  why       the plate is how riders find the right car; it must be the most readable thing on the card
  used on   S04, S05, S13
```

```
Request card (driver)
  parts     pickup distance + ETA, pickup landmark note, trip distance, fare, accept and decline buttons, countdown ring
  states    offered (countdown 15 s), expired ("Request expired"), taken ("Another driver took this trip")
  tokens    accept = Button primary lg; decline = Button secondary lg; countdown ring accent
  a11y      countdown announced at 10 s and 5 s; accept and decline are both 56px
  used on   S10
```

```
Online toggle (driver)
  states    offline ("Go online", Button primary lg), online ("You're online — waiting for requests" + Go offline), going online (loading)
  used on   S09
```

```
Status badge
  trip      Requested, Driver assigned, Arrived, In progress, Completed, Cancelled, No driver found
  driver    Pending review, Approved, Suspended
  payment   Pending, Paid, Failed
  look      pill, sm text, icon + word; colours success / warning / danger / text-muted on soft fills
  used on   S07, S08, S12, S13
```

```
Phone and code input
  phone     +211 prefix fixed, numeric keypad, formats as 9xx xxx xxx
  code      6 boxes, auto-advance, paste fills all, SMS autofill on Android
  states    empty, invalid ("Enter a 9-digit South Sudan number"), sending, wrong code ("That code didn't match. Check the SMS and try again."), expired ("Code expired. Send a new one.")
  used on   S01
```

```
Star rating
  parts     5 stars, 48px each, optional comment
  states    empty, selected, submitted
  a11y      radio group "Rate your driver, 1 to 5 stars"
  used on   S06
```

```
File upload (driver documents)
  parts     document name, photo/file button, preview thumbnail, status badge
  states    empty, uploading (progress), uploaded, rejected (reviewer note shown in danger)
  used on   S08
```

```
Notice panel
  look      notice background, text colour text, icon; full width under the header or in the sheet
  uses      "No connection — we'll keep trying", "Location is off", "Cash trip: pay your driver 15,000 SSP"
  used on   all screens
```

```
Earnings summary (driver)
  parts     today / this week totals (fare size), trips count, commission owed (cash trips), list of trips
  states    empty ("No trips yet today. Go online to start earning."), filled
  used on   S12
```

```
Admin table + live map (web)
  parts     sortable table with status badges, filters, row actions; map panel with online drivers
  tokens    Tailwind preset from tailwind.preset.cjs; sidebar 240px; max width 1280px
  used on   S13
```

## Empty and error copy (written fresh)

| where | text |
| --- | --- |
| S02 no GPS | Location is off. Turn it on so your driver can find you. |
| S03 outside area | We don't cover this area yet. Pick a spot inside Juba. |
| S04 no driver | No drivers are free nearby right now. Try again in a few minutes. |
| S04 driver cancelled | Your driver cancelled. We're finding you another one. |
| S07 empty | Your trips will show here after your first ride. |
| S09 no requests | You're online. Requests will appear here. |
| S12 empty | No trips yet today. Go online to start earning. |
| any offline | No connection. We'll keep trying. |
