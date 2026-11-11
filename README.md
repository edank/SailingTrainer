# Sailing Trainer — ILCA POC

Interactive 3D trainer for sailing basics: points of sail, what each rope does to the sail, and (next) the Racing Rules of Sailing. Starts with a single-handed ILCA; multi-sail boats later.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

## Controls

| Input | Action |
|---|---|
| ← / → or A / D, on-screen ◀ ▶ | Steer (springs back to centre) |
| ↓ / ↑ or S / W, slider | Mainsheet in / out |
| Q / E, slider | Vang off / on |
| Z / X, slider | Cunningham off / on |
| F / G, slider | Outhaul off / on |
| C | Cycle camera: chase → sail view (abeam, leeward) → top-down |
| + / −, mouse wheel, pinch | Zoom in / out |

## Layout

```
src/
  sim/        pure physics model — no React, no three.js
    boat.ts     derive() → apparent wind, boom angle, AoA, trim efficiency, hints, telltales
                step()   → speed, heading, heel, position
    polar.ts    simplified ILCA speed polar
  scene/      react-three-fiber rendering
    hullGeometry.ts  lofted low-poly hull
    Sail.tsx         parametric sail deformed by the sim (twist, camber, draft, luffing)
    Telltales.tsx    windward/leeward ribbons that show flow state
    Water.tsx, Sky.tsx, CameraRig.tsx
  ui/         HUD, compass rose, trim sliders, side panel (lessons)
  lessons/    content as typed data: points of sail, controls glossary, RRS 10–14
  store.ts    zustand store — single source of truth for sim + UI state
```

## Model (intentionally simple)

- Boom swings to leeward until the mainsheet stops it. If the sheet lets it past the apparent wind the sail weathercocks → **luffing**, no drive.
- Angle of attack = AWA − boom angle. Efficiency peaks ~18°, stalls past ~35°.
- Speed relaxes toward `polar(TWA, TWS) × trimEfficiency`. No-go zone < 30°.
- Vang → leech twist, outhaul/cunningham → camber depth and draft position. Each has an "ideal" for the conditions that drives the ▲/▼ hints and a small speed penalty.
- Heel from sail force × side component; leeway added upwind.

## Roadmap (not built)

1. Two-boat rules scenarios with a virtual umpire (RRS 10–14 first; full rulebook demos later, possibly paywalled).
2. Multi-sail boats (jib/spinnaker, traveller, backstay, rig tension, mast rake).
3. Mobile packaging with Capacitor (iOS + Android from this same codebase).
4. Better boat/sail art, wake, splashes, sound.
