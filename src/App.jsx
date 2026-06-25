import { useGameStore } from './store.js';
import MainMenu from './scenes/MainMenu.jsx';
import Game from './scenes/Game.jsx';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  return screen === 'menu' ? <MainMenu /> : <Game />;
}
