// Shared game simulation — the single source of truth for one tick of the world.
// Both the 2D top-down prototype and the 3D first-person view feed input into
// `advance()` and apply the returned partial state to the store. Keeping the
// rules here means the AI, detection, fear, clock, hide, and ward logic behave
// identically no matter how the world is rendered.

import { getPhaseInfo, CYCLE_LENGTH } from '../store.js';
import {
  resolveCollision,
  buildingAt,
  nearestDoor,
  nearestHideSpot,
} from './town.js';
import { spawnEnemies, updateEnemies } from './enemies.js';

export const SPEED = 152; // normal move speed (world units/s)
export const SNEAK_SPEED = 82; // while sneaking (Shift)
export const RADIUS = 9; // player collision radius
export const NIGHT_DAMAGE = 15; // hp/s exposed outside at night
export const CONTACT_DAMAGE = 46; // hp/s while an enemy touches you
export const PANIC_DAMAGE = 6; // hp/s while fear is maxed
export const WARD_R = 72; // talisman ward radius
export const ENEMY_COUNT = 3;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Advance the world one step.
// input: {
//   dirX, dirY   — desired move direction in WORLD space (un-normalized; 0 = still)
//   sneaking     — bool (Shift)
//   toggleHide   — bool, true only on the frame the hide key was pressed
//   placeWard    — bool, true only on the frame the talisman key was pressed
// }
// Returns a partial state object ready for useGameStore.setState(...).
export function advance(st, dt, input) {
  const prevPhase = getPhaseInfo(st.time).phase;

  // ---- Clock ----
  let time = st.time + dt;
  let status = 'playing';
  if (time >= CYCLE_LENGTH) {
    time = CYCLE_LENGTH;
    status = 'won';
  }
  const { phase } = getPhaseInfo(time);

  // ---- Spawn / despawn enemies on phase boundaries ----
  let enemies = st.enemies;
  if (phase === 'NIGHT' && prevPhase !== 'NIGHT') enemies = spawnEnemies(ENEMY_COUNT);
  if ((phase === 'DAY' || phase === 'DAWN') && enemies.length) enemies = [];

  // ---- Edge-triggered actions (hide, talisman) ----
  let hidden = st.hidden;
  let talismans = st.talismans;
  let wards = st.wards;
  let player = st.player;

  const hideSpot = nearestHideSpot(player.x, player.y);
  if (input.toggleHide) {
    if (hidden) hidden = false;
    else if (hideSpot) {
      hidden = true;
      player = { x: hideSpot.x, y: hideSpot.y };
    }
  }

  const doorNear = nearestDoor(player.x, player.y);
  if (input.placeWard && doorNear && talismans > 0 && !wards.some((w) => w.name === doorNear.name)) {
    wards = [...wards, { name: doorNear.name, x: doorNear.x, y: doorNear.y, r: WARD_R }];
    talismans -= 1;
  }

  // ---- Movement (disabled while hidden) ----
  let inside = st.inside;
  let moving = false;
  let sneaking = false;
  if (!hidden) {
    let dx = input.dirX || 0;
    let dy = input.dirY || 0;
    sneaking = !!input.sneaking;
    const len = Math.hypot(dx, dy);
    if (len > 0.0001) {
      moving = true;
      dx /= len;
      dy /= len;
      const spd = sneaking ? SNEAK_SPEED : SPEED;
      player = resolveCollision(player.x + dx * spd * dt, player.y + dy * spd * dt, RADIUS);
    }
    inside = !!buildingAt(player.x, player.y);
  }

  // ---- Player noise (drives enemy hearing) ----
  let noiseR = 0;
  if (!hidden && !st.holding) {
    if (moving) noiseR = sneaking ? 70 : 150;
    else noiseR = 30;
  }

  // ---- Tension while hidden ----
  let tension = st.tension;
  const nearestEnemyDist = enemies.reduce(
    (m, e) => Math.min(m, Math.hypot(player.x - e.x, player.y - e.y)),
    Infinity
  );
  if (hidden) {
    if (nearestEnemyDist < 160) tension += ((160 - nearestEnemyDist) / 160) * 30 * dt;
    else tension -= 25 * dt;
  } else {
    tension -= 60 * dt;
  }
  tension = clamp(tension, 0, 100);
  const tensionBroken = hidden && tension >= 100;

  // ---- Enemy AI ----
  let contact = false;
  if (enemies.length) {
    const res = updateEnemies(enemies, {
      player,
      dt,
      noiseR,
      hidden: hidden && !tensionBroken,
      wards,
    });
    enemies = res.enemies;
    contact = res.contact;
  }

  // ---- Health ----
  let health = st.health;
  if (phase === 'NIGHT' && !inside && !hidden) health -= NIGHT_DAMAGE * dt;
  if (contact) health -= CONTACT_DAMAGE * dt;

  // ---- Fear ----
  let fear = st.fear;
  let f = 0;
  if (phase === 'NIGHT' && !inside) f += 6;
  else if (phase === 'DUSK' && !inside) f += 2;
  if (nearestEnemyDist < 260) f += ((260 - nearestEnemyDist) / 260) * 18;
  if (hidden) f -= 4;
  if (inside && nearestEnemyDist > 260 && phase !== 'NIGHT') f -= 8;
  if (phase === 'DAY') f -= 10;
  fear = clamp(fear + f * dt, 0, 100);
  if (fear >= 100) health -= PANIC_DAMAGE * dt;

  if (health <= 0) {
    health = 0;
    status = 'lost';
  }

  // ---- Prompts ----
  const promptDoor =
    doorNear && talismans > 0 && !wards.some((w) => w.name === doorNear.name)
      ? doorNear.name
      : null;
  const promptHide = !!hideSpot;

  return {
    time,
    status,
    player,
    inside,
    enemies,
    health,
    fear,
    hidden,
    tension,
    talismans,
    wards,
    promptDoor,
    promptHide,
  };
}
