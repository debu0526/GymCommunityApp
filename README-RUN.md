# Gym App — How to Run (Phase 1 Skeleton)

This is the running app skeleton: a themed 5-tab app (Home, Log, Progress, Learn, Profile) with fonts, a local SQLite database, and a working **gym attendance calendar** in the Log tab.

## First time only

1. Make sure Node.js is installed (`node -v` should print a version — you did this in Phase 0).
2. Open a terminal **in this folder** (the one containing `package.json`) and install dependencies:

```powershell
npm install
```

That downloads everything into a `node_modules` folder. It can take a couple of minutes the first time.

## Run it

```powershell
npx expo start
```

A QR code appears in the terminal. On your phone:

- **Android:** open the **Expo Go** app → scan the QR code.
- **iPhone:** open the **Camera** app → point at the QR code → tap the banner to open in **Expo Go**.

Your phone and PC must be on the **same Wi-Fi**. The app loads live; when you edit a file and save, it refreshes automatically.

## What you can do in this build

- **Home tab:** shows your current attendance **streak** and gym days this month.
- **Log tab:** tap any day on the calendar to mark you went to the gym. Marked days turn amber, you get a small pop + a success buzz, and it's saved on the phone (works in airplane mode). Tap again to unmark. Use the arrows to change month.
- **Progress / Learn / Profile:** themed "coming soon" placeholders for later phases.

## Troubleshooting

- **QR won't connect:** ensure same Wi-Fi; or in the terminal press `s` to switch, or run `npx expo start --tunnel`.
- **"command not found":** close and reopen the terminal so it picks up Node on the PATH.
- **Something looks broken after editing:** press `r` in the terminal to reload.

## Project structure

```
src/
  app/
    _layout.tsx            # loads fonts + DB, then shows the app
    (tabs)/
      _layout.tsx          # the bottom tab bar
      index.tsx            # Home
      log.tsx              # Log (attendance calendar)
      progress.tsx / learn.tsx / profile.tsx   # placeholders
  components/              # Screen, PillButton, AttendanceCalendar, ComingSoon
  db/database.ts           # SQLite: open, migrations, attendance helpers
  lib/attendance.ts        # pure date/streak helpers
  theme/theme.ts           # all colors, spacing, fonts (the design tokens)
```

Everything visual comes from `src/theme/theme.ts` — change a color there and it updates everywhere.
