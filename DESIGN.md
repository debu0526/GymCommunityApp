# Design System — Gym Community App

Single source of truth for how the app looks and feels. Dark-only, minimalist
**gunmetal + amber**. Every value below lives as a typed token in
`theme/theme.ts` — screens import from it and never hardcode a hex or a size.

Visual reference: `code/design-mockup.html` (the original static mockup).

---

## Direction

Minimal, gunmetal dark, one amber accent. Layered greys create depth; amber is
reserved to mark every action, streak, and PR so the eye always knows where the
"live" thing is. Condensed display type carries numbers and titles; a clean sans
handles everything else; controls are bold, fully-rounded pills.

The guiding rule: **grey is the room, amber is the spotlight.** If everything is
amber, nothing is — accent sparingly.

---

## Color tokens

| Token | Value | Use |
|---|---|---|
| `bg` | `#0E1113` | Deepest layer, behind everything |
| `appBg` | `#16191C` | Screen background |
| `surface` | `#1F252A` | Cards, rows |
| `surface2` | `#272E34` | Elevated cards / inset controls |
| `hairline` | `#333B42` | Borders, dividers |
| `text` | `#F1F4F5` | Primary text |
| `text2` | `#A7B0B7` | Secondary text |
| `text3` | `#6C757D` | Muted labels / captions |
| `amber` | `#FFA23A` | Accent: buttons, streaks, PRs, active state |
| `amberStrong` | `#FF8C1A` | Pressed amber |
| `amberDim` | `rgba(255,162,58,0.14)` | Amber tint background (pills, tints) |
| `onAmber` | `#141518` | Text/icons sitting on an amber fill |
| `success` | `#5AD19A` | Set done / positive delta |

Dark-only by design — there is no light theme (tracked as a deferred feature).

---

## Typography

- **Display / numbers — Bebas Neue** (condensed): screen titles, streaks, PR and
  weight numbers, any large stat.
- **Body / UI — Inter** (weights 400 / 500 / 600 / 700): everything else.

Loaded via `expo-font` `useFonts` from `@expo-google-fonts/bebas-neue` and
`@expo-google-fonts/inter`.

**Scale**

| Role | Font | Size |
|---|---|---|
| Hero number (streak) | Bebas | 64–78 |
| Screen title | Bebas, uppercase | 34 |
| Stat number | Bebas | 28–40 |
| Section label | Inter 600, uppercase, `text3` | 12, letter-spacing ~1.2 |
| Body | Inter 400 | 15 |
| Caption | Inter 400, `text3` | 12–13 |
| Button label | Inter 600 | 15 |

---

## Shape & spacing

- **Card radius:** 20px. **Buttons / tags / pills:** full pill (999px).
- **Spacing scale:** `4, 8, 12, 16, 20, 24, 32` (xs → xxxl) — never use raw
  numbers in layout, pull from `spacing`.
- **Cards:** `surface` background + 1px `hairline` border, flat (no drop shadow).

---

## Components

- **Primary button** — amber fill, `onAmber` label, pill.
- **Soft button** — `amberDim` background, amber label.
- **Ghost button** — transparent, 1px `hairline` border, `text` label.
- **Tag / pill** — `amberDim` for streak/PR/active, grey (`surface2`) for neutral.
- **Set row** — numbered badge (amber-dim when completed) + reps + weight.
- **Stat tile** — muted label + big Bebas number + optional delta.
- **Nav pill** — a tappable row (icon + title + subtitle + chevron) that pushes a
  dedicated page. See the navigation convention below.

---

## Navigation conventions

These are durable patterns the app follows everywhere unless a screen explicitly
needs otherwise.

### New page + pill

A sizeable feature or sub-section gets its **own page** plus a single tappable
**pill** on the parent screen — it is **not** inlined as a large block. The pill
shows an icon, a title, and a one-line subtitle; tapping it `router.push`es the
dedicated page. Examples: *Per-exercise trends*, *Body progression*, and (v0.25)
*Volume by muscle* → the **Training Volume** page (`app/volume/index.tsx`).

### Swipeable segmented tabs

Wherever a screen has 2+ peer views, use the shared `components/SwipeTabs.tsx`:
equal-width segments that are both **tappable and horizontally swipeable**, with
an amber indicator that tracks the swipe frame-for-frame. The indicator snap is
gated by the user's **Animations** toggle (falls back to a plain jump when
reduced). Used by Past Logs (Workouts ↔ Exercises) and the Learn / how-to
browsers — the behaviour is one component, consistent everywhere.

### Collapsible sections

Long or secondary lists collapse behind a tappable header (label + optional count
badge + chevron) and expand only on tap — e.g. Home → *Recent workouts*, and
Profile → *Preferences* (gear icon + chevron). Keeps first paint clean.

---

## Tab bar (5 tabs)

Home · Log · Progress · Learn · Profile. Inactive icons `text3`, active `amber`.
`appBg` background with a top `hairline`. The active indicator slides along the
top border between tabs with a small droplet pop (gated by the Animations
toggle).

---

## Motion & haptics

- Subtle haptics are fine on ordinary taps (selection feedback).
- Micro-animations plus a **celebratory** haptic fire **only at completion
  milestones** — finishing all sets of an exercise, finishing a whole workout,
  marking a gym day, hitting a streak milestone or a new PR. Never per small step.
- Example: marking an attendance day pops (spring scale) + success haptic;
  un-marking does not.
- All non-essential motion respects the **Animations** setting (Profile →
  Preferences). When reduced, animated transitions degrade to instant state
  changes rather than disappearing.

---

## Implementation notes

- All tokens live in `theme/theme.ts` as a typed object (`colors`, `spacing`,
  `radius`, `fonts`). Import from it; never hardcode a hex or a size in a screen.
- New screens are file-based routes under `app/` (Expo Router).
- The app is local-first (expo-sqlite); nothing in the design assumes network
  availability.
