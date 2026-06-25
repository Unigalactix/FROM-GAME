// First-person 3D view (Phase 3). Renders the same town the 2D prototype
// simulates, but from inside the survivor's eyes. The world's top-down (x, y)
// maps onto the 3D ground plane as (x, z); everything is driven by the shared
// `advance()` simulation so the AI, fear, and stealth rules are unchanged.

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, getPhaseInfo, dayLight } from '../store.js';
import { WORLD, BUILDINGS, WALLS, HIDE_SPOTS } from '../systems/town.js';
import { ENEMY_R } from '../systems/enemies.js';
import { advance } from '../systems/sim.js';
import {
  NPCS,
  LORE,
  MATERIAL_NODES,
  MATERIAL_COLORS,
  TASKS,
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
} from '../systems/audio.js';

const S = 0.06; // world-units -> meters
const WALL_H = 3.2; // wall height (m)
const EYE = 1.7; // standing eye height (m)
const CROUCH_EYE = 0.85; // eye height while hidden
const BATTERY_DRAIN = 1.6; // %/s while lantern is on

const wx = (x) => x * S;
const wz = (y) => y * S;

// ---------- World geometry ----------
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[wx(WORLD.w / 2), 0, wz(WORLD.h / 2)]} receiveShadow>
      <planeGeometry args={[wx(WORLD.w), wz(WORLD.h)]} />
      <meshStandardMaterial color="#0c0b0d" roughness={1} />
    </mesh>
  );
}

