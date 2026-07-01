// Town layout, wall geometry, and collision helpers for the Phase 1 prototype.
// The world is a fixed-size top-down map; buildings are safe interiors you can
// enter through a single door gap. Walls are solid; streets are open.

export const WORLD = { w: 1200, h: 800 };

// Each building has an interior rect (x, y, w, h) and one door side. `paint`
// tints the daytime walls; `roof` colours the pitched roof above it.
// Faithful to the FROM town map: Colony House sits NW, the Clinic NE, and the
// Matthews House / Sheriff's Office / Matthew's Diner / Church cluster rings a
// central street. These four are the interiors you can actually enter.
export const BUILDINGS = [
  { name: 'CLINIC', x: 960, y: 120, w: 190, h: 150, door: 'bottom', paint: '#9aa0a2', roof: '#36302a' },
  { name: 'HOUSE', x: 600, y: 360, w: 180, h: 140, door: 'bottom', paint: '#9a6b4a', roof: '#3a2418' },
  { name: 'CHURCH', x: 360, y: 560, w: 190, h: 160, door: 'right', paint: '#8a8478', roof: '#2a2c30' },
  { name: 'DINER', x: 740, y: 550, w: 220, h: 150, door: 'top', paint: '#b0563a', roof: '#2a201a' },
];

// Decorative houses that fill out the rest of the town. They are solid (you
// cannot enter them) and exist mainly to make the map feel like a real,
// inhabited town. `wh` is the wall height in metres; `roof` the roof colour.
export const DECOR_HOUSES = [
  // The COLONY HOUSE — the big Victorian on the NW edge where most survivors
  // shelter (the FROM landmark). Tall and unmistakable.
  { name: 'COLONY HOUSE', x: 110, y: 120, w: 240, h: 200, paint: '#6a6e74', roof: '#262a2e', wh: 6.8 },
  // The Colony outbuildings
  { name: 'SHED', x: 150, y: 40, w: 70, h: 55, paint: '#5d5550', roof: '#222020', wh: 2.6 },
  { name: 'GREEN HOUSE', x: 400, y: 130, w: 120, h: 95, paint: '#566b54', roof: '#1c241c', wh: 3.4 },
  { name: 'BLUE HOUSE', x: 560, y: 160, w: 110, h: 90, paint: '#4f6a86', roof: '#1c2632', wh: 3.4 },
  { name: 'BARN', x: 820, y: 140, w: 120, h: 100, paint: '#7a3a2e', roof: '#241410', wh: 4.4 },
  // East side
  { name: 'BAR', x: 1000, y: 360, w: 120, h: 95, paint: '#7d7350', roof: '#2c2616', wh: 3.8 },
  { name: 'ROOT CELLAR', x: 420, y: 370, w: 90, h: 70, paint: '#5a5048', roof: '#221c18', wh: 2.4 },
  // Residences ringing the central street
  { name: 'GREY HOUSE', x: 200, y: 420, w: 120, h: 95, paint: '#7a7c80', roof: '#26282c', wh: 3.4 },
  { name: 'SHERIFF', x: 590, y: 560, w: 120, h: 90, paint: '#8a7d63', roof: '#2e271a', wh: 3.4 },
  { name: 'MYERS', x: 990, y: 580, w: 110, h: 90, paint: '#8a5a44', roof: '#2a1c16', wh: 3.2 },
  { name: 'LIU', x: 200, y: 600, w: 110, h: 95, paint: '#6e4a48', roof: '#241a1a', wh: 3.2 },
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

export const nearestDoor = (px, py, range = 90) => nearest(DOORS, px, py, range);
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
