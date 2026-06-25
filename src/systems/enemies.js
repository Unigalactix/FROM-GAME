// "Smiling Folk" — the things that come out at night.
// Pure simulation helpers: spawn at the map edges, wander, then chase the
// player when they see or hear them. Talisman wards repel them.

import { WORLD, resolveCollision, lineClear } from './town.js';

export const ENEMY_R = 9;
const VISION = 195; // sight range (needs clear line of sight)
const CATCH = 17; // contact distance
const WANDER_SPD = 56;
const CHASE_SPD = 114;
const LOST_TIME = 2.6; // seconds an enemy keeps hunting after losing the player

let nextId = 1;

function randomEdgePoint() {
  const m = 24;
  const side = Math.floor(Math.random() * 4);
  switch (side) {
    case 0:
      return { x: Math.random() * WORLD.w, y: m };
    case 1:
      return { x: WORLD.w - m, y: Math.random() * WORLD.h };
    case 2:
      return { x: Math.random() * WORLD.w, y: WORLD.h - m };
    default:
      return { x: m, y: Math.random() * WORLD.h };
  }
}

function randomTarget() {
  return {
    x: 40 + Math.random() * (WORLD.w - 80),
    y: 40 + Math.random() * (WORLD.h - 80),
  };
}

export function spawnEnemies(count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const p = randomEdgePoint();
    const t = randomTarget();
    list.push({
      id: nextId++,
      x: p.x,
      y: p.y,
      tx: t.x,
      ty: t.y,
      state: 'wander', // 'wander' | 'chase'
      lost: 0,
      eye: 0,
    });
  }
  return list;
}

// Advance all enemies one step.
// opts: { player:{x,y}, dt, noiseR, hidden, wards }
// Returns { enemies, contact } where contact = an enemy is on an exposed player.
export function updateEnemies(enemies, opts) {
  const { player, dt, noiseR, hidden, wards } = opts;
  let contact = false;

  const next = enemies.map((e) => {
    const en = { ...e };
    const dist = Math.hypot(player.x - en.x, player.y - en.y);

    // ---- Detection ----
    const canSee = !hidden && dist < VISION && lineClear(en.x, en.y, player.x, player.y);
    const canHear = !hidden && noiseR > 0 && dist < noiseR;
    const detected = canSee || canHear;

    if (detected) {
      en.state = 'chase';
      en.tx = player.x;
      en.ty = player.y;
      en.lost = LOST_TIME;
    } else if (en.state === 'chase') {
      en.lost -= dt;
      if (en.lost <= 0) en.state = 'wander';
    }

    // ---- Steering ----
    let dirx = en.tx - en.x;
    let diry = en.ty - en.y;
    const len = Math.hypot(dirx, diry) || 1;

    if (en.state === 'wander' && len < 8) {
      const t = randomTarget();
      en.tx = t.x;
      en.ty = t.y;
      dirx = en.tx - en.x;
      diry = en.ty - en.y;
    }

    const speed = en.state === 'chase' ? CHASE_SPD : WANDER_SPD;
    let vx = (dirx / len) * speed;
    let vy = (diry / len) * speed;

    // Talisman wards repel them.
    for (const w of wards) {
      const wd = Math.hypot(en.x - w.x, en.y - w.y);
      const reach = w.r + 24;
      if (wd < reach) {
        const push = (reach - wd) / reach;
        vx += ((en.x - w.x) / (wd || 1)) * speed * push * 3;
        vy += ((en.y - w.y) / (wd || 1)) * speed * push * 3;
      }
    }

    const pos = resolveCollision(en.x + vx * dt, en.y + vy * dt, ENEMY_R);
    en.x = pos.x;
    en.y = pos.y;
    en.eye = (en.eye + dt) % 1;

    if (!hidden && dist < CATCH) contact = true;

    return en;
  });

  return { enemies: next, contact };
}
