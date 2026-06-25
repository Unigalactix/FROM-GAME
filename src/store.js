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
export const START_TALISMANS = 2;

// Continuous daylight level 0..1 across the cycle, so lighting fades smoothly
// instead of snapping at phase boundaries. 1 = broad daylight, ~0.05 = deep night.
export function dayLight(time) {
  const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
  const DAY = PHASES[0].duration; // 30
  const DUSK = DAY + PHASES[1].duration; // 38
  const NIGHT = DUSK + PHASES[2].duration; // 78
  if (time < DAY) return lerp(1.0, 0.85, time / DAY); // bright, dimming gently
  if (time < DUSK) return lerp(0.85, 0.12, (time - DAY) / PHASES[1].duration); // sun sets
  if (time < NIGHT) return lerp(0.12, 0.05, (time - DUSK) / 6); // settle to dark
  return lerp(0.05, 0.95, (time - NIGHT) / PHASES[3].duration); // dawn rises
}

// ---- Persistent progression (survives across nights via localStorage) ----
import {
  NPCS,
  RECIPES,
  LORE,
  nearestNpc,
  nearestLore,
  nearestMaterial,
  nearestTask,
} from './systems/world.js';

const SAVE_KEY = 'nowhere-town-save-v1';
const SETTINGS_KEY = 'nowhere-town-settings-v1';
const KEYBINDS_KEY = 'nowhere-town-keys-v1';

function defaultSettings() {
  return {
    masterVolume: 70, // 0..100
    brightness: 50, // 0..100 (50 = neutral)
    sensitivity: 50, // 0..100 (50 = 1x mouse look)
    quality: 'high', // 'low' | 'medium' | 'high'
    cameraMode: 'fpp', // 'fpp' (first-person) | 'tpp' (third-person)
    reduceMotion: false, // disables grain/shake/head-bob
    subtitles: true,
  };
}

// ---- Remappable controls ----
// Each action maps to a KeyboardEvent.code. Arrow keys remain hard-wired as a
// secondary movement fallback in the controller.
export const KEY_ACTIONS = [
  { id: 'forward', label: 'Move Forward' },
  { id: 'back', label: 'Move Back' },
  { id: 'left', label: 'Move Left' },
  { id: 'right', label: 'Move Right' },
  { id: 'sneak', label: 'Sneak' },
  { id: 'breath', label: 'Hold Breath' },
  { id: 'interact', label: 'Interact' },
  { id: 'hide', label: 'Hide / Stand' },
  { id: 'ward', label: 'Hang Talisman' },
  { id: 'lantern', label: 'Toggle Lantern' },
  { id: 'journal', label: 'Journal' },
  { id: 'craft', label: 'Crafting' },
  { id: 'bandage', label: 'Use Bandage' },
  { id: 'eat', label: 'Eat Food' },
  { id: 'camera', label: 'Toggle View (1st/3rd)' },
];

function defaultKeybinds() {
  return {
    forward: 'KeyW',
    back: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    sneak: 'ShiftLeft',
    breath: 'Space',
    interact: 'KeyG',
    hide: 'KeyC',
    ward: 'KeyE',
    lantern: 'KeyF',
    journal: 'KeyJ',
    craft: 'KeyK',
    bandage: 'KeyH',
    eat: 'KeyB',
    camera: 'KeyV',
  };
}

function loadKeybinds() {
  try {
    const raw = localStorage.getItem(KEYBINDS_KEY);
    if (!raw) return defaultKeybinds();
    return { ...defaultKeybinds(), ...JSON.parse(raw) };
  } catch {
    return defaultKeybinds();
  }
}

function saveKeybinds(k) {
  try {
    localStorage.setItem(KEYBINDS_KEY, JSON.stringify(k));
  } catch {
    /* ignore */
  }
}

// Human-readable label for a KeyboardEvent.code (for HUD hints + settings).
export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }[code];
  return { ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', Space: 'Space', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl' }[code] || code;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function defaultProgress() {
  return {
    day: 1,
    talismans: START_TALISMANS,
    bandages: 0,
    food: 0,
    materials: { cloth: 0, bone: 0, wax: 0, wire: 0 },
    loreFound: [],
    quests: [], // { id, status: 'active' | 'done' }
    flags: {},
  };
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultProgress();
    return { ...defaultProgress(), ...JSON.parse(raw) };
  } catch {
    return defaultProgress();
  }
}

function saveProgress(s) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        day: s.day,
        talismans: s.talismans,
        bandages: s.bandages,
        food: s.food,
        materials: s.materials,
        loreFound: s.loreFound,
        quests: s.quests,
        flags: s.flags,
      })
    );
  } catch {
    /* ignore */
  }
}

