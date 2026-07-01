// First-person 3D view (Phase 3). Renders the same town the 2D prototype
// simulates, but from inside the survivor's eyes. The world's top-down (x, y)
// maps onto the 3D ground plane as (x, z); everything is driven by the shared
// `advance()` simulation so the AI, fear, and stealth rules are unchanged.

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, getPhaseInfo, dayLight, PLAYER_START } from '../store.js';
import { WORLD, BUILDINGS, WALLS, HIDE_SPOTS, DECOR_HOUSES, DOORS } from '../systems/town.js';
import { ENEMY_R } from '../systems/enemies.js';
import { advance } from '../systems/sim.js';
import {
  NPCS,
  LORE,
  MATERIAL_NODES,
  MATERIAL_COLORS,
  TASKS,
  PORTAL_TREES,
  PORTAL_RADIUS,
  randomTeleportTarget,
  nearestNpc,
  nearestLore,
  nearestMaterial,
  nearestTask,
} from '../systems/world.js';
import {
  initAudio,
  startAmbient,
  updateTension,
  footstep,
  stinger,
  knock,
} from '../systems/audio.js';
import { surface } from '../systems/textures.js';

const S = 0.06; // world-units -> meters
const WALL_H = 3.2; // wall height (m)
const EYE = 1.7; // standing eye height (m)
const CROUCH_EYE = 0.85; // eye height while hidden
const BATTERY_DRAIN = 1.6; // %/s while lantern is on
const JUMP_V = 4.2; // initial jump velocity (m/s)
const GRAVITY = 12; // m/s^2

const wx = (x) => x * S;
const wz = (y) => y * S;

// Shared, mutable transform + animation state written by the Player controller
// and read by the third-person avatar each frame (no React re-renders).
const avatar = {
  x: PLAYER_START.x,
  z: PLAYER_START.y,
  yaw: -Math.PI / 2,
  yOff: 0, // vertical offset from a jump
  vy: 0, // vertical velocity
  phase: 0, // gait phase for limb swing
  speed: 0, // 0..1 movement magnitude
  running: false,
  grounded: true,
  hidden: false,
  mode: 'fpp',
  status: 'playing',
  dead: 0, // collapse progress 0..1
};

// ---------- World geometry ----------
function Ground() {
  const { map, bumpMap } = useMemo(
    () => surface('ground', wx(WORLD.w) / 3, wz(WORLD.h) / 3),
    []
  );
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[wx(WORLD.w / 2), 0, wz(WORLD.h / 2)]} receiveShadow>
      <planeGeometry args={[wx(WORLD.w), wz(WORLD.h)]} />
      <meshStandardMaterial map={map} bumpMap={bumpMap} bumpScale={0.04} roughness={1} />
    </mesh>
  );
}

function Walls() {
  const cache = useMemo(() => new Map(), []);
  // The painted plaster reads as colour by day and is swallowed by night.
  const matFor = (w) => {
    const rx = Math.max(1, Math.round(wx(Math.max(w.w, w.h)) / 2));
    const ry = Math.max(1, Math.round(WALL_H / 2));
    const paint = w.paint || '#9a8c78';
    const key = `${rx}x${ry}|${paint}`;
    let m = cache.get(key);
    if (!m) {
      const { bumpMap } = surface('wall', rx, ry);
      m = new THREE.MeshStandardMaterial({ color: paint, bumpMap, bumpScale: 0.06, roughness: 0.9 });
      cache.set(key, m);
    }
    return m;
  };
  const solid = WALLS.filter((w) => !w.decor);
  return (
    <group>
      {solid.map((w, i) => (
        <mesh
          key={i}
          position={[wx(w.x + w.w / 2), WALL_H / 2, wz(w.y + w.h / 2)]}
          material={matFor(w)}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wx(w.w), WALL_H, wz(w.h)]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Pitched roofs + decorative town houses ----------
function Roof({ cx, cz, w, d, base, color }) {
  const sx = (wx(w) / 2) * 1.485; // π/4-rotated square reaches the wall plane (+ eaves)
  const sz = (wz(d) / 2) * 1.485;
  const roofH = Math.max(0.8, Math.min(1.9, Math.min(wx(w), wz(d)) * 0.45));
  return (
    <mesh
      position={[cx, base + roofH / 2, cz]}
      rotation={[0, Math.PI / 4, 0]}
      scale={[sx, roofH, sz]}
      castShadow
      receiveShadow
    >
      <coneGeometry args={[1, 1, 4]} />
      <meshStandardMaterial color={color} roughness={0.85} flatShading />
    </mesh>
  );
}

// Roofs over the four enterable buildings.
function Roofs() {
  return (
    <group>
      {BUILDINGS.map((b) => (
        <Roof
          key={b.name}
          cx={wx(b.x + b.w / 2)}
          cz={wz(b.y + b.h / 2)}
          w={b.w}
          d={b.h}
          base={WALL_H}
          color={b.roof}
        />
      ))}
    </group>
  );
}

// The solid, colourful background houses that fill out the rest of the town.
function DecorTown() {
  const bump = useMemo(() => surface('wall', 2, 2).bumpMap, []);
  const mats = useMemo(() => new Map(), []);
  const matFor = (paint) => {
    let m = mats.get(paint);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: paint, bumpMap: bump, bumpScale: 0.05, roughness: 0.9 });
      mats.set(paint, m);
    }
    return m;
  };
  return (
    <group>
      {DECOR_HOUSES.map((h, i) => {
        const cx = wx(h.x + h.w / 2);
        const cz = wz(h.y + h.h / 2);
        return (
          <group key={i}>
            <mesh position={[cx, h.wh / 2, cz]} material={matFor(h.paint)} castShadow receiveShadow>
              <boxGeometry args={[wx(h.w), h.wh, wz(h.h)]} />
            </mesh>
            <Roof cx={cx} cz={cz} w={h.w} d={h.h} base={h.wh} color={h.roof} />
          </group>
        );
      })}
    </group>
  );
}

// ---------- Doors & windows on every house ----------
// Each building gets a solid door slab in its opening plus framed windows whose
// glass glows warm once the sun goes down, so the town reads as inhabited — and
// so you can see the shapes that come to knock, silhouetted at the panes.
function buildFacades() {
  const doors = [];
  const windows = [];

  const pushWindow = (pos, horizontal, wh) => {
    const winH = Math.min(1.2, Math.max(0.8, wh * 0.42));
    const len = wx(38);
    if (horizontal) {
      windows.push({ pos, frame: [len + 0.16, winH + 0.16, 0.09], glass: [len, winH, 0.2] });
    } else {
      windows.push({ pos, frame: [0.09, winH + 0.16, wz(38) + 0.16], glass: [0.2, winH, wz(38)] });
    }
  };

  const addRect = (b, wh, doorSide) => {
    const { x, y, w, h } = b;
    const yc = Math.max(1.5, wh * 0.5);
    const cx = wx(x + w / 2);
    const cz = wz(y + h / 2);

    // Windows along the top & bottom walls (offset from the door in the centre).
    for (const fx of [0.26, 0.74]) {
      const px = wx(x + w * fx);
      pushWindow([px, yc, wz(y)], true, wh);
      pushWindow([px, yc, wz(y + h)], true, wh);
    }
    // Windows along the left & right walls.
    for (const fy of [0.32, 0.68]) {
      const pz = wz(y + h * fy);
      pushWindow([wx(x), yc, pz], false, wh);
      pushWindow([wx(x + w), yc, pz], false, wh);
    }

    // Door slab in the opening (decor houses get a decorative one facing south).
    const doorH = Math.min(2.2, wh * 0.72);
    const doorW = wx(50);
    if (doorSide === 'top') doors.push({ pos: [cx, doorH / 2, wz(y)], size: [doorW, doorH, 0.14] });
    else if (doorSide === 'bottom') doors.push({ pos: [cx, doorH / 2, wz(y + h)], size: [doorW, doorH, 0.14] });
    else if (doorSide === 'left') doors.push({ pos: [wx(x), doorH / 2, cz], size: [0.14, doorH, wz(50)] });
    else if (doorSide === 'right') doors.push({ pos: [wx(x + w), doorH / 2, cz], size: [0.14, doorH, wz(50)] });
    else doors.push({ pos: [cx, doorH / 2, wz(y + h)], size: [doorW, doorH, 0.14] });
  };

  for (const b of BUILDINGS) addRect(b, WALL_H, b.door);
  for (const h of DECOR_HOUSES) addRect(h, h.wh, null);

  return { doors, windows };
}

function Facades() {
  const winMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x0e1116,
        emissive: 0xffb867,
        emissiveIntensity: 0,
        roughness: 0.25,
        metalness: 0.0,
      }),
    []
  );
  const frameMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.85 }),
    []
  );
  const doorMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0x3a281a, roughness: 0.7, metalness: 0.08 }),
    []
  );
  const { doors, windows } = useMemo(buildFacades, []);
  const glassRef = useRef();
  const frameRef = useRef();
  const doorRef = useRef();

  useEffect(() => {
    const d = new THREE.Object3D();
    const write = (mesh, items, sizeKey) => {
      if (!mesh) return;
      items.forEach((it, i) => {
        d.position.set(it.pos[0], it.pos[1], it.pos[2]);
        const s = it[sizeKey];
        d.scale.set(s[0], s[1], s[2]);
        d.rotation.set(0, 0, 0);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    write(frameRef.current, windows, 'frame');
    write(glassRef.current, windows, 'glass');
    write(doorRef.current, doors, 'size');
  }, [doors, windows]);

  // Windows glow warm as daylight fades, with a faint candle flicker.
  useFrame(() => {
    const light = dayLight(useGameStore.getState().time);
    const glow = Math.max(0, 1 - light * 1.15);
    winMat.emissiveIntensity = glow * (1.5 + Math.sin(performance.now() * 0.004) * 0.15);
  });

  return (
    <group>
      <instancedMesh
        ref={frameRef}
        args={[undefined, undefined, windows.length]}
        material={frameMat}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh
        ref={glassRef}
        args={[undefined, undefined, windows.length]}
        material={winMat}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
      <instancedMesh
        ref={doorRef}
        args={[undefined, undefined, doors.length]}
        material={doorMat}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}

function BuildingFloors() {
  const cache = useMemo(() => new Map(), []);
  const matFor = (b) => {
    const rx = Math.max(1, Math.round(wx(b.w) / 2.5));
    const ry = Math.max(1, Math.round(wz(b.h) / 2.5));
    const key = `${rx}x${ry}`;
    let m = cache.get(key);
    if (!m) {
      const { map, bumpMap } = surface('floor', rx, ry);
      m = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 0.06, roughness: 0.9 });
      cache.set(key, m);
    }
    return m;
  };
  return (
    <group>
      {BUILDINGS.map((b) => (
        <mesh
          key={b.name}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[wx(b.x + b.w / 2), 0.02, wz(b.y + b.h / 2)]}
          material={matFor(b)}
          receiveShadow
        >
          <planeGeometry args={[wx(b.w), wz(b.h)]} />
        </mesh>
      ))}
    </group>
  );
}

