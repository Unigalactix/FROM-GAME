# AGENTS.md — Project Context for AI Agents

> **Purpose:** This file is the single source of truth for understanding the
> project quickly, so an agent does not need to re-read every file on each
> request. **Keep it updated whenever new structural info, conventions, or key
> decisions are added.** Update the "Last updated" line below when you change it.

**Last updated:** 2026-06-26

---

## 1. Overview

A browser-based, first-person **survival stealth-horror game** inspired by the TV
series *FROM*. The player survives in a small, trapped town: explore by day,
hide from monsters by night, manage fear/health/battery, complete quests, and
craft wards. The town map is modeled after the show's geography.

- **Live site:** https://unigalactix.github.io/FROM-GAME/
- **Repo:** `Unigalactix/FROM-GAME` (branch `main`)
- **Package name:** `nowhere-town` (v0.1.0)
- **Docs:** `README.md` (player-facing, with screenshots in `screenshots/`),
  this `AGENTS.md` (agent context), `ROADMAP.md` (plan).

## 2. Tech Stack

| Concern        | Choice |
| -------------- | ------ |
| Build tool     | **Vite 6** (`base: '/FROM-GAME/'`) |
| UI framework   | **React 18.3** (lazy-loads the 3D game via `Suspense`) |
| 3D engine      | **Three.js 0.171** + **@react-three/fiber 8.18** — pure Three.js, **NO drei** |
| State          | **Zustand 5** (`src/store.js`) |
| Styling        | **Tailwind CSS 3.4** + PostCSS/autoprefixer |
| Icons          | `lucide-react` (plus custom `src/components/Icon.jsx`) |
| Deploy         | GitHub Pages (gh-pages branch via Actions workflow / `gh-pages` package) |

Vite `manualChunks`: `three`, `r3f`, `react` are split out so the menu loads
fast and Three.js is fetched only when entering town.

## 3. Commands

```bash
npm run dev      # Vite dev server → http://localhost:5173/FROM-GAME/
npm run build    # Production build to dist/
npm run preview  # Preview the production build
npm run deploy   # vite build && gh-pages -d dist  (manual deploy)
```

CI auto-deploys on push to `main` (see `.github/workflows/deploy.yml`).

## 4. Architecture

- **One shared simulation:** `advance()` in `src/systems/sim.js` is the single
  authoritative step. It returns `{ player, enemies, health, fear, hidden, ... }`.
- **Single batched `setState` per frame** is dispatched from the Player
  `useFrame` loop. Per-frame visual updates (atmosphere, enemies, wards, avatar,
  portal trees, vehicles) are done **imperatively** via refs to avoid React
  re-renders.
- **Coordinate system:** world units are top-down `(x, y)`. Converted to 3D
  meters with `S = 0.06`: `wx(x) = x * S`, `wz(y) = y * S` (defined in
  `FirstPerson.jsx`). World size lives in `town.js` → `WORLD`.

### Key constants (in `src/scenes/FirstPerson.jsx`)
`S = 0.06`, `WALL_H = 3.2`, `EYE = 1.7`, `CROUCH_EYE = 0.85`,
`BATTERY_DRAIN = 1.6`, `JUMP_V = 4.2`, `GRAVITY = 12`.
Camera: `fov 75, near 0.05, far 140`. Sun shadow frustum: `±55`, far `200`.

## 5. File Map

```
src/
  App.jsx              # Root; lazy-loads Game.jsx in Suspense
  main.jsx             # React entry
  index.css            # Tailwind + custom animations (ui-fade-in, etc.)
  store.js             # Zustand store: state, actions, persistence, day/night
  scenes/
    Game.jsx           # Mounts the active scene
    MainMenu.jsx       # Title screen (incl. FPP/TPP toggle)
    FirstPerson.jsx    # The 3D Canvas: world geometry, props, player controller
    HUD.jsx            # Overlay: reticle, meters, toasts, minimap, camera toggle
    Minimap.jsx        # Top-down minimap (buildings, portals, tasks, enemies)
    TownMap.jsx        # Full map view
    Panels.jsx         # Dialog / inventory / crafting / lore panels
  systems/
    town.js            # WORLD size, BUILDINGS, DECOR_HOUSES, WALLS, collision
    world.js           # NPCS, LORE, MATERIAL_NODES, TASKS, PORTAL_TREES, RECIPES
    sim.js             # advance() — the core per-frame simulation
    enemies.js         # Enemy spawning/behaviour (ENEMY_R = 9)
    textures.js        # Procedural ground/wall/floor textures
    audio.js           # Sound/stingers
  components/
    Icon.jsx           # Custom inline SVG icons (heart, eye, ...)
    Settings.jsx       # Settings UI (keybinds, camera mode, colorblind, ...)
    Slider.jsx         # Reusable slider control
```

