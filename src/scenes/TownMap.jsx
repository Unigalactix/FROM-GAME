import { useEffect, useRef } from 'react';
import { useGameStore, getPhaseInfo, CYCLE_LENGTH } from '../store.js';
import {
  WORLD,
  BUILDINGS,
  WALLS,
  DOORS,
  HIDE_SPOTS,
  resolveCollision,
  buildingAt,
  nearestDoor,
  nearestHideSpot,
} from '../systems/town.js';
import { spawnEnemies, updateEnemies, ENEMY_R } from '../systems/enemies.js';

const SPEED = 152; // normal move speed (px/s)
const SNEAK_SPEED = 82; // while holding Shift
const RADIUS = 9;
const NIGHT_DAMAGE = 15; // hp/s exposed outside at night
const CONTACT_DAMAGE = 46; // hp/s while an enemy touches you
const PANIC_DAMAGE = 6; // hp/s while fear is maxed
const WARD_R = 72;
const ENEMY_COUNT = 3;

export default function TownMap() {
  const canvasRef = useRef(null);
  const keys = useRef(new Set());
  const prevC = useRef(false);
  const prevE = useRef(false);

  // Track held keys.
  useEffect(() => {
    const block = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];
    const down = (e) => {
      const k = e.key.toLowerCase();
      keys.current.add(k);
      if (block.includes(k)) e.preventDefault();
    };
    const up = (e) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Main loop.
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    let raf;
    let last = performance.now();

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const st = useGameStore.getState();
      if (st.status === 'playing') {
        step(st, dt, keys.current, prevC, prevE);
      }
      draw(ctx, useGameStore.getState());
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={WORLD.w}
      height={WORLD.h}
      className="block"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        aspectRatio: `${WORLD.w} / ${WORLD.h}`,
      }}
    />
  );
}

// One simulation step. Computes everything from a snapshot, then a single setState.
function step(st, dt, keys, prevC, prevE) {
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

  // ---- Edge-triggered actions (C hide, E talisman) ----
  let hidden = st.hidden;
  let talismans = st.talismans;
  let wards = st.wards;
  let player = st.player;

  const cDown = keys.has('c');
  const eDown = keys.has('e');

  const hideSpot = nearestHideSpot(player.x, player.y);
  if (cDown && !prevC.current) {
    if (hidden) {
      hidden = false;
    } else if (hideSpot) {
      hidden = true;
      player = { x: hideSpot.x, y: hideSpot.y };
    }
  }
  prevC.current = cDown;

  const doorNear = nearestDoor(player.x, player.y);
  if (eDown && !prevE.current) {
    if (doorNear && talismans > 0 && !wards.some((w) => w.name === doorNear.name)) {
      wards = [...wards, { name: doorNear.name, x: doorNear.x, y: doorNear.y, r: WARD_R }];
      talismans -= 1;
    }
  }
  prevE.current = eDown;

  // ---- Movement (disabled while hidden) ----
  let inside = st.inside;
  let moving = false;
  let sneaking = false;
  if (!hidden) {
    let dx = 0;
    let dy = 0;
    if (keys.has('w') || keys.has('arrowup')) dy -= 1;
    if (keys.has('s') || keys.has('arrowdown')) dy += 1;
    if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
    if (keys.has('d') || keys.has('arrowright')) dx += 1;
    sneaking = keys.has('shift');
    if (dx || dy) {
      moving = true;
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      const spd = sneaking ? SNEAK_SPEED : SPEED;
      const pos = resolveCollision(player.x + dx * spd * dt, player.y + dy * spd * dt, RADIUS);
      player = pos;
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
  tension = Math.max(0, Math.min(100, tension));
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
  fear = Math.max(0, Math.min(100, fear + f * dt));
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

  useGameStore.setState({
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
  });
}

function draw(ctx, st) {
  const { w, h } = WORLD;
  const { phase } = getPhaseInfo(st.time);

  // Ground
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, w, h);

  // Faint street grid
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx <= w; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = 0; gy <= h; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }

  // Buildings
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '12px "IBM Plex Mono", monospace';
  for (const b of BUILDINGS) {
    ctx.fillStyle = '#141318';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(176,106,44,0.4)';
    ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2);
  }

  // Hide spots (faint markers)
  for (const hs of HIDE_SPOTS) {
    ctx.strokeStyle = 'rgba(120,120,130,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hs.x - 7, hs.y - 7, 14, 14);
  }

  // Walls
  ctx.fillStyle = '#3b3833';
  for (const wl of WALLS) ctx.fillRect(wl.x, wl.y, wl.w, wl.h);

  // Wards (hung talismans)
  for (const ward of st.wards) {
    const g = ctx.createRadialGradient(ward.x, ward.y, 4, ward.x, ward.y, ward.r);
    g.addColorStop(0, 'rgba(176,106,44,0.22)');
    g.addColorStop(1, 'rgba(176,106,44,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ward.x, ward.y, ward.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b06a2c';
    ctx.font = '16px "IBM Plex Mono", monospace';
    ctx.fillText('\u2020', ward.x, ward.y); // dagger/cross glyph
  }

  // Enemies (drawn before darkness so night hides them outside vision)
  for (const e of st.enemies) {
    const chasing = e.state === 'chase';
    ctx.beginPath();
    ctx.arc(e.x, e.y, ENEMY_R + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#0c0c0e';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = chasing ? 'rgba(126,20,20,0.8)' : 'rgba(60,58,52,0.8)';
    ctx.stroke();
    // eyes
    ctx.fillStyle = chasing ? '#7e1414' : '#b06a2c';
    ctx.beginPath();
    ctx.arc(e.x - 3, e.y - 2, 1.6, 0, Math.PI * 2);
    ctx.arc(e.x + 3, e.y - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // smile
    ctx.strokeStyle = 'rgba(216,211,205,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(e.x, e.y + 1, 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  // Player
  const p = st.player;
  if (st.hidden) {
    // tucked away — faint dashed outline
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(176,106,44,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, RADIUS + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.beginPath();
    ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = st.inside ? '#cfcbc2' : '#e8e4dd';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(176,106,44,0.7)';
    ctx.stroke();
  }

  // Darkness + limited vision
  const dark = phase === 'NIGHT' ? 0.93 : phase === 'DUSK' ? 0.55 : phase === 'DAWN' ? 0.35 : 0;
  if (dark > 0) {
    const visionR = st.hidden ? 90 : st.inside ? 160 : 125;
    const g = ctx.createRadialGradient(p.x, p.y, 26, p.x, p.y, visionR);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(2,1,3,${dark})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = `rgba(20,4,4,${dark * 0.3})`;
    ctx.fillRect(0, 0, w, h);
  }
}
