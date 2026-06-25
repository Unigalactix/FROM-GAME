// Town layout, wall geometry, and collision helpers for the Phase 1 prototype.
// The world is a fixed-size top-down map; buildings are safe interiors you can
// enter through a single door gap. Walls are solid; streets are open.

export const WORLD = { w: 1800, h: 1200 };

// Each building has an interior rect (x, y, w, h) and one door side. `paint`
// tints the daytime walls; `roof` colours the pitched roof above it.
export const BUILDINGS = [
  { name: 'HOUSE', x: 110, y: 90, w: 180, h: 140, door: 'bottom', paint: '#9a6b4a', roof: '#3a2418' },
  { name: 'CHURCH', x: 610, y: 80, w: 230, h: 170, door: 'left', paint: '#8a8478', roof: '#2a2c30' },
  { name: 'CLINIC', x: 120, y: 360, w: 180, h: 150, door: 'right', paint: '#9aa0a2', roof: '#36302a' },
  { name: 'DINER', x: 560, y: 360, w: 250, h: 170, door: 'top', paint: '#7a8c84', roof: '#3a2a1a' },
];

// Decorative houses that fill out the rest of the town. They are solid (you
// cannot enter them) and exist mainly to make the map feel like a real,
// inhabited town. `wh` is the wall height in metres; `roof` the roof colour.
export const DECOR_HOUSES = [
  // Right-hand blocks (the expanded east side of town)
  { x: 960, y: 90, w: 140, h: 110, paint: '#8a5a44', roof: '#2a1c16', wh: 3.4 },
  { x: 1180, y: 80, w: 150, h: 120, paint: '#5a6a72', roof: '#23282c', wh: 4.2 },
  { x: 980, y: 300, w: 130, h: 120, paint: '#7d7350', roof: '#2c2616', wh: 3.2 },
  { x: 1200, y: 300, w: 140, h: 110, paint: '#566b54', roof: '#1c241c', wh: 3.8 },
  { x: 960, y: 500, w: 150, h: 120, paint: '#8a7d63', roof: '#2e271a', wh: 3.4 },
  { x: 1190, y: 520, w: 140, h: 120, paint: '#6e4a48', roof: '#241a1a', wh: 4.0 },
  { x: 880, y: 90, w: 90, h: 110, paint: '#5d5550', roof: '#222020', wh: 3.2 },
  // Bottom blocks (the expanded south side of town)
  { x: 120, y: 680, w: 150, h: 120, paint: '#5d5550', roof: '#222020', wh: 3.6 },
  { x: 340, y: 700, w: 140, h: 110, paint: '#7a6a4a', roof: '#2a2418', wh: 3.2 },
  { x: 560, y: 690, w: 150, h: 120, paint: '#5a6a72', roof: '#23282c', wh: 4.0 },
  { x: 780, y: 700, w: 150, h: 120, paint: '#8a5a44', roof: '#2a1c16', wh: 3.4 },
  { x: 1000, y: 710, w: 150, h: 120, paint: '#566b54', roof: '#1c241c', wh: 3.6 },
  { x: 1220, y: 700, w: 140, h: 120, paint: '#7d7350', roof: '#2c2616', wh: 3.8 },
  // Far southern row
  { x: 240, y: 850, w: 150, h: 90, paint: '#6e4a48', roof: '#241a1a', wh: 3.0 },
  { x: 520, y: 850, w: 160, h: 90, paint: '#8a7d63', roof: '#2e271a', wh: 3.2 },
  { x: 840, y: 850, w: 150, h: 90, paint: '#5a6a72', roof: '#23282c', wh: 3.4 },
  { x: 1120, y: 850, w: 160, h: 90, paint: '#7a6a4a', roof: '#2a2418', wh: 3.2 },
  // West edge
  { x: 20, y: 560, w: 90, h: 120, paint: '#7d7350', roof: '#2c2616', wh: 3.0 },
  // The COLONY HOUSE — the big Victorian on the edge of town where most
  // survivors shelter (the FROM landmark). Tall and unmistakable.
  { name: 'COLONY HOUSE', x: 1500, y: 130, w: 250, h: 220, paint: '#6a6e74', roof: '#262a2e', wh: 6.6 },
  // Far-east blocks (the new edge of town)
  { x: 1520, y: 400, w: 150, h: 120, paint: '#5a6a72', roof: '#23282c', wh: 3.6 },
  { x: 1540, y: 600, w: 150, h: 120, paint: '#8a7d63', roof: '#2e271a', wh: 4.0 },
  { x: 1520, y: 810, w: 150, h: 120, paint: '#6e4a48', roof: '#241a1a', wh: 3.4 },
  // New southern blocks
  { x: 160, y: 1010, w: 150, h: 110, paint: '#7a6a4a', roof: '#2a2418', wh: 3.4 },
  { x: 430, y: 1020, w: 150, h: 110, paint: '#566b54', roof: '#1c241c', wh: 3.2 },
  { x: 700, y: 1010, w: 160, h: 120, paint: '#8a5a44', roof: '#2a1c16', wh: 3.8 },
  { x: 980, y: 1020, w: 150, h: 110, paint: '#5d5550', roof: '#222020', wh: 3.4 },
  { x: 1260, y: 1010, w: 150, h: 120, paint: '#5a6a72', roof: '#23282c', wh: 3.6 },
  { x: 1530, y: 1020, w: 150, h: 110, paint: '#7d7350', roof: '#2c2616', wh: 3.2 },
];

