# Sailing Trainer — agent notes

Interactive 3D trainer for dinghy sailing basics, starting with a single-handed **ILCA (Laser)**: points of sail, what each rope does to the sail, and (next) the Racing Rules of Sailing. Proof of concept; the README has the human-facing overview and keyboard controls.

## Stack and commands

Vite 8 · React 19 · @react-three/fiber 9 + three 0.186 · zustand 5 · TypeScript ~6 · Sass · oxlint.

```sh
npm run dev      # vite dev server
npm run build    # tsc -b && vite build  — the type check
npm run lint     # oxlint
```

No test suite. Verify changes with `npx tsc -b --noEmit`, `npm run lint`, and by running the app (see "Verifying in the browser"). No formatter yet — Prettier was proposed and deliberately deferred; don't add it unasked. Match the existing style: no semicolons, single quotes, wide lines.

## Architecture

```
src/sim/      pure model — no React, no three.js
  types.ts      coordinate conventions + BoatState / Derived / Trim / Wind
  boat.ts       windAngles(), idealTrimFor(), derive() (everything computed from state), step() (integrate dt)
  polar.ts      NO_GO_DEG + simplified ILCA speed polar (ANGLE_KNOTS)
  math.ts       DEG/RAD, clamp, lerp, approach, wrapPi
src/scene/    react-three-fiber rendering; reads the store in useFrame via useSim.getState()
src/ui/       DOM overlay: HUD, Compass, Controls (trim panel), Panel (lessons), ShapeReadout
src/hooks/    useInput (keys + on-screen buttons), useIsPhone, useViewInsets
src/lessons/  lesson content as typed data (points of sail, controls glossary, RRS rules)
src/store.ts  zustand store — single source of truth for sim + UI state
```

- **Loop:** `SimLoop` in `scene/Scene.tsx` runs each frame: `input.apply(dt)` then `store.tick(dt)`. `tick` calls `step()`, which mutates `boat` in place, then publishes `{ boat: { ...boat }, derived }` so subscribers re-render.
- **Per-frame reads:** scene components read `useSim.getState()` inside `useFrame` (no re-render). UI components subscribe with selectors. `derived.hints` is a new object every step, so subscribe to it with `useShallow`, or the component re-renders every frame.
- **Shared mutable singletons** (deliberately outside React/zustand, read per frame): `virtualKeys` in `useInput.ts` (on-screen ◀ ▶), `viewInsets` in `useViewInsets.ts` (pixels covered by phone UI).
- **Dev handle:** `window.__sim` is the store in dev builds, handy for poking state from the console or a test script.

## Conventions that matter

