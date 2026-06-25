// Procedural surface textures, generated on a <canvas> at runtime so the game
// ships with zero image assets. Each generator returns a colour map plus a
// matching grayscale bump map, so surfaces catch the flashlight with real
// relief instead of looking like flat plastic. Textures are cached per type.

import * as THREE from 'three';

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toColorTex(canvas, repeat) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

function toDataTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Scatter speckles to fake grain/gravel. Returns the same draw on a bump canvas.
function speckle(ctx, size, count, palette, sizeRange) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---- Wet asphalt / packed dirt ground ----
function buildGround() {
  const size = 256;
  const col = makeCanvas(size);
  const cx = col.getContext('2d');
  cx.fillStyle = '#0c0b0d';
  cx.fillRect(0, 0, size, size);
  // broad damp blotches
  for (let i = 0; i < 14; i++) {
    const g = cx.createRadialGradient(
      Math.random() * size,
      Math.random() * size,
      0,
      Math.random() * size,
      Math.random() * size,
      30 + Math.random() * 60
    );
    g.addColorStop(0, 'rgba(40,38,42,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, size, size);
  }
  speckle(cx, size, 1600, ['#000000', '#171519', '#23202a', '#2c2933'], [0.4, 1.4]);

  const bump = makeCanvas(size);
  const bx = bump.getContext('2d');
  bx.fillStyle = '#7a7a7a';
  bx.fillRect(0, 0, size, size);
  speckle(bx, size, 1600, ['#3a3a3a', '#555', '#9a9a9a', '#c8c8c8'], [0.4, 1.6]);

  return { map: col, bump };
}

// ---- Weathered plaster / boarded walls ----
function buildWall() {
  const size = 256;
  const col = makeCanvas(size);
  const cx = col.getContext('2d');
  cx.fillStyle = '#26221d';
  cx.fillRect(0, 0, size, size);
  // vertical water streaks
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    cx.strokeStyle = `rgba(${10 + Math.random() * 20},${8 + Math.random() * 16},${6 + Math.random() * 12},0.5)`;
    cx.lineWidth = 0.5 + Math.random() * 2;
    cx.beginPath();
    cx.moveTo(x, Math.random() * size * 0.3);
    cx.lineTo(x + (Math.random() - 0.5) * 6, size);
    cx.stroke();
  }
  speckle(cx, size, 700, ['#1c1813', '#2e2820', '#15110c', '#332c22'], [0.5, 2]);

  const bump = makeCanvas(size);
  const bx = bump.getContext('2d');
  bx.fillStyle = '#888';
  bx.fillRect(0, 0, size, size);
  // faint horizontal board seams
  bx.strokeStyle = '#2a2a2a';
  bx.lineWidth = 2;
  for (let y = 14; y < size; y += 28 + Math.random() * 8) {
    bx.beginPath();
    bx.moveTo(0, y);
    bx.lineTo(size, y + (Math.random() - 0.5) * 4);
    bx.stroke();
  }
  speckle(bx, size, 700, ['#555', '#aaa', '#cfcfcf'], [0.5, 2.2]);

  return { map: col, bump };
}

// ---- Rough timber floorboards (building interiors) ----
function buildFloor() {
  const size = 256;
  const col = makeCanvas(size);
  const cx = col.getContext('2d');
  cx.fillStyle = '#18130f';
  cx.fillRect(0, 0, size, size);
  const plank = size / 6;
  for (let i = 0; i < 6; i++) {
    const shade = 14 + ((i * 37) % 18);
    cx.fillStyle = `rgb(${shade + 8},${shade + 2},${shade - 2})`;
    cx.fillRect(0, i * plank, size, plank - 1);
    cx.strokeStyle = 'rgba(0,0,0,0.6)';
    cx.lineWidth = 1.5;
    cx.strokeRect(0, i * plank, size, plank);
  }
  speckle(cx, size, 500, ['#0e0a07', '#221b13', '#12100c'], [0.4, 1.6]);

  const bump = makeCanvas(size);
  const bx = bump.getContext('2d');
  bx.fillStyle = '#9a9a9a';
  bx.fillRect(0, 0, size, size);
  bx.strokeStyle = '#222';
  bx.lineWidth = 2;
  for (let i = 0; i <= 6; i++) {
    bx.beginPath();
    bx.moveTo(0, i * plank);
    bx.lineTo(size, i * plank);
    bx.stroke();
  }
  speckle(bx, size, 500, ['#666', '#bcbcbc'], [0.4, 1.8]);

  return { map: col, bump };
}

let _cache = null;
function ensure() {
  if (_cache) return _cache;
  const ground = buildGround();
  const wall = buildWall();
  const floor = buildFloor();
  _cache = { ground, wall, floor };
  return _cache;
}

// Public: get a colour + bump texture pair for a given surface, tiled to fit
// its world size (so detail stays a consistent real-world scale).
export function surface(kind, repeatX = 1, repeatY = repeatX) {
  const src = ensure()[kind];
  const map = toColorTex(src.map, 1);
  const bumpMap = toDataTex(src.bump);
  map.repeat.set(repeatX, repeatY);
  bumpMap.repeat.set(repeatX, repeatY);
  return { map, bumpMap };
}
