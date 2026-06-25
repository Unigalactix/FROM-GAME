import { useState } from 'react';
import { useGameStore } from '../store.js';
import Settings from '../components/Settings.jsx';

export default function MainMenu() {
  const enterTown = useGameStore((s) => s.enterTown);
  const cameraMode = useGameStore((s) => s.settings.cameraMode);
  const setSetting = useGameStore((s) => s.setSetting);
  const [showSettings, setShowSettings] = useState(false);

  const items = [
    { label: 'ENTER TOWN', action: enterTown, hint: 'There is no leaving.' },
    {
      label: 'SETTINGS',
      action: () => setShowSettings((s) => !s),
      hint: 'Adjust what little you control.',
    },
    { label: 'ABANDON HOPE', action: () => window.close?.(), hint: 'Quit. As if that helps.' },
  ];

  return (
    <div className="relative h-full w-full flex flex-col items-center justify-center bg-black flicker select-none">
      {/* faint static grain backdrop */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")',
        }}
      />

      <div className="relative z-10 flex flex-col items-center">
        <p className="font-mono text-[10px] tracking-[0.5em] text-amber-rust/70 mb-6 uppercase">
          A place you cannot leave
        </p>

        <h1 className="font-type text-6xl md:text-8xl text-stone-200 title-drift mb-2">
          NOWHERE
        </h1>
        <h2 className="font-type text-3xl md:text-4xl text-stone-500 tracking-[0.4em] mb-16">
          TOWN
        </h2>

        <nav className="flex flex-col items-center gap-6">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="group flex flex-col items-center"
            >
              <span className="glitch-target font-mono text-xl md:text-2xl tracking-[0.3em] text-stone-300">
                {item.label}
              </span>
              <span className="font-mono text-[10px] tracking-widest text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1">
                {item.hint}
              </span>
            </button>
          ))}
        </nav>

        {/* Quick perspective switch before entering. */}
        <div className="mt-10 flex items-center gap-2">
          <span className="font-mono text-[9px] tracking-[0.4em] text-stone-600 uppercase">View</span>
          {[
            ['fpp', '1ST PERSON'],
            ['tpp', '3RD PERSON'],
          ].map(([m, label]) => (
            <button
              key={m}
              onClick={() => setSetting('cameraMode', m)}
              className={`font-mono px-2 py-0.5 border text-[9px] uppercase tracking-widest transition-colors ${
                cameraMode === m
                  ? 'border-amber-rust/60 text-amber-rust'
                  : 'border-stone-800 text-stone-600 hover:text-stone-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {showSettings && <Settings />}
      </div>

      <p className="absolute bottom-6 font-mono text-[9px] tracking-[0.3em] text-stone-700">
        DON'T OPEN THE DOOR AFTER DARK · v0.1
      </p>
    </div>
  );
}
