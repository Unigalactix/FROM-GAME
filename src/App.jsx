import { Suspense, lazy } from 'react';
import { useGameStore } from './store.js';
import MainMenu from './scenes/MainMenu.jsx';

// The 3D game (and all of Three.js) is loaded only when the player enters town,
// keeping the initial menu payload tiny.
const Game = lazy(() => import('./scenes/Game.jsx'));

function Loading() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-black flicker">
      <p className="font-type text-2xl tracking-[0.4em] text-stone-500">ENTERING TOWN…</p>
    </div>
  );
}

export default function App() {
  const screen = useGameStore((s) => s.screen);
  if (screen === 'menu') return <MainMenu />;
  return (
    <Suspense fallback={<Loading />}>
      <Game />
    </Suspense>
  );
}
