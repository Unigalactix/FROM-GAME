import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store.js';
import FirstPerson from './FirstPerson.jsx';
import HUD from './HUD.jsx';
import Panels from './Panels.jsx';
import { initAudio, startAmbient, setMasterVolume } from '../systems/audio.js';

export default function Game() {
  const status = useGameStore((s) => s.status);
  const fear = useGameStore((s) => s.fear);
  const day = useGameStore((s) => s.day);
  const startGame = useGameStore((s) => s.startGame);
  const nextDay = useGameStore((s) => s.nextDay);
  const exitToMenu = useGameStore((s) => s.exitToMenu);
  const settings = useGameStore((s) => s.settings);

  // Any open panel pauses the world and frees the mouse.
  const panelOpen = useGameStore(
    (s) => !!(s.activeDialogue || s.showJournal || s.showCraft || s.readingLore)
  );

  const wrapRef = useRef(null);
  const [locked, setLocked] = useState(false);

  // Track pointer-lock so we can show the click-to-look overlay.
  useEffect(() => {
    const onChange = () => setLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', onChange);
    return () => document.removeEventListener('pointerlockchange', onChange);
  }, []);

  // Keep the audio master in sync with the volume setting.
  useEffect(() => {
    setMasterVolume(settings.masterVolume);
  }, [settings.masterVolume]);

  // Release the mouse when the run ends or a panel opens.
  useEffect(() => {
    if ((status !== 'playing' || panelOpen) && document.pointerLockElement)
      document.exitPointerLock();
  }, [status, panelOpen]);

  const requestLock = () => {
    // First gesture also unlocks the browser's audio context.
    initAudio();
    startAmbient();
    setMasterVolume(settings.masterVolume);
    const canvas = wrapRef.current?.querySelector('canvas');
    canvas?.requestPointerLock();
  };

  // Brightness setting: 50 = neutral, maps to a CSS filter on the whole view.
  const brightness = 0.6 + (settings.brightness / 100) * 0.9; // 0.6 .. 1.5

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
      <div
        ref={wrapRef}
        className="relative h-full w-full"
        style={{ filter: `brightness(${brightness.toFixed(2)})` }}
      >
        <FirstPerson />
        <HUD />
      </div>

      {/* Film grain — subtle animated noise for atmosphere (skipped if reduce-motion). */}
      {!settings.reduceMotion && <div className="pointer-events-none absolute inset-0 z-30 film-grain" />}

      {/* Fear-driven closing vignette: the more afraid, the tighter the dark. */}
      <div
        className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-300"
        style={{
          opacity: fear / 100,
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0) 28%, rgba(30,2,2,0.6) 75%, rgba(0,0,0,0.95) 100%)',
        }}
      />

      {/* Story / progression panels (dialogue, journal, crafting, lore). */}
      <Panels />

      {/* Click-to-look overlay (pointer lock). */}
      {!locked && status === 'playing' && !panelOpen && (
        <button
          onClick={requestLock}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer"
        >
          <p className="font-type text-3xl tracking-[0.3em] text-stone-300 mb-3">CLICK TO LOOK</p>
          <p className="font-mono text-[10px] tracking-[0.4em] text-stone-500 uppercase">
            WASD move · Mouse look · G interact · J journal · K craft · B eat · F lantern
          </p>
        </button>
      )}

      {status !== 'playing' && (
        <EndScreen status={status} day={day} onNextDay={nextDay} onRetry={startGame} onMenu={exitToMenu} />
      )}
    </div>
  );
}

function EndScreen({ status, day, onNextDay, onRetry, onMenu }) {
  const won = status === 'won';
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm flicker">
      <p className="font-mono text-[10px] tracking-[0.5em] text-stone-600 uppercase mb-4">
        {won ? `Day ${day} survived` : 'The night was longer than you'}
      </p>
      <h2
        className={`font-type text-5xl md:text-6xl tracking-[0.2em] mb-2 ${
          won ? 'text-amber-rust' : 'text-blood sunset-pulse'
        }`}
      >
        {won ? 'DAWN BREAKS' : 'TAKEN'}
      </h2>
      <p className="font-mono text-xs tracking-[0.3em] text-stone-500 mb-12">
        {won
          ? `You lived to see Day ${day + 1}. The town will want it back.`
          : 'They found you in the dark.'}
      </p>

      <div className="flex flex-col items-center gap-5">
        {won ? (
          <button
            onClick={onNextDay}
            className="glitch-target font-mono text-lg tracking-[0.3em] text-stone-300"
          >
            FACE DAY {day + 1}
          </button>
        ) : (
          <button
            onClick={onRetry}
            className="glitch-target font-mono text-lg tracking-[0.3em] text-stone-300"
          >
            TRY AGAIN
          </button>
        )}
        <button
          onClick={onMenu}
          className="glitch-target font-mono text-sm tracking-[0.3em] text-stone-500"
        >
          MAIN MENU
        </button>
      </div>
    </div>
  );
}