// Fresh run-state for a single night (progression is preserved).
function nightState() {
  return {
    status: 'playing',
    time: 0,
    paused: false,
    health: 100,
    player: { ...PLAYER_START },
    playerYaw: -Math.PI / 2, // facing heading, fed by the FP controller for the minimap
    inside: false,
    enemies: [],
    fear: 0,
    hidden: false,
    tension: 0,
    wards: [],
    promptDoor: null,
    promptHide: false,
    promptInteract: null,
    stamina: 100,
    holding: false,
    battery: 100,
    lanternOn: true,
    materialsTaken: [], // material-node ids gathered this night (respawn nightly)
    tasksDone: [], // daytime chore ids completed today (refresh nightly)
    activeDialogue: null,
    showJournal: false,
    showCraft: false,
    toasts: [], // queue of transient messages { id, text }
  };
}

let toastSeq = 0;

export const useGameStore = create((set, get) => ({
  // ---- Screen routing ----
  screen: 'menu', // 'menu' | 'game'
  enterTown: () => {
    const progress = loadProgress();
    set({ ...progress, ...nightState(), screen: 'game' });
  },
  exitToMenu: () => set({ screen: 'menu' }),

  // ---- Settings (persisted separately; live across menu + game) ----
  settings: loadSettings(),
  setSetting: (key, value) =>
    set((s) => {
      const settings = { ...s.settings, [key]: value };
      saveSettings(settings);
      return { settings };
    }),
  // Flip between first- and third-person view (persisted).
  toggleCameraMode: () =>
    set((s) => {
      const settings = { ...s.settings, cameraMode: s.settings.cameraMode === 'tpp' ? 'fpp' : 'tpp' };
      saveSettings(settings);
      return { settings };
    }),

  // ---- Remappable controls ----
  keybinds: loadKeybinds(),
  setKeybind: (action, code) =>
    set((s) => {
      // Clear this code from any other action so a key is never double-bound.
      const keybinds = { ...s.keybinds };
      for (const a in keybinds) if (keybinds[a] === code) keybinds[a] = null;
      keybinds[action] = code;
      saveKeybinds(keybinds);
      return { keybinds };
    }),
  resetKeybinds: () => {
    const keybinds = defaultKeybinds();
    saveKeybinds(keybinds);
    set({ keybinds });
  },

  // ---- In-game pause ----
  setPaused: (paused) => set({ paused }),
  togglePause: () => set((s) => ({ paused: s.status === 'playing' ? !s.paused : false })),

  // ---- Persistent progression ----
  ...defaultProgress(),

  // ---- Run state ----
  ...nightState(),

  // Start (or restart) the current night — keeps all progression.
  startGame: () => set({ ...nightState() }),

  // Survived to dawn: advance the day, persist, begin the next night.
  nextDay: () =>
    set((s) => {
      const day = s.day + 1;
      const next = { ...s, day };
      saveProgress(next);
      return { day, ...nightState() };
    }),

  // Wipe the save and begin again from Day 1.
  resetSave: () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    set({ ...defaultProgress(), ...nightState() });
  },

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

  // ---- Transient toast messages (small fading queue, newest at the bottom) ----
  showToast: (text) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, text }].slice(-4) }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2800);
  },

  // ---- Interact: talk / pick up lore / scavenge materials (edge-triggered) ----
  interact: () => {
    const s = get();
    if (s.status !== 'playing' || s.hidden || s.activeDialogue) return;
    const { x, y } = s.player;

    // 1) Talk to a nearby survivor.
    const npc = nearestNpc(x, y);
    if (npc) {
      get().openDialogue(npc.id);
      return;
    }

    // 2) Read a piece of lore.
    const lore = nearestLore(x, y, s.loreFound);
    if (lore) {
      const loreFound = [...s.loreFound, lore.id];
      const next = { ...s, loreFound };
      saveProgress(next);
      set({ loreFound, readingLore: lore.id });
      get().showToast(`Found \u2014 ${lore.title}`);
      return;
    }

    // 3) Work a daytime chore (only while the sun is up).
    const { phase } = getPhaseInfo(s.time);
    if (phase !== 'NIGHT') {
      const task = nearestTask(x, y, s.tasksDone);
      if (task) {
        const r = task.reward || {};
        const food = s.food + (r.food || 0);
        const materials = { ...s.materials };
        if (r.materials) for (const k in r.materials) materials[k] = (materials[k] || 0) + r.materials[k];
        const tasksDone = [...s.tasksDone, task.id];
        const next = { ...s, food, materials };
        saveProgress(next);
        set({ food, materials, tasksDone });
        get().showToast(`${task.verb} \u2014 done`);
        return;
      }
    }

    // 4) Scavenge a material.
    const node = nearestMaterial(x, y, s.materialsTaken);
    if (node) {
      const materials = { ...s.materials, [node.kind]: (s.materials[node.kind] || 0) + 1 };
      const materialsTaken = [...s.materialsTaken, node.id];
      const next = { ...s, materials };
      saveProgress(next);
      set({ materials, materialsTaken });
      get().showToast(`Scavenged \u2014 ${node.kind}`);
    }
  },

  // ---- Reading a lore entry full-screen ----
  readingLore: null,
  closeLore: () => set({ readingLore: null }),

  // ---- Dialogue ----
  openDialogue: (npcId) => {
    const s = get();
    const npc = NPCS.find((n) => n.id === npcId);
    if (!npc) return;
    const q = npc.quest;
    const record = s.quests.find((r) => r.id === q.id);
    let lines;
    let mode;
    if (!record) {
      lines = npc.intro;
      mode = 'intro';
    } else if (record.status === 'active' && q.check(s)) {
      lines = q.done;
      mode = 'complete';
    } else if (record.status === 'active') {
      lines = [`"${q.title}" \u2014 ${q.desc}`];
      mode = 'remind';
    } else {
      lines = ['"Keep your head down. Dawn is the only thing worth trusting here."'];
      mode = 'idle';
    }
    set({ activeDialogue: { npcId, name: npc.name, lines, idx: 0, mode } });
  },

  advanceDialogue: () => {
    const s = get();
    const d = s.activeDialogue;
    if (!d) return;
    if (d.idx < d.lines.length - 1) {
      set({ activeDialogue: { ...d, idx: d.idx + 1 } });
      return;
    }
    // End of dialogue — apply its result.
    const npc = NPCS.find((n) => n.id === d.npcId);
    const q = npc.quest;
    if (d.mode === 'intro') {
      const quests = [...s.quests, { id: q.id, status: 'active' }];
      const next = { ...s, quests };
      saveProgress(next);
      set({ quests, activeDialogue: null });
      get().showToast(`New objective \u2014 ${q.title}`);
    } else if (d.mode === 'complete') {
      let materials = { ...s.materials };
      let talismans = s.talismans;
      let bandages = s.bandages;
      const flags = { ...s.flags };
      if (q.cost) for (const k in q.cost) materials[k] = Math.max(0, (materials[k] || 0) - q.cost[k]);
      const r = q.reward || {};
      if (r.materials) for (const k in r.materials) materials[k] = (materials[k] || 0) + r.materials[k];
      if (r.talismans) talismans += r.talismans;
      if (r.bandages) bandages += r.bandages;
      if (r.flag) flags[r.flag] = true;
      const quests = s.quests.map((r2) => (r2.id === q.id ? { ...r2, status: 'done' } : r2));
      const next = { ...s, materials, talismans, bandages, flags, quests };
      saveProgress(next);
      set({ materials, talismans, bandages, flags, quests, activeDialogue: null });
      get().showToast(`Quest complete \u2014 ${q.title}`);
    } else {
      set({ activeDialogue: null });
    }
  },

  closeDialogue: () => set({ activeDialogue: null }),

  // ---- Crafting ----
  toggleCraft: () => set((s) => ({ showCraft: !s.showCraft, showJournal: false })),
  toggleJournal: () => set((s) => ({ showJournal: !s.showJournal, showCraft: false })),

  craft: (recipeId) => {
    const s = get();
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
    for (const k in recipe.cost) {
      if ((s.materials[k] || 0) < recipe.cost[k]) {
        get().showToast('Not enough materials');
        return;
      }
    }
    const materials = { ...s.materials };
    for (const k in recipe.cost) materials[k] -= recipe.cost[k];
    let talismans = s.talismans;
    let bandages = s.bandages;
    let battery = s.battery;
    const flags = { ...s.flags };
    if (recipe.yields === 'talisman') {
      talismans += 1;
      flags.craftedTalisman = true;
    } else if (recipe.yields === 'bandage') {
      bandages += 1;
    } else if (recipe.yields === 'battery') {
      battery = Math.min(100, battery + 45);
    }
    const next = { ...s, materials, talismans, bandages, flags };
    saveProgress(next);
    set({ materials, talismans, bandages, battery, flags });
    get().showToast(`Crafted \u2014 ${recipe.label}`);
  },

  // ---- Use a bandage to recover health ----
  useBandage: () => {
    const s = get();
    if (s.bandages <= 0 || s.health >= 100 || s.status !== 'playing') return;
    const bandages = s.bandages - 1;
    const health = Math.min(100, s.health + 35);
    const next = { ...s, bandages };
    saveProgress(next);
    set({ bandages, health });
    get().showToast('Bandage applied');
  },

  // ---- Eat gathered food to recover a little health ----
  eatFood: () => {
    const s = get();
    if (s.food <= 0 || s.health >= 100 || s.status !== 'playing') return;
    const food = s.food - 1;
    const health = Math.min(100, s.health + 22);
    const next = { ...s, food };
    saveProgress(next);
    set({ food, health });
    get().showToast('Ate food');
  },
}));