// A simple crate marking each hide spot.
function HideSpots() {
  const mat = useMemo(() => {
    const { map, bumpMap } = surface('floor', 1, 1);
    return new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: 0.05, roughness: 1 });
  }, []);
  return (
    <group>
      {HIDE_SPOTS.map((h) => (
        <mesh key={h.name} position={[wx(h.x), 0.4, wz(h.y)]} material={mat} castShadow receiveShadow>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Enemies ----------
function Enemies() {
  const group = useRef();
  const pool = useRef([]);

  useFrame(() => {
    const enemies = useGameStore.getState().enemies;
    const g = group.current;
    if (!g) return;

    // Grow the pool of meshes to match enemy count.
    while (pool.current.length < enemies.length) {
      const node = makeFigure();
      g.add(node.root);
      pool.current.push(node);
    }
    // Show/position active enemies, hide the rest.
    for (let i = 0; i < pool.current.length; i++) {
      const node = pool.current[i];
      const e = enemies[i];
      if (!e) {
        node.root.visible = false;
        continue;
      }
      node.root.visible = true;
      node.root.position.set(wx(e.x), 0, wz(e.y));
      // Face roughly toward their target/heading.
      const angle = Math.atan2(e.tx - e.x, e.ty - e.y);
      node.root.rotation.y = angle;
      const chasing = e.state === 'chase';
      const knocking = e.state === 'knock';
      const eyeColor = chasing ? 0xb81717 : 0x9c5a1f;
      node.lEye.material.color.setHex(eyeColor);
      node.rEye.material.color.setHex(eyeColor);
      const flick = chasing ? 1.2 + Math.sin(performance.now() * 0.02) * 0.4 : 0.5;
      node.lEye.material.emissiveIntensity = flick;
      node.rEye.material.emissiveIntensity = flick;

      // The grin: scale the mouth with the enemy's smile value.
      const grin = e.smile || 0;
      node.mouth.visible = grin > 0.04;
      node.mouth.scale.set(0.5 + grin * 1.0, 0.55 + grin * 0.7, 1);

      // Idle head tilt — a slow, wrong lean; sharper while knocking.
      const now = performance.now();
      node.head.rotation.z = knocking
        ? Math.sin(now * 0.006) * 0.38
        : chasing
        ? 0
        : Math.sin(now * 0.0016 + e.id) * 0.14;

      // Knocking: rap the raised arm on the door and play the sound on each beat.
      if (knocking) {
        const period = 0.46; // seconds per knock
        const bi = Math.floor(e.knockBeat / period);
        const phase = (e.knockBeat % period) / period;
        const tap = Math.sin(Math.min(1, phase * 2) * Math.PI); // quick forward tap
        node.rArm.rotation.x = -1.5 - tap * 0.6;
        if (bi !== node.lastKnock) {
          node.lastKnock = bi;
          const pl = useGameStore.getState().player;
          const dd = Math.hypot(pl.x - e.x, pl.y - e.y);
          const vol = Math.max(0, Math.min(1, (400 - dd) / 400));
          if (vol > 0.05) knock(vol);
        }
      } else {
        node.lastKnock = -1;
        // Chasing: arms reach forward; otherwise relax to hanging.
        const rest = chasing ? -1.1 : 0;
        node.rArm.rotation.x += (rest - node.rArm.rotation.x) * 0.12;
      }
    }
  });

  return <group ref={group} />;
}

function makeFigure() {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 1 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.5, 10), bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  root.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), bodyMat);
  head.position.y = 1.85;
  head.castShadow = true;
  root.add(head);

  // Left arm — long and gaunt, hanging at unnatural length.
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 1.2, 6), bodyMat);
  lArm.position.set(-0.3, 0.95, 0.02);
  lArm.rotation.z = -0.1;
  lArm.castShadow = true;
  root.add(lArm);

  // Right arm — pivots at the shoulder so it can be raised to knock.
  const rArm = new THREE.Group();
  rArm.position.set(0.3, 1.5, 0.04);
  const rArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 1.2, 6), bodyMat);
  rArmMesh.position.y = -0.55;
  rArmMesh.castShadow = true;
  rArm.add(rArmMesh);
  root.add(rArm);

  const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const mkEye = () =>
    new THREE.Mesh(
      eyeGeo,
      new THREE.MeshStandardMaterial({ color: 0x9c5a1f, emissive: 0x9c5a1f, emissiveIntensity: 0.6 })
    );
  const lEye = mkEye();
  const rEye = mkEye();
  lEye.position.set(-0.09, 1.88, 0.22);
  rEye.position.set(0.09, 1.88, 0.22);
  root.add(lEye, rEye);

  // The smile — a too-wide pale grin carved across the face.
  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.028, 6, 16, Math.PI),
    new THREE.MeshStandardMaterial({
      color: 0xf3ede2,
      emissive: 0x6a2a20,
      emissiveIntensity: 0.25,
      roughness: 0.6,
    })
  );
  mouth.position.set(0, 1.78, 0.235);
  mouth.rotation.z = Math.PI; // flip the arc into an upturned grin
  mouth.visible = false;
  root.add(mouth);

  return { root, head, lEye, rEye, rArm, mouth, lastKnock: -1 };
}

