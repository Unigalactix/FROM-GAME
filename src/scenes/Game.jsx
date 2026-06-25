import { useGameStore } from '../store.js';
import TownMap from './TownMap.jsx';
import HUD from './HUD.jsx';

export default function Game() {
  const status = useGameStore((s) => s.status);
  const startGame = useGameStore((s) => s.startGame);
  const exitToMenu = useGameStore((s) => s.exitToMenu);

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
      <div className="relative h-full w-full max-w-[1100px] flex items-center justify-center">
        <TownMap />
        <HUD />
      </div>

      {status !== 'playing' && (
        <EndScreen status={status} onRetry={startGame} onMenu={exitToMenu} />
      )}
    </div>
  );
}

function EndScreen({ status, onRetry, onMenu }) {
  const won = status === 'won';
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-sm flicker">
      <p className="font-mono text-[10px] tracking-[0.5em] text-stone-600 uppercase mb-4">
        {won ? 'The first light reaches the town' : 'The night was longer than you'}
      </p>
      <h2
        className={`font-type text-5xl md:text-6xl tracking-[0.2em] mb-2 ${
          won ? 'text-amber-rust' : 'text-blood sunset-pulse'
        }`}
      >
        {won ? 'DAWN BREAKS' : 'TAKEN'}
      </h2>
      <p className="font-mono text-xs tracking-[0.3em] text-stone-500 mb-12">
        {won ? 'You survived the night. It will come again.' : 'They found you in the dark.'}
      </p>

      <div className="flex flex-col items-center gap-5">
        <button
          onClick={onRetry}
          className="glitch-target font-mono text-lg tracking-[0.3em] text-stone-300"
        >
          {won ? 'ENDURE AGAIN' : 'TRY AGAIN'}
        </button>
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
