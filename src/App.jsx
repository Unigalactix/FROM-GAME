import { useGameStore } from './store.js';
import MainMenu from './scenes/MainMenu.jsx';
import HUD from './scenes/HUD.jsx';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  return screen === 'menu' ? <MainMenu /> : <HUD />;
}