// ---------- Talisman wards ----------
function Wards() {
  const group = useRef();
  const pool = useRef([]);

  useFrame(() => {
    const wards = useGameStore.getState().wards;
    const g = group.current;
    if (!g) return;
    while (pool.current.length < wards.length) {
      const node = makeWard();
      g.add(node);
      pool.current.push(node);
    }
    for (let i = 0; i < pool.current.length; i++) {
      const node = pool.current[i];
      const w = wards[i];
      if (!w) {
        node.visible = false;
        continue;
      }
      node.visible = true;
      node.position.set(wx(w.x), 1.4, wz(w.y));
      node.rotation.y += 0.01;
    }
  });

  return <group ref={group} />;
}

function makeWard() {
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb06a2c,
    emissive: 0xb06a2c,
    emissiveIntensity: 1.4,
  });
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), mat);
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06), mat);
  h.position.y = 0.12;
  root.add(v, h);
  const light = new THREE.PointLight(0xb06a2c, 2.2, 6, 2);
  root.add(light);
  return root;
}

// ---------- Lighting / atmosphere (imperative, no per-frame React re-render) ----------
function Atmosphere() {
  const { scene } = useThree();
  const ambient = useRef();
  const hemi = useRef();
  const sun = useRef();

  // Reusable colour scratch values so we don't allocate every frame.
  const nightSky = useMemo(() => new THREE.Color('#05040a'), []);
  const daySky = useMemo(() => new THREE.Color('#6b7682'), []); // overcast, desaturated
  const skyTmp = useMemo(() => new THREE.Color(), []);
  const nightFog = useMemo(() => new THREE.Color('#05040a'), []);
  const dayFog = useMemo(() => new THREE.Color('#7a828c'), []);
  const fogTmp = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    scene.fog = new THREE.FogExp2(0x05040a, 0.012);
    // Aim the sun/moon shadow at the town centre so cast shadows cover it.
    if (sun.current) {
      sun.current.target.position.set(wx(WORLD.w / 2), 0, wz(WORLD.h / 2));
      scene.add(sun.current.target);
    }
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame(() => {
    const { time } = useGameStore.getState();
    const { phase, phaseTimeLeft } = getPhaseInfo(time);
    const light = dayLight(time); // 0..1 continuous

    // Ambient + sun scale directly with daylight so you can see the town by day
    // and lose it gradually as the sun goes down.
    if (ambient.current) ambient.current.intensity = 0.06 + light * 1.25;
    if (hemi.current) hemi.current.intensity = 0.12 + light * 0.7;
    if (sun.current) {
      sun.current.intensity = light * 1.1;
      // Warm midday -> cold pale moon at night.
      sun.current.color.setHSL(0.6 - light * 0.5, 0.25, 0.6);
    }

    // Sky + fog colour blend from deep night to a flat, overcast day.
    skyTmp.copy(nightSky).lerp(daySky, light);
    if (scene.background && scene.background.isColor) scene.background.copy(skyTmp);
    if (scene.fog) {
      fogTmp.copy(nightFog).lerp(dayFog, light);
      scene.fog.color.copy(fogTmp);
      scene.fog.density = 0.012 + (1 - light) * 0.05; // thicker, blinding fog at night
      // Eerie sunset throb as night approaches.
      if (phase === 'DUSK') {
        const v = 0.04 + Math.sin(phaseTimeLeft * 3) * 0.012;
        scene.fog.color.offsetHSL(0, 0.1, v - 0.04);
      }
    }
  });

  return (
    <>
      <ambientLight ref={ambient} intensity={0.6} color="#9aa0ac" />
      <hemisphereLight ref={hemi} args={[0x9fb2c4, 0x2a2620, 0.4]} />
      <directionalLight
        ref={sun}
        position={[wx(WORLD.w * 0.7), 60, wz(WORLD.h * 0.2)]}
        intensity={0.6}
        color="#cdd2da"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
    </>
  );
}

// ---------- Flashlight attached to the camera ----------
function Flashlight() {
  const { camera, scene } = useThree();
  const spot = useRef();
  const target = useRef(new THREE.Object3D());

  useEffect(() => {
    scene.add(target.current);
    return () => {
      scene.remove(target.current);
    };
  }, [scene]);

  useFrame(() => {
    const { lanternOn, battery } = useGameStore.getState();
    const s = spot.current;
    if (!s) return;
    const on = lanternOn && battery > 0;
    s.intensity = on ? 6 : 0;
    s.position.copy(camera.position);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    target.current.position.copy(camera.position).add(dir.multiplyScalar(8));
    s.target = target.current;
  });

  return (
    <spotLight
      ref={spot}
      angle={0.62}
      penumbra={0.5}
      distance={16}
      decay={1.4}
      color="#ffd9a0"
      intensity={6}
    />
  );
}

// ---------- Survivors, lore, materials, forest (Phase 4) ----------
const NPC_SKIN = '#c79c76';
const NPC_HAIR = '#241a14';
const NPC_PANTS = '#2c2824';
const NPC_BOOT = '#15110d';

