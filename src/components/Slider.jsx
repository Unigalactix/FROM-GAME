import { useState } from 'react';

// Controlled when `value`/`onChange` are passed; otherwise falls back to local
// state (used for purely cosmetic sliders).
export default function Slider({ label, def = 60, value, onChange }) {
  const [local, setLocal] = useState(def);
  const controlled = value !== undefined;
  const val = controlled ? value : local;
  const set = (v) => {
    if (controlled) onChange(v);
    else setLocal(v);
  };
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] text-stone-500 mb-1">
        <span>{label}</span>
        <span className="text-amber-rust">{val}</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={val}
        onChange={(e) => set(+e.target.value)}
        className="w-full h-[3px] appearance-none bg-stone-800 accent-blood cursor-pointer"
      />
    </div>
  );
}
