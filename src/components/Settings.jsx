import { useEffect, useState } from 'react';
import { useGameStore, KEY_ACTIONS, keyLabel } from '../store.js';
import Icon from './Icon.jsx';
import Slider from './Slider.jsx';

const QUALITIES = ['low', 'medium', 'high'];

export default function Settings() {
  const settings = useGameStore((s) => s.settings);
  const setSetting = useGameStore((s) => s.setSetting);
  const keybinds = useGameStore((s) => s.keybinds);
  const setKeybind = useGameStore((s) => s.setKeybind);
  const resetKeybinds = useGameStore((s) => s.resetKeybinds);
  const [rebinding, setRebinding] = useState(null);

  // While rebinding, the next key pressed becomes the new binding (Esc cancels).
  useEffect(() => {
    if (!rebinding) return;
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== 'Escape') setKeybind(rebinding, e.code);
      setRebinding(null);
    };
    window.addEventListener('keydown', onKey, { capture: true, once: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [rebinding, setKeybind]);

  return (
    <div className="mt-10 w-80 border border-stone-800 bg-black/80 p-4 font-mono text-xs text-stone-400">
      <div className="flex items-center justify-between mb-3 text-amber-rust">
        <span className="tracking-widest">SETTINGS</span>
        <Icon name="settings" size={14} className="text-amber-rust" />
      </div>

      <Slider
        label="MASTER VOLUME"
        value={settings.masterVolume}
        onChange={(v) => setSetting('masterVolume', v)}
      />
      <Slider
        label="BRIGHTNESS"
        value={settings.brightness}
        onChange={(v) => setSetting('brightness', v)}
      />
      <Slider
        label="MOUSE SENSITIVITY"
        value={settings.sensitivity}
        onChange={(v) => setSetting('sensitivity', v)}
      />

      {/* Graphics quality */}
      <div className="mt-3 mb-1 flex items-center justify-between">
        <span className="text-[10px] text-stone-500">GRAPHICS</span>
        <div className="flex gap-1">
          {QUALITIES.map((q) => (
            <button
              key={q}
              onClick={() => setSetting('quality', q)}
              className={`px-2 py-0.5 border text-[9px] uppercase tracking-widest ${
                settings.quality === q
                  ? 'border-amber-rust/60 text-amber-rust'
                  : 'border-stone-800 text-stone-600 hover:text-stone-400'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Camera perspective */}
      <div className="mt-3 mb-1 flex items-center justify-between">
        <span className="text-[10px] text-stone-500">CAMERA</span>
        <div className="flex gap-1">
          {[
            ['fpp', '1ST PERSON'],
            ['tpp', '3RD PERSON'],
          ].map(([m, label]) => (
            <button
              key={m}
              onClick={() => setSetting('cameraMode', m)}
              className={`px-2 py-0.5 border text-[9px] uppercase tracking-widest ${
                settings.cameraMode === m
                  ? 'border-amber-rust/60 text-amber-rust'
                  : 'border-stone-800 text-stone-600 hover:text-stone-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Toggle
        label="REDUCE MOTION"
        on={settings.reduceMotion}
        onToggle={() => setSetting('reduceMotion', !settings.reduceMotion)}
      />
      <Toggle
        label="SUBTITLES"
        on={settings.subtitles}
        onToggle={() => setSetting('subtitles', !settings.subtitles)}
      />

      {/* Controls remapping */}
      <div className="mt-4 mb-2 flex items-center justify-between text-amber-rust">
        <span className="tracking-widest text-[10px]">CONTROLS</span>
        <button
          onClick={resetKeybinds}
          className="text-[9px] tracking-widest text-stone-600 hover:text-stone-300 border border-stone-800 px-2 py-0.5"
        >
          RESET
        </button>
      </div>
      <ul className="max-h-44 overflow-y-auto pr-1">
        {KEY_ACTIONS.map((a) => (
          <li key={a.id} className="flex items-center justify-between py-0.5">
            <span className="text-[10px] text-stone-500">{a.label}</span>
            <button
              onClick={() => setRebinding(a.id)}
              className={`min-w-[58px] px-2 py-0.5 border text-[9px] uppercase tracking-widest ${
                rebinding === a.id
                  ? 'border-blood text-blood animate-pulse'
                  : 'border-stone-800 text-stone-300 hover:border-amber-rust/60'
              }`}
            >
              {rebinding === a.id ? 'press…' : keyLabel(keybinds[a.id])}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[9px] text-stone-700 tracking-wide">
        Turning the whispers down does not make them stop.
      </p>
    </div>
  );
}

function Toggle({ label, on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between py-1.5 text-[10px] text-stone-500 hover:text-stone-300"
    >
      <span>{label}</span>
      <span
        className={`px-2 py-0.5 border tracking-widest ${
          on ? 'border-amber-rust/60 text-amber-rust' : 'border-stone-800 text-stone-600'
        }`}
      >
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  );
}