// A townsperson rendered as a real, clothed human: jacket (their signature
// colour), trousers, boots, hands, head and hair, lit by their own candle.
function NpcFigure({ n }) {
  const jacket = n.color;
  return (
    <group position={[wx(n.x), 0, wz(n.y)]} rotation={[0, n.face ?? 0, 0]}>
      {/* legs + boots */}
      <mesh position={[-0.12, 0.38, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.5, 4, 8]} />
        <meshStandardMaterial color={NPC_PANTS} roughness={1} />
      </mesh>
      <mesh position={[0.12, 0.38, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.5, 4, 8]} />
        <meshStandardMaterial color={NPC_PANTS} roughness={1} />
      </mesh>
      <mesh position={[-0.12, 0.06, 0.05]} castShadow>
        <boxGeometry args={[0.16, 0.12, 0.26]} />
        <meshStandardMaterial color={NPC_BOOT} roughness={1} />
      </mesh>
      <mesh position={[0.12, 0.06, 0.05]} castShadow>
        <boxGeometry args={[0.16, 0.12, 0.26]} />
        <meshStandardMaterial color={NPC_BOOT} roughness={1} />
      </mesh>
      {/* torso jacket */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.22, 0.6, 4, 12]} />
        <meshStandardMaterial color={jacket} roughness={0.85} />
      </mesh>
      {/* arms + hands */}
      <mesh position={[-0.3, 1.05, 0]} rotation={[0, 0, 0.08]} castShadow>
        <capsuleGeometry args={[0.08, 0.6, 4, 8]} />
        <meshStandardMaterial color={jacket} roughness={0.9} />
      </mesh>
      <mesh position={[0.3, 1.05, 0]} rotation={[0, 0, -0.08]} castShadow>
        <capsuleGeometry args={[0.08, 0.6, 4, 8]} />
        <meshStandardMaterial color={jacket} roughness={0.9} />
      </mesh>
      <mesh position={[-0.34, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color={NPC_SKIN} roughness={0.9} />
      </mesh>
      <mesh position={[0.34, 0.72, 0]} castShadow>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshStandardMaterial color={NPC_SKIN} roughness={0.9} />
      </mesh>
      {/* head + hair */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={NPC_SKIN} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.7, -0.02]} castShadow>
        <sphereGeometry args={[0.19, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color={NPC_HAIR} roughness={1} />
      </mesh>
      {/* survivors keep a candle burning so you can find them */}
      <pointLight position={[0, 1.95, 0]} color="#ffcf8a" intensity={0.75} distance={5} decay={2} />
    </group>
  );
}

function Survivors() {
  return (
    <group>
      {NPCS.map((n) => (
        <NpcFigure key={n.id} n={n} />
      ))}
    </group>
  );
}

function Spinner({ position, baseY = 1, speed = 1.5, children }) {
  const ref = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * speed;
    ref.current.position.y = baseY + Math.sin(performance.now() * 0.002) * 0.08;
  });
  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

function LorePickups() {
  const loreFound = useGameStore((s) => s.loreFound);
  return (
    <group>
      {LORE.filter((l) => !loreFound.includes(l.id)).map((l) => (
        <Spinner key={l.id} position={[wx(l.x), 1, wz(l.y)]} baseY={1}>
          <mesh castShadow>
            <boxGeometry args={[0.28, 0.38, 0.04]} />
            <meshStandardMaterial color="#c98a3c" emissive="#b06a2c" emissiveIntensity={0.9} />
          </mesh>
          <pointLight color="#b06a2c" intensity={0.5} distance={3} decay={2} />
        </Spinner>
      ))}
    </group>
  );
}

function MaterialPickups() {
  const taken = useGameStore((s) => s.materialsTaken);
  return (
    <group>
      {MATERIAL_NODES.filter((n) => !taken.includes(n.id)).map((n) => {
        const c = MATERIAL_COLORS[n.kind];
        return (
          <Spinner key={n.id} position={[wx(n.x), 0.6, wz(n.y)]} baseY={0.6} speed={2.2}>
            <mesh castShadow>
              <icosahedronGeometry args={[0.16, 0]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.4} roughness={0.6} />
            </mesh>
          </Spinner>
        );
      })}
    </group>
  );
}

// ---------- Daytime chore stations (Phase 5 world) ----------
function Tasks() {
  const tasksDone = useGameStore((s) => s.tasksDone);
  return (
    <group>
      {TASKS.map((t) => {
        const done = tasksDone.includes(t.id);
        return (
          <group key={t.id} position={[wx(t.x), 0, wz(t.y)]}>
            {/* a low worked plot / bench / well-head */}
            <mesh position={[0, 0.18, 0]} castShadow receiveShadow>
              <boxGeometry args={[1.1, 0.36, 1.1]} />
              <meshStandardMaterial color={t.color} roughness={0.95} />
            </mesh>
            {!done && (
              <Spinner position={[0, 0.95, 0]} baseY={0.95} speed={1.6}>
                <mesh>
                  <octahedronGeometry args={[0.16, 0]} />
                  <meshStandardMaterial color={t.color} emissive={t.color} emissiveIntensity={0.7} />
                </mesh>
              </Spinner>
            )}
          </group>
        );
      })}
    </group>
  );
}

function Forest() {
  const quality = useGameStore((s) => s.settings.quality);
  const trees = useMemo(() => {
    const count = { low: 22, medium: 42, high: 64 }[quality] || 64;
    const arr = [];
    const R = Math.random;
    for (let i = 0; i < count; i++) {
      let x;
      let y;
      const side = Math.floor(R() * 4);
      if (side === 0) {
        x = R() * WORLD.w;
        y = -30 - R() * 140;
      } else if (side === 1) {
        x = WORLD.w + 30 + R() * 140;
        y = R() * WORLD.h;
      } else if (side === 2) {
        x = R() * WORLD.w;
        y = WORLD.h + 30 + R() * 140;
      } else {
        x = -30 - R() * 140;
        y = R() * WORLD.h;
      }
      arr.push({ x, y, h: 2.4 + R() * 2.4, rot: R() * Math.PI * 2, lean: (R() - 0.5) * 0.16, kind: R(), ci: Math.floor(R() * 4) });
    }
    return arr;
  }, [quality]);
  const greens = ['#3f5a2a', '#4a6b30', '#557a30', '#3a5326'];
  const autumn = ['#8a5a22', '#9a6a26', '#a85f24', '#7a4a1f'];
  return (
    <group>
      {trees.map((t, i) => {
        const decid = t.kind > 0.58;
        const fol = (decid ? autumn : greens)[t.ci];
        const trunk = decid ? '#4a3624' : '#33271a';
        return (
          <group key={i} position={[wx(t.x), 0, wz(t.y)]} rotation={[t.lean, t.rot, t.lean]}>
            <mesh position={[0, t.h * 0.25, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.2, t.h * 0.5, 6]} />
              <meshStandardMaterial color={trunk} roughness={1} />
            </mesh>
            {decid ? (
              <mesh position={[0, t.h * 0.72, 0]} castShadow>
                <sphereGeometry args={[t.h * 0.42, 10, 8]} />
                <meshStandardMaterial color={fol} roughness={1} flatShading />
              </mesh>
            ) : (
              <mesh position={[0, t.h * 0.7, 0]} castShadow>
                <coneGeometry args={[0.85, t.h, 7]} />
                <meshStandardMaterial color={fol} roughness={1} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ---------- The trees that fold the road (teleporters) ----------
const PORTAL_COLOR = '#3fb0a4'; // eerie phosphor teal
function PortalTree({ p, idx }) {
  const glow = useRef();
  const ring = useRef();
  const light = useRef();
  useFrame(() => {
    const t = performance.now() * 0.001 + idx * 1.7;
    const pulse = 0.5 + Math.sin(t * 1.6) * 0.5; // 0..1
    if (glow.current) glow.current.emissiveIntensity = 0.8 + pulse * 2.2;
    if (light.current) light.current.intensity = 0.5 + pulse * 1.3;
    if (ring.current) {
      ring.current.rotation.z += 0.012;
      ring.current.material.opacity = 0.22 + pulse * 0.5;
    }
  });
  return (
    <group position={[wx(p.x), 0, wz(p.y)]}>
      {/* glowing sigil ring scribed on the ground — marks the threshold */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.7, 1.05, 32]} />
        <meshBasicMaterial color={PORTAL_COLOR} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* gnarled, leaning trunk */}
      <mesh position={[0, 1.3, 0]} rotation={[0, 0, 0.06]} castShadow>
        <cylinderGeometry args={[0.17, 0.36, 2.6, 7]} />
        <meshStandardMaterial color="#160f0a" roughness={1} flatShading />
      </mesh>
      <mesh position={[0.16, 2.5, 0]} rotation={[0, 0, -0.5]} castShadow>
        <cylinderGeometry args={[0.08, 0.16, 1.3, 6]} />
        <meshStandardMaterial color="#160f0a" roughness={1} />
      </mesh>
      {/* carved glowing band around the trunk */}
      <mesh ref={glow} position={[0, 1.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.33, 0.07, 8, 24]} />
        <meshStandardMaterial
          color={PORTAL_COLOR}
          emissive={PORTAL_COLOR}
          emissiveIntensity={1.6}
          toneMapped={false}
          roughness={0.5}
        />
      </mesh>
      {/* twisted, near-black canopy */}
      <mesh position={[0, 3.3, 0]} castShadow>
        <sphereGeometry args={[1.05, 10, 8]} />
        <meshStandardMaterial color="#0c150f" roughness={1} flatShading />
      </mesh>
      <pointLight ref={light} position={[0, 1.7, 0]} color={PORTAL_COLOR} intensity={0.9} distance={7} decay={2} />
    </group>
  );
}

function PortalTrees() {
  return (
    <group>
      {PORTAL_TREES.map((p, i) => (
        <PortalTree key={p.id} p={p} idx={i} />
      ))}
    </group>
  );
}

// ---------- FROM landmarks: the diner sign, the bus, the ambulance, the jam ----------
function makeSignTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1410';
  x.fillRect(0, 0, 256, 128);
  x.strokeStyle = '#d83a2a';
  x.lineWidth = 9;
  x.strokeRect(7, 7, 242, 114);
  x.fillStyle = '#f4ead2';
  x.font = 'bold 56px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('DINER', 128, 52);
  x.fillStyle = '#e0a83a';
  x.font = '18px Georgia, serif';
  x.fillText('\u2605  GOOD EATS  \u2605', 128, 98);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A tall roadside sign in front of the diner, glowing faintly like old neon.
function DinerSign() {
  const tex = useMemo(() => makeSignTexture(), []);
  return (
    <group position={[wx(760), 0, wz(530)]}>
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 2.6, 8]} />
        <meshStandardMaterial color="#23201b" roughness={1} />
      </mesh>
      <mesh position={[0, 2.85, 0]} castShadow>
        <boxGeometry args={[2.0, 1.0, 0.12]} />
        <meshStandardMaterial
          map={tex}
          emissiveMap={tex}
          emissive="#ffffff"
          emissiveIntensity={0.65}
          roughness={0.7}
        />
      </mesh>
      <pointLight position={[0, 2.85, 0.8]} color="#ffd9a0" intensity={0.5} distance={5} decay={2} />
    </group>
  );
}

// Four wheels for a vehicle whose body length runs along the X axis.
function WheelsX({ halfLen = 1.8, halfWid = 1.0, r = 0.34, y = 0.35 }) {
  const spots = [
    [-halfLen, y, halfWid],
    [halfLen, y, halfWid],
    [-halfLen, y, -halfWid],
    [halfLen, y, -halfWid],
  ];
  return (
    <group>
      {spots.map((p, i) => (
        <mesh key={i} position={p} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[r, r, 0.26, 12]} />
          <meshStandardMaterial color="#0c0c0e" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// A single car. Body length runs along Z; the front (headlights) faces -Z.
function Car({ color = '#7a2a26' }) {
  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.7, 4.0]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.05, -0.2]} castShadow>
        <boxGeometry args={[1.6, 0.6, 2.0]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.06, -0.2]}>
        <boxGeometry args={[1.64, 0.5, 2.04]} />
        <meshStandardMaterial color="#10141a" roughness={0.2} metalness={0.6} />
      </mesh>
      {/* headlights (front = -Z) */}
      {[-0.6, 0.6].map((hx) => (
        <mesh key={hx} position={[hx, 0.55, -2.02]}>
          <boxGeometry args={[0.3, 0.2, 0.06]} />
          <meshStandardMaterial color="#fff4d0" emissive="#ffe9a8" emissiveIntensity={1.1} toneMapped={false} />
        </mesh>
      ))}
      {/* taillights (rear = +Z) */}
      {[-0.6, 0.6].map((tx) => (
        <mesh key={tx} position={[tx, 0.55, 2.02]}>
          <boxGeometry args={[0.3, 0.2, 0.06]} />
          <meshStandardMaterial color="#5a0c0c" emissive="#c81818" emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      ))}
      {[
        [-0.95, 0.32, -1.3],
        [0.95, 0.32, -1.3],
        [-0.95, 0.32, 1.3],
        [0.95, 0.32, 1.3],
      ].map((p, i) => (
        <mesh key={i} position={p} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.24, 12]} />
          <meshStandardMaterial color="#0c0c0e" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// The cars that drive in during daylight and bunch up bumper-to-bumper on the
// main street — nobody ever really leaves Nowhere.
const JAM_LANE_Y = 525;
const JAM_CARS = [
  { slot: 720, color: '#8a2a24' },
  { slot: 650, color: '#2a3a5a' },
  { slot: 580, color: '#6a6a6e' },
  { slot: 510, color: '#7a6a2a' },
  { slot: 440, color: '#33332f' },
];
function TrafficJam() {
  const refs = useRef([]);
  const xs = useRef(JAM_CARS.map((_, i) => 1080 + i * 72)); // start off the east edge
  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const { time } = useGameStore.getState();
    const light = dayLight(time);
    const speed = 32 * Math.max(0, light - 0.08); // only creep forward in daylight
    for (let i = 0; i < JAM_CARS.length; i++) {
      const target = JAM_CARS[i].slot;
      if (xs.current[i] > target) xs.current[i] = Math.max(target, xs.current[i] - speed * dt);
      const g = refs.current[i];
      if (g) g.position.set(wx(xs.current[i]), 0, wz(JAM_LANE_Y));
    }
  });
  return (
    <group>
      {JAM_CARS.map((c, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)} rotation={[0, Math.PI / 2, 0]}>
          <Car color={c.color} />
        </group>
      ))}
    </group>
  );
}

// The cream tour bus that brought a load of newcomers and never left.
function Bus() {
  return (
    <group position={[wx(880), 0, wz(520)]}>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[9, 2.0, 2.5]} />
        <meshStandardMaterial color="#d8cda8" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 2.45, 0]} castShadow>
        <boxGeometry args={[8.8, 0.3, 2.4]} />
        <meshStandardMaterial color="#b8ad88" roughness={0.7} />
      </mesh>
      {[1.27, -1.27].map((z) => (
        <mesh key={z} position={[0, 1.75, z]}>
          <boxGeometry args={[8.2, 0.7, 0.04]} />
          <meshStandardMaterial color="#12161c" roughness={0.2} metalness={0.6} />
        </mesh>
      ))}
      <WheelsX halfLen={2.9} halfWid={1.1} r={0.42} y={0.42} />
    </group>
  );
}