## 6. Town Layout (faithful to the FROM map)

- `WORLD = { w: 1200, h: 800 }`.
- **Enterable buildings** (`BUILDINGS` in `town.js`, each has a `door` side and
  quest logic keyed by name): `CLINIC` (NE), `HOUSE` / Matthews (center),
  `CHURCH` (SW of plaza), `DINER` / Matthew's (with the glowing board).
- **Decor landmarks** (`DECOR_HOUSES`, solid, not enterable): `COLONY HOUSE`
  (big NW Victorian), `SHED`, `GREEN HOUSE`, `BLUE HOUSE`, `BARN`, `BAR`,
  `ROOT CELLAR`, `GREY HOUSE`, `SHERIFF`, `MYERS`, `LIU`.
- **Props** (in `FirstPerson.jsx`): `DinerSign` (neon board), `Bus` (parked by
  the diner), `Ambulance` (by the clinic), `ChoosingStone` (monolith),
  `TrafficJam` (cars drive in east→west along the plaza street during daylight —
  `speed ∝ dayLight(time)` — and bunch up bumper-to-bumper).
- **Portal / "Faraway" trees** (`PORTAL_TREES` in `world.js`): teleport triggers
  (NOT obstacles — not in `WALLS`). `PORTAL_RADIUS = 18`. Walking within range
  teleports the player to a random far point (`randomTeleportTarget`), adds fear,
  triggers a stinger, and starts a cooldown (`portalCD`).
- **Player start:** `PLAYER_START` in `store.js` (south entrance facing town).

## 7. Conventions & Gotchas

- **Walls painting:** main building walls use `color = paint` + `bumpMap` only
  (texture map darkened them too much). Decor uses plain color + shared bump.
- **Roofs:** 4-sided `coneGeometry` (hip/pyramid roof) rotated `π/4`,
  `scaleX/Z = wx(w)/2 * 1.485` to reach the wall plane with eaves.
- **Tone mapping:** `THREE.ACESFilmicToneMapping` — keep it.
- **JSX unicode in template strings:** use `\u00b7`, `\u2014`, `\u2605` etc.
- **`create_file` fails if a file exists** — edit in place instead.
- **Vehicle `Car`** body length runs along Z, front (headlights) at −Z. For the
  east-west jam, each car group is rotated `+π/2` about Y so it faces −X.
- Two cameras: **FPP** (default) and **TPP**, toggled via `cameraMode` /
  `toggleCameraMode` in the store (key `V`, button in `HUD.jsx`).

## 8. Persistence (localStorage keys)

- `nowhere-town-save-v1` — saved game state
- `nowhere-town-settings-v1` — settings
- `nowhere-town-keys-v1` — keybindings

## 9. Deployment

- **CI:** `.github/workflows/deploy.yml` builds and deploys to GitHub Pages on
  every push to `main`. (Repo Settings → Pages → Source must be **GitHub Actions**.)
- **Manual fallback:** `npm run deploy` (publishes `dist/` to the `gh-pages`
  branch via the `gh-pages` package).
- The Vite `base` (`/FROM-GAME/`) MUST match the repo name or assets 404.

## 10. Git / Identity

- Commits to this project are authored as **Unigalactix**:
  ```bash
  git commit --author="Unigalactix <Unigalactix@users.noreply.github.com>" -m "..."
  ```
  (The local committer identity stays as configured.)
- **Only commit/push/deploy when the user explicitly asks.** Otherwise verify
  locally with `npm run build`.

---

### Maintenance checklist (for agents)
When you make a structural change, update the relevant section above:
- New file/module → §5 File Map
- New building/prop/landmark → §6 Town Layout
- New constant or architectural rule → §4 / §7
- New persistence key → §8
- New script or dependency → §2 / §3
- Then bump the **Last updated** date.
