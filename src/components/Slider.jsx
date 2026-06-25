import { useState } from 'react';

export default function Slider({ label, def = 60 }) {
  const [val, setVal] = useState(def);
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
        onChange={(e) => setVal(+e.target.value)}
        className="w-full h-[3px] appearance-none bg-stone-800 accent-blood cursor-pointer"
      />
    </div>
  );
}