// The town ambulance, light-bar dark, parked by the diner.
function Ambulance() {
  return (
    <group position={[wx(900), 0, wz(330)]}>
      <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.4, 1.6, 2.3]} />
        <meshStandardMaterial color="#e8e8e4" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[-2.4, 0.7, 0]} castShadow>
        <boxGeometry args={[0.9, 1.0, 2.2]} />
        <meshStandardMaterial color="#e8e8e4" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* red stripe */}
      <mesh position={[0.4, 1.05, 1.16]}>
        <boxGeometry args={[5.0, 0.34, 0.02]} />
        <meshStandardMaterial color="#c01818" />
      </mesh>
      {/* red cross facing the street (+Z) */}
      <mesh position={[1.3, 1.25, 1.17]}>
        <planeGeometry args={[0.72, 0.72]} />
        <meshStandardMaterial color="#c01818" />
      </mesh>
      <mesh position={[1.3, 1.25, 1.18]}>
        <planeGeometry args={[0.46, 0.15]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[1.3, 1.25, 1.18]}>
        <planeGeometry args={[0.15, 0.46]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* windscreen */}
      <mesh position={[-2.4, 1.05, 0]}>
        <boxGeometry args={[0.05, 0.5, 1.9]} />
        <meshStandardMaterial color="#12161c" roughness={0.2} metalness={0.6} />
      </mesh>
      {/* light bar */}
      <mesh position={[-1.4, 1.98, 0.4]}>
        <boxGeometry args={[0.5, 0.16, 0.3]} />
        <meshStandardMaterial color="#c81818" emissive="#ff2a2a" emissiveIntensity={1.3} toneMapped={false} />
      </mesh>
      <mesh position={[-1.4, 1.98, -0.4]}>
        <boxGeometry args={[0.5, 0.16, 0.3]} />
        <meshStandardMaterial color="#2a4ad8" emissive="#3a6aff" emissiveIntensity={1.3} toneMapped={false} />
      </mesh>
      <WheelsX halfLen={1.7} halfWid={1.0} r={0.36} y={0.36} />
    </group>
  );
}

