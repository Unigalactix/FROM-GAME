# NOWHERE TOWN — Full Game Development Roadmap

> A first-person survival stealth-horror game inspired by *FROM*.
> Current state: single-file React UI mockup (`index.html`). This roadmap takes it to a full game.

---

## Guiding Pillars
- **Dread over action** — fear comes from anticipation, sound, and the night, not combat.
- **You cannot leave** — every loop forces the player back into town.
- **Light is safety, dark is death** — the day/night cycle is the core tension engine.
- **The Talisman is hope** — a fragile, depletable form of protection.

---

## Phase 0 — Foundation & Project Setup ✅ DONE
**Goal:** Move from a single CDN file to a real, maintainable project.

- [x] Convert to a Vite + React project (`npm create vite@latest`).
- [x] Split current mockup into components: `MainMenu`, `HUD`, `Settings`, shared `Icon`.
- [x] Add a state store (Zustand or React Context) for global game state.
- [x] Set up folder structure: `/src/scenes`, `/src/systems`, `/src/components`, `/src/assets`.
- [x] Keep the GitHub Pages deploy working (Vite `base` config + `gh-pages`).

**Deliverable:** Same UI as today, but modular and build-based.

---

## Phase 1 — Core Game Loop (2D Top-Down Prototype) ✅ DONE
**Goal:** Make it *playable* before making it pretty. Prove the loop in 2D.

- [x] Render a top-down map of the town (grid or simple tilemap).
- [x] Player movement (`WASD` / arrow keys) with collision against buildings.
- [x] Day/Night clock drives a global `phase` state: `DAY → DUSK → NIGHT → DAWN`.
- [x] At NIGHT, the player must be inside a building or they take damage.
- [x] Win condition: survive until DAWN. Lose condition: caught outside / health = 0.

**Deliverable:** A loop you can win or lose. Ugly but real.

---

## Phase 2 — Stealth & Threat Systems ✅ DONE
**Goal:** Introduce the enemies and the fear mechanics.

- [x] **Enemies ("Smiling Folk")** that spawn at night and wander/patrol.
- [x] Line-of-sight + hearing detection (noise from running/movement).
- [x] **Hold Breath** mechanic (reuse stamina bar): reduces detection but drains stamina.
- [x] **Hide spots** — under beds, in closets (`C` to hide), with a tension meter.
- [x] **Talisman system** — hang on a door to block an enemy; finite charges.
- [x] Sanity/Fear meter that rises near enemies and in the dark.

**Deliverable:** Actual stealth gameplay with real stakes.

---

## Phase 3 — First-Person Conversion ✅ DONE
**Goal:** Deliver the intended first-person horror perspective.

- [x] Introduce a 3D engine layer: **Three.js** (via `react-three-fiber`).
- [x] First-person controller (pointer-lock, `WASD`, mouse look, head-bob).
- [x] Build interior + exterior environments (modular rooms, the house, the street).
- [x] Port enemy AI and detection from Phase 2 into 3D space.
- [x] Dynamic lighting: flickering lamps, flashlight/lantern with battery.
- [x] Carry the HUD overlay (clock, stamina, prompts, inventory) on top of the 3D view.

**Deliverable:** Walk through town in first person, hide from enemies in 3D.

---

## Phase 4 — World, Story & Progression ✅ DONE
**Goal:** Give the town meaning and reasons to keep playing.

- [x] Multiple buildings to explore (diner, church, clinic, the forest edge).
- [x] NPC survivors with dialogue and small quests.
- [x] Collectibles/lore (notes, photos, radio messages) that explain the town.
- [x] Crafting/resource loop: find materials → make talismans, bandages, light.
- [x] Branching objectives across multiple in-game days.
- [x] Persistent progression (day counter, unlocked areas, story flags).

**Deliverable:** A reason to survive — not just survival.

---

## Phase 5 — Audio, Atmosphere & Polish ✅ DONE
**Goal:** Make it genuinely terrifying.

- [x] Procedural audio engine (Web Audio): wind bed, footsteps, heartbeat, dread drone, chase stinger — no asset files.
- [x] Adaptive tension: heartbeat tempo + drone swell with fear and enemy proximity.
- [x] Post-processing: animated film grain overlay, fear vignette, dynamic fog (extends the CRT vibe into 3D).
- [x] Tension pacing: chase stinger fires on the transition into a hunt (no spam).
- [x] Accessibility: subtitles/captions, brightness, mouse sensitivity, reduce-motion — all persisted.
- [x] Bonus: continuous daylight cycle (bright day fading smoothly to dark), daytime chores (vegetables/carpentry/water) + food, minimap facing arrow.

**Deliverable:** The *vibe* fully realized in motion and sound.

---

## Phase 6 — Save System, Settings & Release
**Goal:** Ship it.

- [ ] Save/load (LocalStorage for web build, or file-based for desktop).
- [ ] Full settings: audio, controls remapping, graphics quality.
- [ ] Performance pass (asset loading, LODs, draw-call reduction).
- [ ] Build targets: itch.io / GitHub Pages (web), optional **Electron/Tauri** desktop build.
- [ ] Playtesting, balancing, bug-fix pass.
- [ ] Trailer + store page.

**Deliverable:** A complete, releasable game.

---

## Recommended Tech Stack Evolution
| Layer | Now | Target |
|-------|-----|--------|
| Build | CDN single file | Vite |
| UI | React (Babel CDN) | React (compiled) |
| State | `useState` | Zustand / Context |
| Render | DOM | Three.js / react-three-fiber |
| Audio | none | Howler.js / Web Audio API |
| Persistence | none | LocalStorage → Tauri FS |
| Deploy | GitHub Pages | GitHub Pages + itch.io / desktop |

---

## Suggested Order of Attack
1. **Phase 0 + 1 first** — get a winnable/losable loop in 2D. This de-risks everything.
2. **Phase 2** — stealth is the heart of the game; prototype it cheaply in 2D.
3. **Phase 3** — only go 3D once the *mechanics* are proven fun.
4. **Phases 4–6** — content, polish, and release.

> Tip: Don't build 3D first. Most horror games die because they build pretty environments before proving the loop is scary and fun.
