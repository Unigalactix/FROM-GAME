import { useEffect, useRef } from 'react';
import { useGameStore, getPhaseInfo, CYCLE_LENGTH } from '../store.js';
import { WORLD, BUILDINGS, WALLS, resolveCollision, buildingAt } from '../systems/town.js';

const SPEED = 170; // px per second
const RADIUS = 9; // player collision radius
const DAMAGE_RATE = 16; // hp lost per second when outside at night

export default function TownMap() {
  const canvasRef = useRef(null);
  const keys = useRef(new Set());

  // Track held keys (movement is read every frame from this set).
  useEffect(() => {
    const move = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    const down = (e) => {
      const k = e.key.toLowerCase();
      keys.current.add(k);
      if (move.includes(k)) e.preventDefault();
    };
    const up = (e) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Main game loop: simulate + render via requestAnimationFrame.
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    let raf;
    let last = performance.now();

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const st = useGameStore.getState();
      if (st.status === 'playing') {
        // Advance the clock.
        let time = st.time + dt;
        let status = 'playing';
        if (time >= CYCLE_LENGTH) {
          time = CYCLE_LENGTH;
          status = 'won';
        }

        // Read movement input.
        let dx = 0;
        let dy = 0;
        const k = keys.current;
        if (k.has('w') || k.has('arrowup')) dy -= 1;
        if (k.has('s') || k.has('arrowdown')) dy += 1;
        if (k.has('a') || k.has('arrowleft')) dx -= 1;
        if (k.has('d') || k.has('arrowright')) dx += 1;
        if (dx || dy) {
          const len = Math.hypot(dx, dy);
          dx /= len;
          dy /= len;
        }

        const nx = st.player.x + dx * SPEED * dt;
        const ny = st.player.y + dy * SPEED * dt;
        const pos = resolveCollision(nx, ny, RADIUS);
        const inside = !!buildingAt(pos.x, pos.y);

        // Night damage when caught outside.
        const { phase } = getPhaseInfo(time);
        let health = st.health;
        if (phase === 'NIGHT' && !inside) {
          health = Math.max(0, health - DAMAGE_RATE * dt);
          if (health <= 0) status = 'lost';
        }

        // Single batched state update per frame.
        useGameStore.setState({ time, status, player: pos, inside, health });
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

  // Building interiors + labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '12px "IBM Plex Mono", monospace';
  for (const b of BUILDINGS) {
    ctx.fillStyle = '#141318';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(176,106,44,0.45)';
    ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2);
  }

  // Walls
  ctx.fillStyle = '#3b3833';
  for (const wl of WALLS) ctx.fillRect(wl.x, wl.y, wl.w, wl.h);

  // Player
  const p = st.player;
  ctx.beginPath();
  ctx.arc(p.x, p.y, RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = st.inside ? '#cfcbc2' : '#e8e4dd';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(176,106,44,0.7)';
  ctx.stroke();

  // Darkness + limited night vision
  const dark = phase === 'NIGHT' ? 0.93 : phase === 'DUSK' ? 0.55 : phase === 'DAWN' ? 0.35 : 0;
  if (dark > 0) {
    const visionR = st.inside ? 160 : 125;
    const g = ctx.createRadialGradient(p.x, p.y, 26, p.x, p.y, visionR);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(2,1,3,${dark})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // dried-blood tint over the dark
    ctx.fillStyle = `rgba(20,4,4,${dark * 0.3})`;
    ctx.fillRect(0, 0, w, h);
  }
}
