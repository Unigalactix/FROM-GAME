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
