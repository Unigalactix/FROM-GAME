import { useEffect } from 'react';
import { useGameStore, getPhaseInfo } from '../store.js';
import Icon from '../components/Icon.jsx';
import Minimap from './Minimap.jsx';

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
  const fear = useGameStore((s) => s.fear);
  const hidden = useGameStore((s) => s.hidden);
  const tension = useGameStore((s) => s.tension);
  const talismans = useGameStore((s) => s.talismans);
  const promptDoor = useGameStore((s) => s.promptDoor);
  const promptHide = useGameStore((s) => s.promptHide);
  const promptInteract = useGameStore((s) => s.promptInteract);
  const battery = useGameStore((s) => s.battery);
  const lanternOn = useGameStore((s) => s.lanternOn);
  const day = useGameStore((s) => s.day);
  const bandages = useGameStore((s) => s.bandages);
  const food = useGameStore((s) => s.food);
  const toast = useGameStore((s) => s.toast);

  const fastForward = useGameStore((s) => s.fastForward);
  const startGame = useGameStore((s) => s.startGame);
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  const setHolding = useGameStore((s) => s.setHolding);
  const drainStamina = useGameStore((s) => s.drainStamina);

  const { phase, phaseTimeLeft } = getPhaseInfo(time);
  const ps = PHASE_STYLES[phase];
  const exposed = phase === 'NIGHT' && !inside && !hidden;

  // Stamina drain / regen for "Hold Breath".
  useEffect(() => {
    const t = setInterval(drainStamina, 100);
    return () => clearInterval(t);
  }, [drainStamina]);

  // Space = hold breath.
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setHolding(true);
      }
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
  }, [setHolding]);

  const ss = String(Math.ceil(phaseTimeLeft)).padStart(2, '0');

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      {/* ---------- TOP CENTER: phase clock + meters ---------- */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-1">
          <Icon name={ps.icon} size={14} className={ps.iconColor} />
          <span className="font-mono text-[10px] tracking-[0.4em] text-stone-500 uppercase">
            Until Next
          </span>
        </div>
        <div className={`font-mono text-4xl tracking-[0.25em] ${ps.color}`}>{ps.label}</div>
        <div className="font-mono text-xs tracking-[0.3em] text-stone-500 mt-1">0:{ss}</div>
        <div className="font-mono text-[9px] tracking-[0.5em] text-stone-600 mt-1">DAY {day}</div>

        <Meter label="Condition" value={health} className="mt-3" tone="health" />
        <Meter label="Fear" value={fear} className="mt-2" tone="fear" />
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

      {/* ---------- HIDDEN: tension meter ---------- */}
      {hidden && (
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 flex flex-col items-center w-48">
          <p className="font-mono text-[11px] tracking-[0.4em] text-stone-300 mb-2">HIDDEN</p>
          <div className="h-[3px] w-full bg-stone-900 overflow-hidden">
            <div
              className="h-full transition-[width] duration-100 ease-linear"
              style={{
                width: `${tension}%`,
                background: tension > 70 ? '#7e1414' : '#b06a2c',
              }}
            />
          </div>
          <p className="font-mono text-[8px] tracking-widest text-stone-600 mt-1">
            {tension > 70 ? 'THEY SENSE SOMETHING' : 'STAY STILL'}
          </p>
        </div>
      )}

      {/* ---------- CENTER: interaction prompts ---------- */}
      <div className="absolute left-1/2 top-[60%] -translate-x-1/2 flex flex-col items-center gap-2">
        {hidden ? (
          <Prompt keyLabel="C" text="Stop Hiding" active />
        ) : (
          <>
            {promptInteract && <Prompt keyLabel="G" text={promptInteract} active />}
            {promptHide && <Prompt keyLabel="C" text="Hide Here" active />}
            {promptDoor && <Prompt keyLabel="E" text={`Hang Talisman \u00b7 ${promptDoor}`} active />}
          </>
        )}
      </div>

      {/* ---------- TOAST (transient pickups / events) ---------- */}
      {toast && (
        <div className="absolute left-1/2 top-[72%] -translate-x-1/2">
          <p className="font-mono text-[11px] tracking-[0.3em] text-amber-rust/90 prompt-active">
            {toast.text}
          </p>
        </div>
      )}

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
          WASD MOVE · MOUSE LOOK · G INTERACT · C HIDE · E WARD · J JOURNAL · K CRAFT · H BANDAGE · B EAT · F LANTERN
        </p>
      </div>

      {/* ---------- BOTTOM LEFT: lantern battery ---------- */}
      <div className="absolute bottom-9 left-9 w-40">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[9px] tracking-[0.3em] text-stone-500 uppercase">
            {lanternOn ? 'Lantern On' : 'Lantern Off'}
          </span>
          <Icon name="sun" size={12} className={lanternOn && battery > 0 ? 'text-amber-rust' : 'text-stone-700'} />
        </div>
        <div className="h-[3px] w-full bg-stone-900 overflow-hidden">
          <div
            className="h-full transition-[width] duration-150 ease-linear"
            style={{
              width: `${battery}%`,
              background: battery < 20 ? '#7e1414' : battery < 50 ? '#b06a2c' : '#d6b06a',
            }}
          />
        </div>
        <p className="font-mono text-[8px] tracking-widest text-stone-700 mt-1">BATTERY</p>
      </div>

      {/* ---------- BOTTOM LEFT (above battery): bandages + food ---------- */}
      {bandages > 0 && (
        <div className="absolute bottom-[88px] left-9 flex items-center gap-2">
          <Icon name="cross" size={12} className="text-blood/70" />
          <span className="font-mono text-[10px] tracking-[0.3em] text-stone-400">
            BANDAGES x{bandages}
          </span>
          <span className="font-mono text-[8px] tracking-widest text-stone-600">[H]</span>
        </div>
      )}
      {food > 0 && (
        <div className="absolute bottom-[112px] left-9 flex items-center gap-2">
          <span className="font-mono text-[11px] text-amber-rust/70">❀</span>
          <span className="font-mono text-[10px] tracking-[0.3em] text-stone-400">
            FOOD x{food}
          </span>
          <span className="font-mono text-[8px] tracking-widest text-stone-600">[B]</span>
        </div>
      )}

      {/* ---------- BOTTOM RIGHT: talisman inventory ---------- */}
      <div className="absolute bottom-9 right-9">
        <div className="w-16 h-16 border border-stone-700/70 flex items-center justify-center relative bg-black/40">
          {talismans > 0 ? (
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
          <span className="absolute -top-1.5 -right-1.5 font-mono text-[10px] text-amber-rust bg-black px-1">
            {talismans}
          </span>
        </div>
        <p className="font-mono text-[8px] tracking-widest text-stone-600 mt-1 text-center">
          TALISMAN
        </p>
      </div>

      {/* ---------- TOP RIGHT: minimap ---------- */}
      <div className="absolute top-5 right-5">
        <Minimap />
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

function Meter({ label, value, tone, className = '' }) {
  const color =
    tone === 'fear'
      ? value > 70
        ? '#7e1414'
        : value > 40
        ? '#b06a2c'
        : '#5a5750'
      : value < 30
      ? '#7e1414'
      : value < 60
      ? '#b06a2c'
      : '#9b9890';
  return (
    <div className={`w-52 ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[9px] tracking-[0.3em] text-stone-500 uppercase">
          {label}
        </span>
        <span className="font-mono text-[9px] text-stone-500">{Math.ceil(value)}</span>
      </div>
      <div className="h-[4px] w-full bg-stone-900 overflow-hidden">
        <div
          className="h-full transition-[width] duration-150 ease-linear"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

function Prompt({ keyLabel, text, active }) {
  return (
    <div
      className={`font-mono text-base tracking-[0.25em] transition-all duration-300 ${
        active ? 'text-stone-100 opacity-100 prompt-active' : 'text-stone-400 opacity-40'
      }`}
    >
      <span className="text-amber-rust">[ {keyLabel} ]</span> {text}
    </div>
  );
}