// The Choosing Ceremony Stone — the weathered monolith where newcomers are
// welcomed. A quiet FROM landmark on the west side of the street.
function ChoosingStone() {
  return (
    <group position={[wx(300), 0, wz(545)]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.12, 10]} />
        <meshStandardMaterial color="#4a463f" roughness={1} />
      </mesh>
      <mesh position={[0, 0.95, 0]} rotation={[0.04, 0.3, 0.06]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 1.8, 0.34]} />
        <meshStandardMaterial color="#6b6660" roughness={1} />
      </mesh>
    </group>
  );
}

// Compute the context-sensitive interaction prompt for the HUD.
function interactLabel(player, s) {
  const npc = nearestNpc(player.x, player.y);
  if (npc) return `Talk to ${npc.name}`;
  const lore = nearestLore(player.x, player.y, s.loreFound);
  if (lore) return `Read — ${lore.title}`;
  const { phase } = getPhaseInfo(s.time);
  if (phase !== 'NIGHT') {
    const task = nearestTask(player.x, player.y, s.tasksDone);
    if (task) return task.verb;
  }
  const node = nearestMaterial(player.x, player.y, s.materialsTaken);
  if (node) return `Take — ${node.kind}`;
  return null;
}

// ---------- First-person controller: look + move + run the sim ----------
function Player() {
  const { camera, gl } = useThree();
  const yaw = useRef(-Math.PI / 2); // start facing up the street (toward -z... toward town)
  const pitch = useRef(0);
  const keys = useRef(new Set());
  const prevC = useRef(false);
  const prevE = useRef(false);
  const prevF = useRef(false);
  const prevG = useRef(false);
  const prevJ = useRef(false);
  const prevK = useRef(false);
  const prevH = useRef(false);
  const prevB = useRef(false);
  const bob = useRef(0);
  const lastStep = useRef(0);
  const lastHealth = useRef(100);
  const shake = useRef(0);
  const prevChasing = useRef(false);
  const vy = useRef(0); // jump vertical velocity
  const py = useRef(0); // jump vertical offset
  const grounded = useRef(true);
  const prevSpace = useRef(false);
  const prevV = useRef(false);
  const deadT = useRef(0);
  const portalCD = useRef(0); // teleport cooldown so arrivals don't chain

  // Mouse look while pointer is locked (sensitivity from settings).
  useEffect(() => {
    const onMove = (e) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const sens = useGameStore.getState().settings.sensitivity / 50; // 50 = 1x
      const k = 0.0022 * sens;
      yaw.current -= e.movementX * k;
      pitch.current -= e.movementY * k;
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current));
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [gl]);

  // Keyboard.
  useEffect(() => {
    const down = (e) => {
      keys.current.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
        e.preventDefault();
    };
    const up = (e) => keys.current.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const st = useGameStore.getState();
    const k = keys.current;
    const api = useGameStore.getState();
    const kb = st.keybinds;

    // ---- Look orientation ----
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yaw.current;
    camera.rotation.x = pitch.current;

    const edge = (code, ref) => {
      const d = k.has(code);
      const hit = d && !ref.current;
      ref.current = d;
      return hit;
    };

    // ---- UI toggles & item use (work while panels are open so they can close) ----
    if (!st.paused) {
      if (edge(kb.journal, prevJ)) api.toggleJournal();
      if (edge(kb.craft, prevK)) api.toggleCraft();
      if (edge(kb.bandage, prevH)) api.useBandage();
      if (edge(kb.eat, prevB)) api.eatFood();
      if (edge(kb.camera, prevV)) api.toggleCameraMode();
    }

    // ---- Lantern toggle ----
    const fDown = k.has(kb.lantern);
    let lanternOn = st.lanternOn;
    if (fDown && !prevF.current && !st.paused) lanternOn = !lanternOn;
    prevF.current = fDown;

    const paused =
      st.paused || !!(st.activeDialogue || st.showJournal || st.showCraft || st.readingLore);

    if (st.status === 'playing' && !paused) {
      // Interact: talk / read lore / scavenge / work chores.
      if (edge(kb.interact, prevG)) api.interact();

      // ---- Desired movement in world space, relative to camera yaw ----
      const fz = (k.has(kb.forward) || k.has('ArrowUp') ? 1 : 0) - (k.has(kb.back) || k.has('ArrowDown') ? 1 : 0);
      const fx = (k.has(kb.right) || k.has('ArrowRight') ? 1 : 0) - (k.has(kb.left) || k.has('ArrowLeft') ? 1 : 0);
      const fwdX = -Math.sin(yaw.current);
      const fwdZ = -Math.cos(yaw.current);
      const rgtX = Math.cos(yaw.current);
      const rgtZ = -Math.sin(yaw.current);
      const moveX = fwdX * fz + rgtX * fx;
      const moveZ = fwdZ * fz + rgtZ * fx;

      const toggleHide = edge(kb.hide, prevC);
      const placeWard = edge(kb.ward, prevE);
      const sneaking =
        k.has(kb.sneak) ||
        ((kb.sneak === 'ShiftLeft' || kb.sneak === 'ShiftRight') &&
          (k.has('ShiftLeft') || k.has('ShiftRight')));

      const result = advance(st, dt, {
        dirX: moveX,
        dirY: moveZ,
        sneaking,
        toggleHide,
        placeWard,
      });

      // ---- The trees that fold the road: step into one and you're elsewhere ----
      if (portalCD.current > 0) {
        portalCD.current -= dt;
      } else {
        for (const pt of PORTAL_TREES) {
          if (Math.hypot(result.player.x - pt.x, result.player.y - pt.y) < PORTAL_RADIUS) {
            const dest = randomTeleportTarget(result.player.x, result.player.y);
            result.player.x = dest.x;
            result.player.y = dest.y;
            result.fear = Math.min(100, (result.fear || 0) + 7);
            portalCD.current = 3.0;
            if (!st.settings.reduceMotion) shake.current = Math.min(0.6, shake.current + 0.45);
            stinger();
            if (st.settings.subtitles) api.showToast('[ the trees fold the road \u2014 you are elsewhere ]');
            break;
          }
        }
      }

      // ---- Battery drain ----
      let battery = st.battery;
      if (lanternOn) battery = Math.max(0, battery - BATTERY_DRAIN * dt);

      // ---- Context-sensitive interaction prompt ----
      const after = useGameStore.getState();
      const label = interactLabel(result.player, after);

      useGameStore.setState({ ...result, lanternOn, battery, promptInteract: label, playerYaw: yaw.current });

      const moving = moveX !== 0 || moveZ !== 0;
      bob.current += moving ? dt * 9 : 0;

      // ---- Jump / vertical hop (cosmetic; 2D collision is unchanged) ----
      const wantJump = k.has('Space');
      if (wantJump && !prevSpace.current && grounded.current && !result.hidden) {
        vy.current = JUMP_V;
        grounded.current = false;
      }
      prevSpace.current = wantJump;
      py.current += vy.current * dt;
      vy.current -= GRAVITY * dt;
      if (py.current <= 0) {
        py.current = 0;
        vy.current = 0;
        grounded.current = true;
      }

      // ---- Feed the third-person avatar ----
      deadT.current = 0;
      avatar.x = result.player.x;
      avatar.z = result.player.y;
      avatar.yaw = yaw.current;
      avatar.yOff = py.current;
      avatar.vy = vy.current;
      avatar.grounded = grounded.current;
      avatar.hidden = result.hidden;
      avatar.speed = moving ? (sneaking ? 0.5 : 1) : 0;
      avatar.running = moving && !sneaking;
      avatar.phase = bob.current;
      avatar.mode = st.settings.cameraMode;
      avatar.status = 'playing';
      avatar.dead = 0;

      // ---- Audio: footsteps, tension, chase stinger ----
      if (moving && !result.hidden) {
        const stepIdx = Math.floor(bob.current / Math.PI);
        if (stepIdx !== lastStep.current) {
          lastStep.current = stepIdx;
          footstep(sneaking ? 0.4 : 1);
        }
      }
      // Danger drives heartbeat + drone.
      let nd = Infinity;
      let chasing = false;
      for (const e of result.enemies) {
        nd = Math.min(nd, Math.hypot(result.player.x - e.x, result.player.y - e.y));
        if (e.state === 'chase') chasing = true;
      }
      let danger = Math.min(1, after.fear / 100 * 0.7);
      if (nd < 300) danger = Math.max(danger, (300 - nd) / 300);
      if (chasing) danger = Math.max(danger, 0.85);
      updateTension(danger);
      if (chasing && !prevChasing.current) {
        stinger();
        if (useGameStore.getState().settings.subtitles) api.showToast('[ something begins to hunt you ]');
      }
      prevChasing.current = chasing;

      // ---- Screen shake when hurt ----
      if (result.health < lastHealth.current - 0.3 && !useGameStore.getState().settings.reduceMotion) {
        shake.current = Math.min(0.5, shake.current + (lastHealth.current - result.health) * 0.03);
      }
      lastHealth.current = result.health;
    } else {
      if (lanternOn !== st.lanternOn) useGameStore.setState({ lanternOn });
      // Keep edges in sync so actions don't fire on resume.
      prevC.current = k.has(kb.hide);
      prevE.current = k.has(kb.ward);
      prevG.current = k.has(kb.interact);
      prevSpace.current = k.has('Space');
      prevV.current = k.has(kb.camera);
      updateTension(0); // calm the heartbeat while paused / between runs

      // Keep the avatar settled; play a collapse if the run was lost.
      const p2 = useGameStore.getState();
      avatar.x = p2.player.x;
      avatar.z = p2.player.y;
      avatar.yaw = yaw.current;
      avatar.speed = 0;
      avatar.running = false;
      avatar.hidden = p2.hidden;
      avatar.mode = st.settings.cameraMode;
      avatar.status = st.status;
      py.current = 0;
      vy.current = 0;
      grounded.current = true;
      avatar.yOff = 0;
      avatar.vy = 0;
      avatar.grounded = true;
      if (st.status === 'lost') {
        deadT.current = Math.min(1, deadT.current + dt * 2);
      } else {
        deadT.current = 0;
      }
      avatar.dead = deadT.current;
    }

    // ---- Place the camera (first- or third-person) ----
    const p = useGameStore.getState();
    const mode = p.settings.cameraMode;
    const eye = p.hidden ? CROUCH_EYE : EYE;
    const reduce = p.settings.reduceMotion;
    const bobActive = !reduce && p.status === 'playing' && !paused;
    // Decay any active screen-shake and offset the camera by it.
    shake.current = Math.max(0, shake.current - dt * 1.6);
    const sh = shake.current;
    const ox = sh ? (Math.random() - 0.5) * sh : 0;
    const oy = sh ? (Math.random() - 0.5) * sh : 0;
    const px = wx(p.player.x);
    const pz = wz(p.player.y);

    if (mode === 'tpp') {
      // Orbit a little behind and above the avatar, over its shoulder.
      const cosP = Math.cos(pitch.current);
      const dirX = -Math.sin(yaw.current) * cosP;
      const dirY = Math.sin(pitch.current);
      const dirZ = -Math.cos(yaw.current) * cosP;
      const dist = 4.0;
      const targetY = eye + py.current + 0.1;
      camera.position.set(
        px - dirX * dist + ox,
        Math.max(0.5, targetY - dirY * dist + 1.0 + oy),
        pz - dirZ * dist + ox
      );
      camera.lookAt(px, targetY - 0.2, pz);
    } else {
      const bobY = bobActive ? Math.sin(bob.current) * 0.05 : 0;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = yaw.current;
      camera.rotation.x = pitch.current;
      camera.position.set(px + ox, eye + py.current + bobY + oy, pz + ox);
    }
  });

  return null;
}

