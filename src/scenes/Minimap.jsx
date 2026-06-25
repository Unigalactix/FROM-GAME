// Read-only top-down minimap for the first-person view. Draws the town,
// the player, wards, and any visible enemies straight from store state.
// It never steps the simulation — the 3D Player controller owns that.

import { useEffect, useRef } from 'react';
import { useGameStore, getPhaseInfo } from '../store.js';
import { WORLD, BUILDINGS, WALLS } from '../systems/town.js';
import { TASKS } from '../systems/world.js';

const SIZE = 150; // px

export default function Minimap() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const sx = SIZE / WORLD.w;
    const sy = SIZE / WORLD.h;
    let raf;

    const draw = () => {
      const st = useGameStore.getState();
      const { phase } = getPhaseInfo(st.time);

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Buildings
      for (const b of BUILDINGS) {
        ctx.fillStyle = '#16151a';
        ctx.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
      }
      // Walls
      ctx.fillStyle = '#3b3833';
      for (const w of WALLS) ctx.fillRect(w.x * sx, w.y * sy, Math.max(1, w.w * sx), Math.max(1, w.h * sy));

      // Wards
      for (const w of st.wards) {
        ctx.fillStyle = 'rgba(176,106,44,0.5)';
        ctx.beginPath();
        ctx.arc(w.x * sx, w.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Daytime chores — only worth showing while the sun is up.
      if (phase !== 'NIGHT') {
        for (const t of TASKS) {
          if (st.tasksDone.includes(t.id)) continue;
          ctx.fillStyle = '#6ab06a';
          ctx.fillRect(t.x * sx - 2, t.y * sy - 2, 4, 4);
        }
      }

      // Enemies (only when it's night — you shouldn't see them in daylight scouting)
      if (phase === 'NIGHT' || phase === 'DUSK') {
        for (const e of st.enemies) {
          ctx.fillStyle = e.state === 'chase' ? '#7e1414' : '#5a564e';
          ctx.beginPath();
          ctx.arc(e.x * sx, e.y * sy, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Player + facing arrow
      const p = st.player;
      const px = p.x * sx;
      const py = p.y * sy;
      // Forward heading from the FP camera yaw (world x -> screen x, world y -> screen y).
      const yaw = st.playerYaw || 0;
      const fx = -Math.sin(yaw);
      const fy = -Math.cos(yaw);
      const ang = Math.atan2(fy, fx);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      ctx.fillStyle = st.hidden ? '#b06a2c' : '#e8e4dd';
      ctx.beginPath();
      ctx.moveTo(7, 0); // tip points along facing
      ctx.lineTo(-4, 4);
      ctx.lineTo(-4, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative border border-stone-700/60 bg-black/50">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} className="block" />
      <span className="absolute top-1 left-1 font-mono text-[7px] tracking-widest text-stone-600">
        TOWN
      </span>
    </div>
  );
}
