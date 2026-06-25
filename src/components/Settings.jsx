import { useGameStore } from '../store.js';
import Icon from './Icon.jsx';
import Slider from './Slider.jsx';

export default function Settings() {
  const settings = useGameStore((s) => s.settings);
  const setSetting = useGameStore((s) => s.setSetting);

  return (
    <div className="mt-10 w-72 border border-stone-800 bg-black/80 p-4 font-mono text-xs text-stone-400">
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
