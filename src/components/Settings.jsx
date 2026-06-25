import Icon from '../components/Icon.jsx';
import Slider from '../components/Slider.jsx';

export default function Settings() {
  return (
    <div className="mt-10 w-72 border border-stone-800 bg-black/80 p-4 font-mono text-xs text-stone-400">
      <div className="flex items-center justify-between mb-3 text-amber-rust">
        <span className="tracking-widest">SETTINGS</span>
        <Icon name="settings" size={14} className="text-amber-rust" />
      </div>
      <Slider label="MASTER VOLUME" />
      <Slider label="BRIGHTNESS" def={30} />
      <Slider label="WHISPERS" def={88} />
      <p className="mt-3 text-[9px] text-stone-700 tracking-wide">
        Turning the whispers down does not make them stop.
      </p>
    </div>
  );
}