function Walls() {
  return (
    <group>
      {WALLS.map((w, i) => (
        <mesh
          key={i}
          position={[wx(w.x + w.w / 2), WALL_H / 2, wz(w.y + w.h / 2)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wx(w.w), WALL_H, wz(w.h)]} />
          <meshStandardMaterial color="#26221d" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

function BuildingFloors() {
  return (
    <group>
      {BUILDINGS.map((b) => (
        <mesh
          key={b.name}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[wx(b.x + b.w / 2), 0.02, wz(b.y + b.h / 2)]}
          receiveShadow
        >
          <planeGeometry args={[wx(b.w), wz(b.h)]} />
          <meshStandardMaterial color="#18130f" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// A simple crate marking each hide spot.
function HideSpots() {
  return (
    <group>
      {HIDE_SPOTS.map((h) => (
        <mesh key={h.name} position={[wx(h.x), 0.4, wz(h.y)]} castShadow>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial color="#2c2620" roughness={1} />
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
      const eyeColor = chasing ? 0xb81717 : 0x9c5a1f;
      node.lEye.material.color.setHex(eyeColor);
      node.rEye.material.color.setHex(eyeColor);
      const flick = chasing ? 1.2 + Math.sin(performance.now() * 0.02) * 0.4 : 0.5;
      node.lEye.material.emissiveIntensity = flick;
      node.rEye.material.emissiveIntensity = flick;
    }
  });

  return <group ref={group} />;
}

function makeFigure() {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 1 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.5, 10), bodyMat);
  body.position.y = 0.95;
  root.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), bodyMat);
  head.position.y = 1.85;
  root.add(head);

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

  return { root, lEye, rEye };
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
      <directionalLight
        ref={sun}
        position={[wx(WORLD.w * 0.7), 60, wz(WORLD.h * 0.2)]}
        intensity={0.6}
        color="#cdd2da"
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
function Survivors() {
  return (
    <group>
      {NPCS.map((n) => (
        <group key={n.id} position={[wx(n.x), 0, wz(n.y)]}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.32, 1.4, 10]} />
            <meshStandardMaterial color={n.color} roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.75, 0]} castShadow>
            <sphereGeometry args={[0.24, 14, 14]} />
            <meshStandardMaterial color={n.color} roughness={0.9} />
          </mesh>
          {/* survivors keep a candle burning so you can find them */}
          <pointLight position={[0, 1.9, 0]} color="#ffcf8a" intensity={0.8} distance={5} decay={2} />
        </group>
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
  const trees = useMemo(() => {
    const arr = [];
    const R = Math.random;
    for (let i = 0; i < 64; i++) {
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
      arr.push({ x, y, h: 2.4 + R() * 2.4 });
    }
    return arr;
  }, []);
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[wx(t.x), 0, wz(t.y)]}>
          <mesh position={[0, t.h * 0.25, 0]}>
            <cylinderGeometry args={[0.12, 0.2, t.h * 0.5, 6]} />
            <meshStandardMaterial color="#18120d" roughness={1} />
          </mesh>
          <mesh position={[0, t.h * 0.7, 0]}>
            <coneGeometry args={[0.85, t.h, 7]} />
            <meshStandardMaterial color="#0b150b" roughness={1} />
          </mesh>
        </group>
      ))}
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

    // ---- UI toggles & item use (work even while paused so panels can close) ----
    if (edge('KeyJ', prevJ)) api.toggleJournal();
    if (edge('KeyK', prevK)) api.toggleCraft();
    if (edge('KeyH', prevH)) api.useBandage();
    if (edge('KeyB', prevB)) api.eatFood();

    // ---- Lantern toggle (F) ----
    const fDown = k.has('KeyF');
    let lanternOn = st.lanternOn;
    if (fDown && !prevF.current) lanternOn = !lanternOn;
    prevF.current = fDown;

    const paused = !!(st.activeDialogue || st.showJournal || st.showCraft || st.readingLore);

    if (st.status === 'playing' && !paused) {
      // Interact (G): talk / read lore / scavenge.
      if (edge('KeyG', prevG)) api.interact();

      // ---- Desired movement in world space, relative to camera yaw ----
      const fz = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      const fx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const fwdX = -Math.sin(yaw.current);
      const fwdZ = -Math.cos(yaw.current);
      const rgtX = Math.cos(yaw.current);
      const rgtZ = -Math.sin(yaw.current);
      const moveX = fwdX * fz + rgtX * fx;
      const moveZ = fwdZ * fz + rgtZ * fx;

      const toggleHide = edge('KeyC', prevC);
      const placeWard = edge('KeyE', prevE);

      const result = advance(st, dt, {
        dirX: moveX,
        dirY: moveZ,
        sneaking: k.has('ShiftLeft') || k.has('ShiftRight'),
        toggleHide,
        placeWard,
      });

      // ---- Battery drain ----
      let battery = st.battery;
      if (lanternOn) battery = Math.max(0, battery - BATTERY_DRAIN * dt);

      // ---- Context-sensitive interaction prompt ----
      const after = useGameStore.getState();
      const label = interactLabel(result.player, after);

      useGameStore.setState({ ...result, lanternOn, battery, promptInteract: label, playerYaw: yaw.current });

      const moving = moveX !== 0 || moveZ !== 0;
      bob.current += moving ? dt * 9 : 0;

      // ---- Audio: footsteps, tension, chase stinger ----
      if (moving && !result.hidden) {
        const stepIdx = Math.floor(bob.current / Math.PI);
        if (stepIdx !== lastStep.current) {
          lastStep.current = stepIdx;
          footstep(k.has('ShiftLeft') || k.has('ShiftRight') ? 0.4 : 1);
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
      prevC.current = k.has('KeyC');
      prevE.current = k.has('KeyE');
      prevG.current = k.has('KeyG');
      updateTension(0); // calm the heartbeat while paused / between runs
    }

    // ---- Place the camera at the (possibly updated) player position ----
    const p = useGameStore.getState();
    const eye = p.hidden ? CROUCH_EYE : EYE;
    const reduce = p.settings.reduceMotion;
    const bobY = !reduce && p.status === 'playing' && !paused ? Math.sin(bob.current) * 0.05 : 0;
    // Decay any active screen-shake and offset the camera by it.
    shake.current = Math.max(0, shake.current - dt * 1.6);
    const sh = shake.current;
    const ox = sh ? (Math.random() - 0.5) * sh : 0;
    const oy = sh ? (Math.random() - 0.5) * sh : 0;
    camera.position.set(wx(p.player.x) + ox, eye + bobY + oy, wz(p.player.y) + ox);
  });

  return null;
}

export default function FirstPerson() {
  const start = useMemo(() => {
    const { player } = useGameStore.getState();
    return [wx(player.x), EYE, wz(player.y)];
  }, []);

  return (
    <Canvas
      shadows
      camera={{ fov: 75, near: 0.05, far: 120, position: start }}
      gl={{ antialias: true }}
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
      <HideSpots />
      <Forest />
      <Survivors />
      <LorePickups />
      <MaterialPickups />
      <Tasks />
      <Enemies />
      <Wards />
      <Player />
    </Canvas>
  );
}
