// "Smiling Folk" — the things that come out at night.
// They drift in from the treeline and wander the town, drawn to the survivors'
// doors, where they stop and knock, grinning, trying to be let in. See or hear
// the player and the grin widens as they give chase. Talisman wards repel them,
// so a warded door is one they'll turn away from.

import { WORLD, resolveCollision, lineClear, DOORS } from './town.js';

export const ENEMY_R = 9;
const VISION = 195; // sight range (needs clear line of sight)
const CATCH = 17; // contact distance
const WANDER_SPD = 52; // slow, unhurried drift
const CHASE_SPD = 114;
const LOST_TIME = 2.6; // seconds an enemy keeps hunting after losing the player
const ARRIVE = 16; // distance at which a wander target counts as reached
const KNOCK_MIN = 2.6; // seconds spent knocking at a door
const KNOCK_VAR = 2.8;

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

// Pick the next place a Smiling Folk drifts toward — usually someone's door.
function chooseTarget(en) {
  if (DOORS.length && Math.random() < 0.7) {
    const d = DOORS[(Math.random() * DOORS.length) | 0];
    en.tx = d.x;
    en.ty = d.y;
    en.goalDoor = d.name;
  } else {
    const t = randomTarget();
    en.tx = t.x;
    en.ty = t.y;
    en.goalDoor = null;
  }
}

export function spawnEnemies(count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const p = randomEdgePoint();
    const en = {
      id: nextId++,
      x: p.x,
      y: p.y,
      tx: p.x,
      ty: p.y,
      state: 'wander', // 'wander' | 'chase' | 'knock'
      goalDoor: null,
      lost: 0,
      eye: 0,
      knockT: 0, // seconds left of the current knocking bout
      knockBeat: 0, // accumulates while knocking (drives taps + sound)
      smile: 0, // 0..1 grin, widens when hunting or knocking
    };
    chooseTarget(en);
    list.push(en);
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
    if (!hidden && dist < CATCH) contact = true;

    // ---- Detection ----
    const canSee = !hidden && dist < VISION && lineClear(en.x, en.y, player.x, player.y);
    const canHear = !hidden && noiseR > 0 && dist < noiseR;
    const detected = canSee || canHear;

    if (detected) {
      en.state = 'chase';
      en.tx = player.x;
      en.ty = player.y;
      en.lost = LOST_TIME;
      en.knockT = 0;
    } else if (en.state === 'chase') {
      en.lost -= dt;
      if (en.lost <= 0) {
        en.state = 'wander';
        chooseTarget(en);
      }
    }

    // ---- The grin: widens while hunting or knocking, fades when idle ----
    const grinning = en.state === 'chase' || en.state === 'knock';
    en.smile = grinning ? Math.min(1, en.smile + dt * 2.5) : Math.max(0, en.smile - dt * 1.2);
    en.eye = (en.eye + dt) % 1;

    // ---- Knocking: stand at the door and rap on it ----
    if (en.state === 'knock') {
      en.knockT -= dt;
      en.knockBeat += dt;
      if (en.knockT <= 0) {
        en.state = 'wander';
        chooseTarget(en);
      }
      return en; // rooted in place while knocking
    }

    // ---- Steering (wander / chase) ----
    let dirx = en.tx - en.x;
    let diry = en.ty - en.y;
    const len = Math.hypot(dirx, diry) || 1;

    if (en.state === 'wander' && len < ARRIVE) {
      if (en.goalDoor) {
        // Reached a survivor's door — stop and start knocking.
        en.state = 'knock';
        en.knockT = KNOCK_MIN + Math.random() * KNOCK_VAR;
        en.knockBeat = 0;
        return en;
      }
      chooseTarget(en);
      dirx = en.tx - en.x;
      diry = en.ty - en.y;
    }

    const speed = en.state === 'chase' ? CHASE_SPD : WANDER_SPD;
    let vx = (dirx / len) * speed;
    let vy = (diry / len) * speed;

    // Talisman wards repel them — a warded door isn't worth approaching.
    for (const w of wards) {
      const wd = Math.hypot(en.x - w.x, en.y - w.y);
      const reach = w.r + 24;
      if (wd < reach) {
        const push = (reach - wd) / reach;
        vx += ((en.x - w.x) / (wd || 1)) * speed * push * 3;
        vy += ((en.y - w.y) / (wd || 1)) * speed * push * 3;
        if (en.goalDoor && en.state !== 'chase') chooseTarget(en);
      }
    }

    const pos = resolveCollision(en.x + vx * dt, en.y + vy * dt, ENEMY_R);
    en.x = pos.x;
    en.y = pos.y;

    return en;
  });

  return { enemies: next, contact };
}
