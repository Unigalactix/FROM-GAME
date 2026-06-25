import { useEffect, useState } from 'react';
import { useGameStore } from '../store.js';
import Icon from '../components/Icon.jsx';

export default function HUD() {
  const secondsLeft = useGameStore((s) => s.secondsLeft);
  const stamina = useGameStore((s) => s.stamina);
  const holding = useGameStore((s) => s.holding);
  const hasTalisman = useGameStore((s) => s.hasTalisman);

  const tickClock = useGameStore((s) => s.tickClock);
  const fastForward = useGameStore((s) => s.fastForward);
  const resetDay = useGameStore((s) => s.resetDay);
  const setHolding = useGameStore((s) => s.setHolding);
  const drainStamina = useGameStore((s) => s.drainStamina);
  const hangTalisman = useGameStore((s) => s.hangTalisman);
  const exitToMenu = useGameStore((s) => s.exitToMenu);

  const [promptActive, setPromptActive] = useState(false);

  const isSunset = secondsLeft <= 0;
  const nearSunset = secondsLeft > 0 && secondsLeft <= 10;

  // Day timer tick
  useEffect(() => {
    if (isSunset) return;
    const t = setInterval(tickClock, 1000);
    return () => clearInterval(t);
  }, [isSunset, tickClock]);

  // Stamina drain / regen for "Hold Breath"
  useEffect(() => {
    const t = setInterval(drainStamina, 100);
    return () => clearInterval(t);
  }, [drainStamina]);

  // Keyboard: Space = hold breath, E = interact
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setHolding(true);
      }
      if (e.code === 'KeyE') hangTalisman();
    };
    const up = (e) => {
      if (e.code === 'Space') setHolding(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [setHolding, hangTalisman]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const clockColor = isSunset
    ? 'text-blood sunset-pulse'
    : nearSunset
    ? 'text-amber-rust'
    : 'text-stone-300';

  return (
    <div className="relative h-full w-full bg-black flicker select-none overflow-hidden">
      {/* Ambient scene tint that darkens toward sunset */}
      <div
        className="absolute inset-0 transition-colors duration-1000"
        style={{
          background: isSunset
            ? 'radial-gradient(ellipse at center, rgba(40,6,6,0.5), rgba(0,0,0,0.95))'
            : nearSunset
            ? 'radial-gradient(ellipse at center, rgba(48,28,8,0.35), rgba(0,0,0,0.9))'
            : 'radial-gradient(ellipse at center, rgba(20,20,22,0.25), rgba(0,0,0,0.85))',
        }}
      />

      {/* faint distant figure silhouette appears at sunset */}
      {isSunset && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/3 opacity-20">
          <div className="w-12 h-40 bg-black rounded-t-full" />
        </div>
      )}

      {/* ---------- TOP CENTER: Day/Night clock ---------- */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
        <div className="flex items-center gap-2 mb-1">
          <Icon
            name={isSunset ? 'moon' : 'sun'}
            size={14}
            className={isSunset ? 'text-blood' : 'text-amber-rust'}
          />
          <span className="font-mono text-[10px] tracking-[0.4em] text-stone-500 uppercase">
            {isSunset ? 'Sunset' : 'Time Until Dark'}
          </span>
        </div>
        <div className={`font-mono text-4xl tracking-[0.25em] ${clockColor}`}>
          {isSunset ? 'DARK' : `${mm}:${ss}`}
        </div>
        {isSunset && (
          <p className="font-mono text-[10px] tracking-[0.3em] text-blood/80 mt-1 sunset-pulse">
            THEY ARE COMING OUT
          </p>
        )}
      </div>

      {/* ---------- CENTER: Interaction prompt ---------- */}
      <div className="absolute left-1/2 top-[58%] -translate-x-1/2 z-20">
        <button
          onMouseEnter={() => setPromptActive(true)}
          onMouseLeave={() => setPromptActive(false)}
          className={`font-mono text-base tracking-[0.25em] transition-all duration-300 ${
            promptActive
              ? 'text-stone-100 opacity-100 prompt-active'
              : 'text-stone-400 opacity-40'
          }`}
        >
          <span className="text-amber-rust">[ E ]</span>{' '}
          {hasTalisman ? 'Hang Talisman' : 'Hide Under Bed [ C ]'}
        </button>
      </div>

      {/* ---------- BOTTOM CENTER: Stamina (Hold Breath) ---------- */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-64 z-20">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[9px] tracking-[0.3em] text-stone-500 uppercase">
            {holding ? 'Holding Breath' : 'Breath'}
          </span>
          <Icon name="wind" size={12} className="text-stone-600" />
        </div>
        <div className="h-[3px] w-full bg-stone-900 overflow-hidden">
          <div
            className="h-full transition-[width] duration-100 ease-linear"
            style={{
              width: `${stamina}%`,
              background:
                stamina < 25 ? '#7e1414' : stamina < 60 ? '#b06a2c' : '#d6d3cd',
            }}
          />
        </div>
        <p className="font-mono text-[8px] tracking-widest text-stone-700 mt-1 text-center">
          HOLD [ SPACE ] TO STAY SILENT
        </p>
      </div>

      {/* ---------- BOTTOM RIGHT: Inventory slot ---------- */}
      <div className="absolute bottom-10 right-10 z-20">
        <div className="w-16 h-16 border border-stone-700/70 flex items-center justify-center relative bg-black/40">
          {hasTalisman ? (
            <div className="sway flex flex-col items-center">
              <div className="w-[1px] h-3 bg-stone-600" />
              <Icon name="cross" size={22} className="text-amber-rust/70" />
            </div>
          ) : (
            <span className="font-mono text-[8px] text-stone-700 tracking-widest text-center px-1">
              EMPTY
            </span>
          )}
          <span className="absolute -top-2 -left-2 w-4 h-4 border-t border-l border-stone-600" />
          <span className="absolute -bottom-2 -right-2 w-4 h-4 border-b border-r border-stone-600" />
        </div>
        <p className="font-mono text-[8px] tracking-widest text-stone-600 mt-1 text-center">
          TALISMAN
        </p>
      </div>

      {/* ---------- DEV / MOCK CONTROLS ---------- */}
      <div className="absolute top-6 left-6 z-30 flex flex-col gap-2">
        <button
          onClick={() => fastForward(15)}
          className="glitch-target font-mono text-[10px] tracking-widest text-stone-500 border border-stone-800 px-3 py-1 hover:border-blood"
        >
          ⏩ FAST-FORWARD TIME
        </button>
        <button
          onClick={resetDay}
          className="glitch-target font-mono text-[10px] tracking-widest text-stone-500 border border-stone-800 px-3 py-1 hover:border-amber-rust"
        >
          ↺ RESET DAY
        </button>
        <button
          onClick={exitToMenu}
          className="glitch-target font-mono text-[10px] tracking-widest text-stone-500 border border-stone-800 px-3 py-1 hover:border-stone-400"
        >
          ⏏ MAIN MENU
        </button>
      </div>
    </div>
  );
}