// ---------- Third-person avatar with procedural skeletal animation ----------
function PlayerAvatar() {
  const root = useRef();
  const hips = useRef();
  const torso = useRef();
  const armL = useRef();
  const armR = useRef();
  const legL = useRef();
  const legR = useRef();

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt);
    const a = avatar;
    const g = root.current;
    if (!g) return;
    g.visible = a.mode === 'tpp' && (a.status === 'playing' || a.status === 'lost');
    if (!g.visible) return;

    g.position.set(wx(a.x), a.yOff, wz(a.z));
    g.rotation.y = a.yaw + Math.PI;

    const now = performance.now() * 0.001;
    const airborne = !a.grounded && a.status === 'playing';
    const moving = a.speed > 0.01 && !a.hidden && !airborne;

    let lLeg = 0;
    let rLeg = 0;
    let lArm = 0;
    let rArm = 0;
    let hipsY = 0;
    let torsoLean = 0;
    let hipsRotX = 0;

    if (a.dead > 0) {
      // Collapse forward onto the ground.
      hipsRotX = -a.dead * (Math.PI / 2);
      hipsY = -a.dead * 0.6;
    } else if (airborne) {
      if (a.vy > 0.1) {
        lLeg = -0.7; // jump: tuck legs, arms swing up
        rLeg = -0.4;
        lArm = -2.2;
        rArm = -2.0;
      } else {
        lLeg = -0.3; // fall: splay legs, arms flail
        rLeg = 0.35;
        lArm = -2.6;
        rArm = -2.4;
      }
    } else if (a.hidden) {
      hipsY = -0.55; // crouch low
      lLeg = 0.9;
      rLeg = 0.9;
      torsoLean = 0.5;
      lArm = 0.4;
      rArm = 0.4;
    } else if (moving) {
      const amp = a.running ? 0.95 : 0.5;
      const sp = a.running ? 1.0 : 0.7;
      const ph = a.phase * sp;
      lLeg = Math.sin(ph) * amp;
      rLeg = Math.sin(ph + Math.PI) * amp;
      lArm = Math.sin(ph + Math.PI) * amp * 0.9;
      rArm = Math.sin(ph) * amp * 0.9;
      torsoLean = a.running ? 0.22 : 0.08;
      hipsY = Math.abs(Math.sin(ph)) * (a.running ? 0.08 : 0.04);
    } else {
      const br = Math.sin(now * 1.4) * 0.04; // idle breathing
      lArm = br;
      rArm = -br;
      torsoLean = 0.02 + br * 0.2;
    }

    const kf = 1 - Math.pow(0.0015, dt); // frame-rate independent smoothing
    const lp = (ref, prop, target) => {
      if (ref.current) ref.current.rotation[prop] += (target - ref.current.rotation[prop]) * kf;
    };
    lp(legL, 'x', lLeg);
    lp(legR, 'x', rLeg);
    lp(armL, 'x', lArm);
    lp(armR, 'x', rArm);
    lp(torso, 'x', torsoLean);
    if (hips.current) {
      hips.current.position.y += (hipsY - hips.current.position.y) * kf;
      hips.current.rotation.x += (hipsRotX - hips.current.rotation.x) * kf;
    }
  });

  const skin = '#c79c76';
  const jacket = '#54606b';
  const pants = '#2c2824';
  const boot = '#15110d';
  const hair = '#241a14';
  return (
    <group ref={root}>
      <group ref={hips}>
        {/* legs pivot at the hip: trousers + boot */}
        <group ref={legL} position={[-0.12, 0.9, 0]}>
          <mesh position={[0, -0.45, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.7, 4, 8]} />
            <meshStandardMaterial color={pants} roughness={1} />
          </mesh>
          <mesh position={[0, -0.86, 0.05]} castShadow>
            <boxGeometry args={[0.17, 0.12, 0.28]} />
            <meshStandardMaterial color={boot} roughness={1} />
          </mesh>
        </group>
        <group ref={legR} position={[0.12, 0.9, 0]}>
          <mesh position={[0, -0.45, 0]} castShadow>
            <capsuleGeometry args={[0.1, 0.7, 4, 8]} />
            <meshStandardMaterial color={pants} roughness={1} />
          </mesh>
          <mesh position={[0, -0.86, 0.05]} castShadow>
            <boxGeometry args={[0.17, 0.12, 0.28]} />
            <meshStandardMaterial color={boot} roughness={1} />
          </mesh>
        </group>
        {/* torso pivots at the waist and carries head + arms */}
        <group ref={torso} position={[0, 0.9, 0]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <capsuleGeometry args={[0.23, 0.6, 4, 12]} />
            <meshStandardMaterial color={jacket} roughness={0.85} />
          </mesh>
          {/* collar */}
          <mesh position={[0, 0.78, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.18, 0.12, 12]} />
            <meshStandardMaterial color={pants} roughness={1} />
          </mesh>
          <mesh position={[0, 1.0, 0]} castShadow>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial color={skin} roughness={0.85} />
          </mesh>
          {/* hair cap */}
          <mesh position={[0, 1.1, -0.02]} castShadow>
            <sphereGeometry args={[0.21, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <meshStandardMaterial color={hair} roughness={1} />
          </mesh>
          <group ref={armL} position={[-0.3, 0.75, 0]}>
            <mesh position={[0, -0.35, 0]} castShadow>
              <capsuleGeometry args={[0.08, 0.6, 4, 8]} />
              <meshStandardMaterial color={jacket} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.7, 0]} castShadow>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color={skin} roughness={0.9} />
            </mesh>
          </group>
          <group ref={armR} position={[0.3, 0.75, 0]}>
            <mesh position={[0, -0.35, 0]} castShadow>
              <capsuleGeometry args={[0.08, 0.6, 4, 8]} />
              <meshStandardMaterial color={jacket} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.7, 0]} castShadow>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color={skin} roughness={0.9} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

