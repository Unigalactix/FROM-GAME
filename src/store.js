import { create } from 'zustand';

// ---- Day / night cycle definition ----
// Time counts UP from 0. Reaching the end of the cycle = surviving to dawn = win.
export const PHASES = [
  { phase: 'DAY', duration: 30 },
  { phase: 'DUSK', duration: 8 },
  { phase: 'NIGHT', duration: 40 },
  { phase: 'DAWN', duration: 6 },
];

export const CYCLE_LENGTH = PHASES.reduce((sum, p) => sum + p.duration, 0);

// Resolve the current phase and time remaining within it.
export function getPhaseInfo(time) {
  let t = time;
  for (let i = 0; i < PHASES.length; i++) {
    if (t < PHASES[i].duration) {
      return { phase: PHASES[i].phase, index: i, phaseTimeLeft: PHASES[i].duration - t };
    }
    t -= PHASES[i].duration;
  }
  return { phase: 'DAWN', index: PHASES.length - 1, phaseTimeLeft: 0 };
}

export const PLAYER_START = { x: 480, y: 545 };

export const useGameStore = create((set, get) => ({
  // ---- Screen routing ----
  screen: 'menu', // 'menu' | 'game'
  enterTown: () => {
    get().startGame();
    set({ screen: 'game' });
  },
  exitToMenu: () => set({ screen: 'menu' }),

  // ---- Run state ----
  status: 'playing', // 'playing' | 'won' | 'lost'
  time: 0,
  health: 100,
  player: { ...PLAYER_START },
  inside: false,

  // ---- Player resources ----
  stamina: 100,
  holding: false,
  hasTalisman: true,

  startGame: () =>
    set({
      status: 'playing',
      time: 0,
      health: 100,
      player: { ...PLAYER_START },
      inside: false,
      stamina: 100,
      holding: false,
      hasTalisman: true,
    }),

  // Dev helper: jump the clock forward, triggering win if it reaches dawn.
  fastForward: (sec = 10) =>
    set((s) => {
      if (s.status !== 'playing') return {};
      const time = Math.min(CYCLE_LENGTH, s.time + sec);
      return time >= CYCLE_LENGTH ? { time: CYCLE_LENGTH, status: 'won' } : { time };
    }),

  // ---- Breath / stamina (HUD-driven) ----
  setHolding: (holding) => set({ holding }),
  drainStamina: () =>
    set((s) => ({
      stamina: s.holding ? Math.max(0, s.stamina - 3) : Math.min(100, s.stamina + 1.5),
    })),

  // ---- Inventory ----
  hangTalisman: () => set({ hasTalisman: false }),
}));
