import { useEffect, useState } from 'react';
import { useGameStore, getPhaseInfo } from '../store.js';
import Icon from '../components/Icon.jsx';

const PHASE_STYLES = {
  DAY: { label: 'DAYLIGHT', color: 'text-stone-300', icon: 'sun', iconColor: 'text-amber-rust' },
  DUSK: { label: 'DUSK', color: 'text-amber-rust', icon: 'sun', iconColor: 'text-amber-rust' },
  NIGHT: { label: 'NIGHT', color: 'text-blood sunset-pulse', icon: 'moon', iconColor: 'text-blood' },
  DAWN: { label: 'DAWN', color: 'text-amber-rust', icon: 'sun', iconColor: 'text-amber-rust' },
};

export default function HUD() {
  const time = useGameStore((s) => s.time);
  const health = useGameStore((s) => s.health);
  const inside = useGameStore((s) => s.inside);
  const stamina = useGameStore((s) => s.stamina);
  const holding = useGameStore((s) => s.holding);
  const hasTalisman = useGameStore((s) => s.hasTalisman);

  const fastForward = useGameStore((s) => s.fastForward);
  const startGame = useGameStore((s) => s.startGame);
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  const setHolding = useGameStore((s) => s.setHolding);
  const drainStamina = useGameStore((s) => s.drainStamina);
  const hangTalisman = useGameStore((s) => s.hangTalisman);

  const [promptActive, setPromptActive] = useState(false);

  const { phase, phaseTimeLeft } = getPhaseInfo(time);
  const ps = PHASE_STYLES[phase];
  const exposed = phase === 'NIGHT' && !inside;

  // Stamina drain / regen for "Hold Breath".
  useEffect(() => {
    const t = setInterval(drainStamina, 100);
    return () => clearInterval(t);
  }, [drainStamina]);

  // Space = hold breath, E = hang talisman.
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

  const ss = String(Math.ceil(phaseTimeLeft)).padStart(2, '0');

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* ---------- TOP CENTER: phase clock + health ---------- */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-1">
          <Icon name={ps.icon} size={14} className={ps.iconColor} />
          <span className="font-mono text-[10px] tracking-[0.4em] text-stone-500 uppercase">
            {phase === 'DAWN' && phaseTimeLeft <= 0 ? 'Sunrise' : 'Until Next'}
          </span>
        </div>
        <div className={`font-mono text-4xl tracking-[0.25em] ${ps.color}`}>{ps.label}</div>
        <div className="font-mono text-xs tracking-[0.3em] text-stone-500 mt-1">0:{ss}</div>

        {/* Health bar */}
        <div className="mt-3 w-52">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9px] tracking-[0.3em] text-stone-500 uppercase">
              Condition
            </span>
            <span className="font-mono text-[9px] text-stone-500">{Math.ceil(health)}</span>
          </div>
          <div className="h-[4px] w-full bg-stone-900 overflow-hidden">
            <div
              className="h-full transition-[width] duration-150 ease-linear"
              style={{
                width: `${health}%`,
                background: health < 30 ? '#7e1414' : health < 60 ? '#b06a2c' : '#9b9890',
              }}
            />
          </div>
        </div>
      </div>

      {/* ---------- EXPOSED-AT-NIGHT WARNING ---------- */}
      {exposed && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center">
          <p className="font-mono text-lg tracking-[0.4em] text-blood sunset-pulse">GET INSIDE</p>
          <p className="font-mono text-[10px] tracking-[0.3em] text-blood/70 mt-1">
            THEY ARE OUT HERE WITH YOU
          </p>
        </div>
      )}

      {/* ---------- CENTER: interaction prompt ---------- */}
      <div className="pointer-events-auto absolute left-1/2 top-[60%] -translate-x-1/2">
        <button
          onMouseEnter={() => setPromptActive(true)}
          onMouseLeave={() => setPromptActive(false)}
          className={`font-mono text-base tracking-[0.25em] transition-all duration-300 ${
            promptActive ? 'text-stone-100 opacity-100 prompt-active' : 'text-stone-400 opacity-40'
          }`}
        >
          <span className="text-amber-rust">[ E ]</span>{' '}
          {hasTalisman ? 'Hang Talisman' : 'Hide Under Bed [ C ]'}
        </button>
      </div>

      {/* ---------- BOTTOM CENTER: stamina (Hold Breath) ---------- */}
      <div className="absolute bottom-9 left-1/2 -translate-x-1/2 w-64">
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
              background: stamina < 25 ? '#7e1414' : stamina < 60 ? '#b06a2c' : '#d6d3cd',
            }}
          />
        </div>
        <p className="font-mono text-[8px] tracking-widest text-stone-700 mt-1 text-center">
          WASD / ARROWS MOVE · HOLD [ SPACE ] TO STAY SILENT
        </p>
      </div>

      {/* ---------- BOTTOM RIGHT: inventory slot ---------- */}
      <div className="absolute bottom-9 right-9">
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
      <div className="pointer-events-auto absolute top-5 left-5 flex flex-col gap-2">
        <button
          onClick={() => fastForward(10)}
          className="glitch-target font-mono text-[10px] tracking-widest text-stone-500 border border-stone-800 px-3 py-1 hover:border-blood"
        >
          ⏩ FAST-FORWARD TIME
        </button>
        <button
          onClick={startGame}
          className="glitch-target font-mono text-[10px] tracking-widest text-stone-500 border border-stone-800 px-3 py-1 hover:border-amber-rust"
        >
          ↺ RESTART DAY
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