const WALL = 10; // wall thickness
const DOOR = 58; // door gap width

// Build the four wall segments for a building, leaving a gap on the door side.
function wallsFor(b) {
  const { x, y, w, h, door } = b;
  const rects = [];

  // Top wall
  if (door === 'top') {
    const gap = x + (w - DOOR) / 2;
    rects.push({ x, y, w: gap - x, h: WALL });
    rects.push({ x: gap + DOOR, y, w: x + w - (gap + DOOR), h: WALL });
  } else {
    rects.push({ x, y, w, h: WALL });
  }

  // Bottom wall
  if (door === 'bottom') {
    const gap = x + (w - DOOR) / 2;
    rects.push({ x, y: y + h - WALL, w: gap - x, h: WALL });
    rects.push({ x: gap + DOOR, y: y + h - WALL, w: x + w - (gap + DOOR), h: WALL });
  } else {
    rects.push({ x, y: y + h - WALL, w, h: WALL });
  }

  // Left wall
  if (door === 'left') {
    const gap = y + (h - DOOR) / 2;
    rects.push({ x, y, w: WALL, h: gap - y });
    rects.push({ x, y: gap + DOOR, w: WALL, h: y + h - (gap + DOOR) });
  } else {
    rects.push({ x, y, w: WALL, h });
  }

  // Right wall
  if (door === 'right') {
    const gap = y + (h - DOOR) / 2;
    rects.push({ x: x + w - WALL, y, w: WALL, h: gap - y });
    rects.push({ x: x + w - WALL, y: gap + DOOR, w: WALL, h: y + h - (gap + DOOR) });
  } else {
    rects.push({ x: x + w - WALL, y, w: WALL, h });
  }

  // Tag each wall with the building's paint colour for the 3D view.
  return rects.map((r) => ({ ...r, paint: b.paint }));
}

// Solid collision footprints for the decorative houses (one rect each).
const decorRects = DECOR_HOUSES.map((h) => ({
  x: h.x,
  y: h.y,
  w: h.w,
  h: h.h,
  paint: h.paint,
  decor: true, // rendered by DecorTown, skipped by the Walls() mesh pass
}));

export const WALLS = [...BUILDINGS.flatMap(wallsFor), ...decorRects];

// Returns the building whose interior contains the point, or null.
export function buildingAt(px, py) {
  return (
    BUILDINGS.find(
      (b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h
    ) || null
  );
}

// Resolve a circle (player) against all walls and the world bounds.
// Pushes the circle out of any wall it overlaps. Two passes for stability.
export function resolveCollision(px, py, r) {
  let x = px;
  let y = py;

  for (let pass = 0; pass < 2; pass++) {
    for (const wl of WALLS) {
      const nx = Math.max(wl.x, Math.min(x, wl.x + wl.w));
      const ny = Math.max(wl.y, Math.min(y, wl.y + wl.h));
      const dx = x - nx;
      const dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.0001;
        const push = r - d;
        x += (dx / d) * push;
        y += (dy / d) * push;
      }
    }
  }

  x = Math.max(r, Math.min(WORLD.w - r, x));
  y = Math.max(r, Math.min(WORLD.h - r, y));
  return { x, y };
}

// ---- Doors (where talismans can be hung) ----
function doorPoint(b) {
  switch (b.door) {
    case 'top':
      return { x: b.x + b.w / 2, y: b.y };
    case 'bottom':
      return { x: b.x + b.w / 2, y: b.y + b.h };
    case 'left':
      return { x: b.x, y: b.y + b.h / 2 };
    default:
      return { x: b.x + b.w, y: b.y + b.h / 2 };
  }
}

export const DOORS = BUILDINGS.map((b) => ({ name: b.name, ...doorPoint(b) }));

// ---- Hide spots (one tucked-away point inside each building) ----
export const HIDE_SPOTS = BUILDINGS.map((b) => ({
  name: b.name,
  x: b.x + 28,
  y: b.y + 28,
}));

// ---- Proximity helpers ----
function nearest(list, px, py, range) {
  let best = null;
  let bestD = range;
  for (const item of list) {
    const d = Math.hypot(px - item.x, py - item.y);
    if (d <= bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

export const nearestDoor = (px, py, range = 42) => nearest(DOORS, px, py, range);
export const nearestHideSpot = (px, py, range = 34) => nearest(HIDE_SPOTS, px, py, range);

// ---- Line of sight (segment vs walls via Liang-Barsky clipping) ----
function segHitsRect(ax, ay, bx, by, r) {
  const dx = bx - ax;
  const dy = by - ay;
  const p = [-dx, dx, -dy, dy];
  const q = [ax - r.x, r.x + r.w - ax, ay - r.y, r.y + r.h - ay];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false; // parallel and outside slab
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

// True if nothing blocks the straight line between the two points.
export function lineClear(ax, ay, bx, by) {
  for (const w of WALLS) {
    if (segHitsRect(ax, ay, bx, by, w)) return false;
  }
  return true;
}