export default function FirstPerson() {
  const quality = useGameStore((s) => s.settings.quality);
  const start = useMemo(() => {
    const { player } = useGameStore.getState();
    return [wx(player.x), EYE, wz(player.y)];
  }, []);

  // Lower quality => lower render resolution => big perf win on weak machines.
  const dpr = { low: 1, medium: 1.5, high: 2 }[quality] || 2;

  return (
    <Canvas
      shadows={quality === 'high' ? 'soft' : false}
      dpr={[1, dpr]}
      camera={{ fov: 75, near: 0.05, far: 140, position: start }}
      gl={{
        antialias: quality !== 'low',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.25,
      }}
      style={{ position: 'absolute', inset: 0 }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor('#05040a');
        scene.background = new THREE.Color('#05040a');
      }}
    >
      <Atmosphere />
      <Flashlight />
      <Ground />
      <BuildingFloors />
      <Walls />
      <Roofs />
      <DecorTown />
      <Facades />
      <HideSpots />
      <Forest />
      <PortalTrees />
      <DinerSign />
      <Bus />
      <Ambulance />
      <ChoosingStone />
      <TrafficJam />
      <Survivors />
      <LorePickups />
      <MaterialPickups />
      <Tasks />
      <Enemies />
      <Wards />
      <Player />
      <PlayerAvatar />
    </Canvas>
  );
}
