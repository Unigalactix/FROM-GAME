// World content for Phase 4 — the people, the lore, the materials, and the
// recipes that give the town meaning. Positions use the same top-down (x, y)
// world coordinates as town.js, so they drop straight into both the 2D map and
// the 3D first-person view.

import { BUILDINGS, WORLD, DECOR_HOUSES } from './town.js';

const byName = (name) => BUILDINGS.find((b) => b.name === name);

// ---------- The trees that fold the road ----------
// Standing inside one of these gnarled, sigil-lit trees drops you somewhere
// else in town entirely — the town's signature impossibility. Positions sit in
// open ground (streets / squares) so you actually walk into them.
export const PORTAL_TREES = [
  { id: 'pt1', x: 700, y: 250 },
  { id: 'pt2', x: 540, y: 460 },
  { id: 'pt3', x: 160, y: 400 },
  { id: 'pt4', x: 1080, y: 480 },
  { id: 'pt5', x: 350, y: 470 },
  { id: 'pt6', x: 870, y: 330 },
];

export const PORTAL_RADIUS = 18; // world units — how close you must step to trigger

// True if the point sits inside (or hugging) a solid decorative house.
function insideDecor(x, y, margin = 16) {
  return DECOR_HOUSES.some(
    (h) => x > h.x - margin && x < h.x + h.w + margin && y > h.y - margin && y < h.y + h.h + margin
  );
}

// Pick a random open spot elsewhere in town to be flung to. Always lands a
// meaningful distance from where you left so the jump is felt.
export function randomTeleportTarget(fromX, fromY) {
  for (let i = 0; i < 40; i++) {
    const x = 80 + Math.random() * (WORLD.w - 160);
    const y = 80 + Math.random() * (WORLD.h - 160);
    if (insideDecor(x, y)) continue;
    if (Math.hypot(x - fromX, y - fromY) < 320) continue;
    // Avoid dropping straight onto another portal (instant re-trigger).
    if (PORTAL_TREES.some((p) => Math.hypot(x - p.x, y - p.y) < 40)) continue;
    return { x, y };
  }
  return { x: WORLD.w * 0.5, y: WORLD.h * 0.5 };
}

