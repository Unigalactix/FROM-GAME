import { create } from 'zustand';

export const DAY_LENGTH = 60; // seconds of daylight (mock)

// Global game state. As the game grows (Phases 1+), gameplay systems
// (movement, enemies, sanity, inventory) will hang off this store.
export const useGameStore = create((set) => ({
  // ---- Screen / scene routing ----
  screen: 'menu', // 'menu' | 'game'
  enterTown: () => set({ screen: 'game' }),
  exitToMenu: () => set({ screen: 'menu' }),

  // ---- Day / night cycle ----
  secondsLeft: DAY_LENGTH,
  tickClock: () =>
    set((s) => ({ secondsLeft: Math.max(0, s.secondsLeft - 1) })),
  fastForward: (amount = 15) =>
    set((s) => ({ secondsLeft: Math.max(0, s.secondsLeft - amount) })),
  resetDay: () => set({ secondsLeft: DAY_LENGTH, hasTalisman: true }),

  // ---- Player breath / stamina ----
  stamina: 100,
  holding: false,
  setHolding: (holding) => set({ holding }),
  drainStamina: () =>
    set((s) => ({
      stamina: s.holding
        ? Math.max(0, s.stamina - 3)
        : Math.min(100, s.stamina + 1.5),
    })),

  // ---- Inventory ----
  hasTalisman: true,
  hangTalisman: () => set({ hasTalisman: false }),
}));
