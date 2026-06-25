// Town layout, wall geometry, and collision helpers for the Phase 1 prototype.
// The world is a fixed-size top-down map; buildings are safe interiors you can
// enter through a single door gap. Walls are solid; streets are open.

export const WORLD = { w: 960, h: 600 };

// Each building has an interior rect (x, y, w, h) and one door side.
export const BUILDINGS = [
  { name: 'HOUSE', x: 110, y: 90, w: 180, h: 140, door: 'bottom' },
  { name: 'CHURCH', x: 610, y: 80, w: 230, h: 170, door: 'left' },
  { name: 'CLINIC', x: 120, y: 360, w: 180, h: 150, door: 'right' },
  { name: 'DINER', x: 560, y: 360, w: 250, h: 170, door: 'top' },
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

  return rects;
}

export const WALLS = BUILDINGS.flatMap(wallsFor);

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