// ---------- Survivors (NPCs) ----------
// Each lives somewhere in town and offers a small quest. `quest.check` reads the
// store snapshot and returns true when the player has met the request.
export const NPCS = [
  {
    id: 'tabitha',
    name: 'TABITHA',
    building: 'HOUSE',
    x: 660,
    y: 430,
    color: 0x6a7fb0,
    intro: [
      'You\u2019re new. I can tell \u2014 you still think the road out means something.',
      'It doesn\u2019t. Every road here bends back to this town.',
      'Stay inside after dark. Hang a talisman if you have one. And whatever you hear at the window \u2014 don\u2019t answer it.',
    ],
    quest: {
      id: 'q_survive',
      title: 'Endure the Dark',
      desc: 'Survive a single night in Nowhere Town.',
      check: (s) => s.day > 1,
      reward: { flag: 'firstNight' },
      done: ['So. You lived. That puts you ahead of most.', 'Keep going. The town is always watching who lasts.'],
    },
  },
  {
    id: 'kristi',
    name: 'KRISTI',
    building: 'CLINIC',
    x: 1050,
    y: 200,
    color: 0xb06a6a,
    intro: [
      'Don\u2019t bleed out on my floor, I\u2019m almost out of everything.',
      'If you find clean cloth, bring it. I\u2019ll show you how to dress a wound so the night doesn\u2019t finish what it started.',
    ],
    quest: {
      id: 'q_rags',
      title: 'Clean Rags',
      desc: 'Bring KRISTI 2 cloth so she can make dressings.',
      check: (s) => s.materials.cloth >= 2,
      cost: { cloth: 2 },
      reward: { bandages: 2, flag: 'metKristi' },
      done: ['That\u2019ll do. Here \u2014 two dressings. Press one to a wound and it buys you minutes.', 'Minutes are everything out here.'],
    },
  },
  {
    id: 'khatri',
    name: 'FATHER KHATRI',
    building: 'CHURCH',
    x: 440,
    y: 630,
    color: 0xb0a06a,
    intro: [
      'The talismans are older than the town, or so the walls say.',
      'Faith won\u2019t save you here. The charm on the door might.',
      'Craft one. Hang it. Learn what it costs you to keep the dark outside.',
    ],
    quest: {
      id: 'q_talisman',
      title: 'A Charm Against the Dark',
      desc: 'Craft a talisman and show FATHER KHATRI you can protect yourself.',
      check: (s) => s.flags.craftedTalisman || s.talismans >= 3,
      reward: { materials: { bone: 1, cloth: 1 }, flag: 'metKhatri' },
      done: ['Good. The town respects those who can ward a door.', 'Take these \u2014 to make another when this one fails.'],
    },
  },
  {
    id: 'kenny',
    name: 'KENNY',
    building: 'DINER',
    x: 850,
    y: 620,
    color: 0x6ab08a,
    intro: [
      'Diner\u2019s still standing, so we still cook. Habits are all we\u2019ve got.',
      'Scavenging\u2019s the real work now. Bones, wax, wire \u2014 it all becomes something you need at 3am.',
      'Bring me a bone charm and I\u2019ll trade you good salvage.',
    ],
    quest: {
      id: 'q_salvage',
      title: 'Good Salvage',
      desc: 'Bring KENNY 1 bone. He\u2019ll trade you wire and wax.',
      check: (s) => s.materials.bone >= 1,
      cost: { bone: 1 },
      reward: { materials: { wire: 2, wax: 2 }, flag: 'metKenny' },
      done: ['Ha \u2014 there it is. Here, wire and wax. Keep your lantern breathing.'],
    },
  },
  {
    id: 'thechild',
    name: 'THE CHILD',
    building: null,
    x: 520,
    y: 120,
    color: 0x9a9aa6,
    intro: [
      'A small figure stands at the treeline, humming a tune you almost recognize.',
      '"They sing to me from the woods. They know my name."',
      '"If you listen long enough, you\u2019ll hear yours too."',
    ],
    quest: {
      id: 'q_song',
      title: 'The Song in the Trees',
      desc: 'Find what the woods are hiding \u2014 read every piece of lore in town.',
      check: (s) => s.loreFound.length >= LORE.length,
      reward: { flag: 'heardSong', talismans: 1 },
      done: ['"Now you\u2019ve heard it all. Now you can never un-hear it."', 'The child is gone. Only the humming stays.'],
    },
  },
];

// ---------- Lore (notes, photos, radio) ----------
export const LORE = [
  {
    id: 'l_diary',
    type: 'note',
    title: 'Torn Diary Page',
    building: 'HOUSE',
    x: 640,
    y: 460,
    text: 'Day 41. We boarded the windows again. The Matthews family answered the knock on night 39. We found the door open at dawn and the house empty. There is never any blood. That is the worst part.',
  },
  {
    id: 'l_photo',
    type: 'photo',
    title: 'Faded Polaroid',
    building: 'HOUSE',
    x: 740,
    y: 400,
    text: 'A photograph of a family on a road trip, smiling beside a tour bus. Someone has scratched out the road behind them and written: "IT LOOPS. IT ALWAYS LOOPS."',
  },
  {
    id: 'l_tally',
    type: 'note',
    title: 'Tally Marks',
    building: 'CLINIC',
    x: 1000,
    y: 230,
    text: 'Scratched into the clinic wall: hundreds of tally marks counting nights survived. The last cluster is smeared, as if the hand that made them was pulled away mid-stroke.',
  },
  {
    id: 'l_radio',
    type: 'radio',
    title: 'Radio Static',
    building: 'DINER',
    x: 910,
    y: 600,
    text: 'The diner radio only finds one station. Beneath the static, a calm voice repeats: "...remain indoors... the talismans must be earned... do not trust the faces that smile after sunset..."',
  },
  {
    id: 'l_sermon',
    type: 'note',
    title: 'Half-Burned Sermon',
    building: 'CHURCH',
    x: 400,
    y: 600,
    text: 'A sermon, half consumed by fire: "...and the town is not a place but an appetite. We do not live here. We are kept here. Pray the talisman holds, for prayer alone never has."',
  },
  {
    id: 'l_drawing',
    type: 'photo',
    title: 'Child\u2019s Drawing',
    building: null,
    x: 480,
    y: 180,
    text: 'A crayon drawing pinned to a tree: stick figures with wide smiles standing around a small house. Above them, in shaky letters: "they only come inside if you let them."',
  },
];