- **Coordinates** (header of `sim/types.ts`): +X east, −Z north, Y up. Heading 0 = north, increasing clockwise. Wind `fromDir` is the bearing the wind comes FROM. TWA/AWA are signed, +ve = wind over starboard. **Radians internally; degrees only at the UI boundary** (`toDeg` in `store.ts` rounds).
- **Boat local frame:** forward = −Z, starboard = +X, waterline y = 0. The boat group is `rotation.set(0, -heading, -heel)` and lifted by `rideHeight(heel)` in `Boat.tsx`.
- **Single sources of truth — derive from these, never re-hardcode:**
  - `NO_GO_DEG` (`sim/polar.ts`, 40°): the polar's zero zone, `inIrons`, the lesson ranges in `pointsOfSail.ts`, the compass sectors (built from the lesson ranges), and the Panel goals.
  - In-irons and the point-of-sail badge both compare **whole degrees** (`Math.round`), so they flip at the same angle.
  - Phone breakpoints: `PHONE_MAX_WIDTH` / `PHONE_LANDSCAPE_MAX_HEIGHT` in `hooks/useIsPhone.ts`, mirrored by `$phone` / `$phone-landscape-height` in `index.scss` (Sass can't import TS — keep them in sync by hand).
  - Hull: the `KNOTS` table in `hullGeometry.ts` is the shape; `HULL_HALF_BEAM` and `HULL_SHEER_AT_BEAM` are derived from it.
  - Rig: `MAST_Z`, `HEAD_Y`, `BOOM_LENGTH`, etc. in `sailGeometry.ts`.
- **Heel is visual + HUD only.** The sim never reads `boat.heel` back. Range: `HEEL_GAIN` 24°, `MAX_HEEL` 28° in `sim/boat.ts`.
- **`aoa` is only geometric.** `luffing` is authoritative for whether the sail works (in irons it luffs even when `aoa` looks healthy).
- Comments: only for non-obvious *why*. The codebase uses short `/** */` doc lines on constants and functions.
- Styles: one `src/index.scss`. Tokens are Sass variables, re-emitted as CSS custom properties on `:root`. Mixins: `phone`, `phone-landscape`, `glass`, `pill`. Phone overrides are nested inside the rule they override.

## Phone layout (desktop must stay unchanged)

**Rule from the user: mobile changes must not affect the desktop layout.** Everything phone-specific is gated by `useIsPhone()` / the `phone` mixin.

- `useIsPhone()` is true for portrait ≤ 720px wide **or** landscape ≤ 500px tall. It updates live on resize and rotation.
- `HUD.tsx` renders a separate compact phone bar (`.hud-top`) built from the same sub-components as the desktop HUD.
- `App.tsx` wraps `<Controls/>` + `<Panel/>` in `.dock`. On desktop `.dock` is `display: contents` (no box); on phone it's a bottom grid: `◀ ☰ ▶` row over a 2×2 trim grid. The ☰ panel opens as a fixed bottom sheet.
- The phone top bar and dock report their size via `useReportInset` → `viewInsets`. `CameraRig.frameInStrip()` then backs the camera off and offsets the projection so the whole rig fits between them, following heel (per-mode `SUBJECT` box). With no insets (desktop) it's a no-op.
- `WindStreaks` shows the true wind as thin streaks drifting downwind on the water around the boat (one shader draw call; wraps in a square that follows the boat), so it needs no narrow-screen fitting.
- `Wake` lays a foam ribbon behind the transom (Kelvin 19.5° spread, fades over `LIFE` s, strength from boat speed). It and `Water` share `WAVE_GLSL` and clock time, so the wake rides the same swell.
- Keyboard-hint `<kbd>`s on buttons and sliders are hidden under `(hover: none)`; those inside lesson prose stay.

## Trim features

- `derive()` exposes `idealTrim` (also the basis for the ▲/▼ hints). **In irons the ideal is "leave everything as is"**, so entering the no-go zone never moves the trim.
- "Ideal trim" button → `applyIdealTrim()` (one-off). "Keep ideal" checkbox → `autoTrim`, re-applied each `tick`. **Any manual trim change (slider or keys, via `setTrim` / `nudgeTrim`) switches `autoTrim` off.**
- In irons: `luffing` is forced on, drive = 0, the badge says "In irons — bear away", and the hints show "—".
- `ShapeReadout` (Depth / Draft / Twist / Bend) is intentionally hidden with `display: none`. It returns later in an "advanced view", **with plain-language explanations** — the user doesn't know these terms, so don't expose the bare numbers again.

## ILCA reference dimensions (verified)

The model aims to be **close to the real boat, not exact** — skip changes that are a lot of work for a small visual gain.

| Item | Real ILCA | Model |
|---|---|---|
| LOA / LWL | 4.23 m / 3.81 m | 4.20 m / ~3.76 m (bow and stern ends lifted via negative keel depth) |
| Beam | 1.37 m | 1.38 m |
| Hull-only draft / max draft | 0.10 m / ~0.80 m | 0.10 m; no daggerboard (removed — it was always hidden underwater) |
| Mast step from transom | 2.903–2.947 m | 2.92 m (`MAST_Z = -0.82`) |
| Mast sections | 2.865 m bottom + 3.60 m top, 0.305 m overlap | masthead at y 6.1 |
| Boom / sail foot / luff | ≤ 2.74 / ≤ 2.74 / ≤ 5.13 m | 2.75 / 2.70 / 4.95 m |
| Rudder blade | ≤ 0.635 m long, 0.203 m chord | 0.60 × 0.20 m |
| Daggerboard | 0.68 m below keel, 0.341 m chord | — |
| Transom width | 0.965–1.067 m | 1.00 m |
| Cockpit | ≥ 0.965 m long, aft end 0.68–0.80 m from transom | 1.0 m, aft end ~0.7 m |

Unverified: freeboard / deck height (sheer is flat 0.25 m, user's choice), and how the 0.42 m of overhang splits between bow and stern (assumed ~0.34 bow / ~0.10 stern).

Sources: [ILCA measurement diagrams](https://ilcasailing.org/rules-and-technical/measurement-diagrams/). They are JPEG images: WebFetch returns unreadable bytes, so read the downloaded image file directly. sailboatdata.com returns 403 to automated fetches — ask the user to paste figures.

## Known issues / backlog

- On a run the badge says "Stalled — ease the sheet" even at ideal trim (the boom tops out at 85°, so the sail is always stalled downwind). Badge advice needs a downwind case.
- With "Keep ideal" on, **leaving** the no-go zone snaps the trim to the new ideal in one frame (entering is handled).
- Wind direction is fixed from north (the "From" slider was removed on purpose). Only wind speed is adjustable.
- Lesson text still mentions the daggerboard although the model has none.

## Verifying in the browser

Use the chrome-devtools MCP tools against `npm run dev`.

- **Viewports:** phone portrait `430x932x2,mobile,touch`; desktop `1440x900x1`. Check every layout change on both, and all three camera modes (chase / sail / top) for anything that affects framing.
- **Drive state from a script:** `window.__sim.setState({ boat: {...}, camera: 'sail' })` and `getState().reset()` (dev-only now: the Reset button and R key were removed). To force big heel, set wind speed to 9–12 m/s and heading 45°.
- **Gotchas:**
  - After a reload under emulation, the first screenshots can be mis-sized — re-apply `emulate` and wait.
  - MCP `click` on elements in the trim panel can time out because it re-renders constantly; click via `evaluate_script` instead.
  - `(hover: none)` can stay true after switching back from phone emulation, which hides the desktop kbd hints — that's a tooling artefact, not a bug.