// ---------- Material nodes (scavenge points) ----------
// kind: 'cloth' | 'bone' | 'wax' | 'wire'
export const MATERIAL_NODES = [
  { id: 'm_cloth1', kind: 'cloth', building: 'HOUSE', x: 620, y: 400 },
  { id: 'm_cloth2', kind: 'cloth', building: 'CLINIC', x: 1100, y: 240 },
  { id: 'm_cloth3', kind: 'cloth', building: 'DINER', x: 800, y: 660 },
  { id: 'm_bone1', kind: 'bone', building: 'CHURCH', x: 500, y: 680 },
  { id: 'm_bone2', kind: 'bone', building: null, x: 520, y: 90 },
  { id: 'm_wax1', kind: 'wax', building: 'CHURCH', x: 380, y: 660 },
  { id: 'm_wax2', kind: 'wax', building: 'HOUSE', x: 760, y: 470 },
  { id: 'm_wire1', kind: 'wire', building: 'DINER', x: 920, y: 560 },
  { id: 'm_wire2', kind: 'wire', building: 'CLINIC', x: 980, y: 160 },
];

// ---------- Daytime chores (tasks) ----------
// Only available while the sun is up. Each is a small station out in the town
// you walk up to and work (press G). They refresh every night, so daylight is
// for stocking the larder and the workbench before the dark comes back.
// reward: { food?: n, materials?: { kind: n } }
export const TASKS = [
  {
    id: 't_garden1',
    label: 'Vegetable Garden',
    verb: 'Harvest Vegetables',
    color: 0x6ab06a,
    x: 250,
    y: 300,
    reward: { food: 2 },
  },
  {
    id: 't_garden2',
    label: 'Vegetable Garden',
    verb: 'Harvest Vegetables',
    color: 0x6ab06a,
    x: 160,
    y: 560,
    reward: { food: 2 },
  },
  {
    id: 't_carpentry',
    label: 'Carpentry Bench',
    verb: 'Do Carpentry',
    color: 0xb0894a,
    x: 870,
    y: 420,
    reward: { materials: { wire: 1, wax: 1 } },
  },
  {
    id: 't_well',
    label: 'Water Well',
    verb: 'Draw Water',
    color: 0x5a8fb0,
    x: 600,
    y: 540,
    reward: { food: 1 },
  },
];

export const TASK_COLORS = { garden: 0x6ab06a, bench: 0xb0894a, well: 0x5a8fb0 };

// ---------- Crafting recipes ----------
export const RECIPES = [
  {
    id: 'r_talisman',
    label: 'Talisman',
    desc: 'Ward a door against the dark.',
    cost: { bone: 1, cloth: 1 },
    yields: 'talisman',
  },
  {
    id: 'r_bandage',
    label: 'Bandage',
    desc: 'Press to a wound to recover health.',
    cost: { cloth: 2 },
    yields: 'bandage',
  },
  {
    id: 'r_battery',
    label: 'Battery Cell',
    desc: 'Recharge the lantern (+45%).',
    cost: { wire: 1, wax: 1 },
    yields: 'battery',
  },
];

// ---------- Proximity helpers ----------
function nearestOf(list, px, py, range, skipIds) {
  let best = null;
  let bestD = range;
  for (const item of list) {
    if (skipIds && skipIds.includes(item.id)) continue;
    const d = Math.hypot(px - item.x, py - item.y);
    if (d <= bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

export const nearestNpc = (px, py, range = 46) => nearestOf(NPCS, px, py, range);
export const nearestLore = (px, py, foundIds, range = 40) =>
  nearestOf(LORE, px, py, range, foundIds);
export const nearestMaterial = (px, py, takenIds, range = 40) =>
  nearestOf(MATERIAL_NODES, px, py, range, takenIds);
export const nearestTask = (px, py, doneIds, range = 46) =>
  nearestOf(TASKS, px, py, range, doneIds);

export const MATERIAL_LABELS = { cloth: 'Cloth', bone: 'Bone', wax: 'Wax', wire: 'Wire' };
export const MATERIAL_COLORS = { cloth: 0xcaa15a, bone: 0xd8d2c4, wax: 0xc77f3a, wire: 0x6a8fb0 };

export { byName };
