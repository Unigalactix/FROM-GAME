// Phase 5 — procedural audio engine (Web Audio API, no asset files).
// Everything is synthesized at runtime: a wind bed, a heartbeat that quickens
// with danger, a low dread drone, footsteps, and chase stingers. This keeps the
// bundle tiny and lets the soundscape react continuously to the simulation.
//
// Nothing here runs until initAudio() is called from a user gesture (browser
// autoplay policy). After that, updateTension()/footstep()/stinger() are cheap
// to call every frame.

let ctx = null;
let master = null; // master gain (driven by settings volume)
let started = false;

// Persistent voices
let windGain = null;
let droneOsc = null;
let droneGain = null;

// Heartbeat scheduler
let heartTimer = null;
let heartRate = 0; // 0..1 danger -> tempo

// Cached noise buffer (shared by wind + footsteps + stingers)
let noiseBuffer = null;

function makeNoiseBuffer(seconds = 2) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function initAudio() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    noiseBuffer = makeNoiseBuffer(2);
  } catch {
    ctx = null;
  }
}

// Resume + spin up the persistent ambience. Safe to call repeatedly.
export function startAmbient() {
  if (!ctx || started) return;
  if (ctx.state === 'suspended') ctx.resume();
  started = true;

  // --- Wind bed: looping noise through a slow band-pass, gently wavering. ---
  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuffer;
  wind.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 420;
  windFilter.Q.value = 0.6;
  windGain = ctx.createGain();
  windGain.gain.value = 0.06;
  wind.connect(windFilter).connect(windGain).connect(master);
  wind.start();

  // Slow LFO so the wind breathes.
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(windFilter.frequency);
  lfo.start();

  // --- Dread drone: low sine, silent until danger rises. ---
  droneOsc = ctx.createOscillator();
  droneOsc.type = 'sine';
  droneOsc.frequency.value = 52;
  droneGain = ctx.createGain();
  droneGain.gain.value = 0.0001;
  droneOsc.connect(droneGain).connect(master);
  droneOsc.start();

  scheduleHeart();
}

// One heartbeat = two quick thumps. Rate set by danger via heartRate.
function thump(t, freq, gainVal) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gainVal, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.22);
}

function beat() {
  if (!ctx || heartRate <= 0.02) return;
  const t = ctx.currentTime;
  const vol = 0.12 + heartRate * 0.5;
  thump(t, 60, vol);
  thump(t + 0.16, 50, vol * 0.7);
}

function scheduleHeart() {
  clearTimeout(heartTimer);
  const tick = () => {
    beat();
    // Resting ~ never (paused below 0.02); danger 1 ~ 165 bpm.
    const bpm = 48 + heartRate * 120;
    const interval = 60000 / bpm;
    heartTimer = setTimeout(tick, interval);
  };
  heartTimer = setTimeout(tick, 700);
}

// danger 0..1 — drives heartbeat tempo, heartbeat presence, and the drone.
export function updateTension(danger) {
  if (!ctx || !started) return;
  heartRate = Math.max(0, Math.min(1, danger));
  if (droneGain) {
    const target = 0.0001 + heartRate * 0.12;
    droneGain.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
  }
  if (droneOsc) {
    droneOsc.frequency.setTargetAtTime(46 + heartRate * 18, ctx.currentTime, 0.5);
  }
}

// Short crunch for a footstep. `loud` scales with running vs sneaking.
export function footstep(loud = 1) {
  if (!ctx || !started) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.08 * loud, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.16);
}

// A sharp dread stinger — used when something starts hunting you.
export function stinger() {
  if (!ctx || !started) return;
  const t = ctx.currentTime;
  // Descending tone.
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(440, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.7);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1200;
  o.connect(f).connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.85);
  // Noise burst underneath.
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.12, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  src.connect(ng).connect(master);
  src.start(t);
  src.stop(t + 0.5);
}

// A wooden knock — the Smiling Folk rapping on a door at night. `vol` scales
// with how close the knocker is to the player.
export function knock(vol = 1) {
  if (!ctx || !started) return;
  const t = ctx.currentTime;
  // Sharp attack of filtered noise = knuckles on wood.
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 240;
  bp.Q.value = 3.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(bp).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.14);
  // Low resonant body of the door panel.
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(66, t + 0.1);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.1 * vol, t + 0.006);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(og).connect(master);
  o.start(t);
  o.stop(t + 0.16);
}

// A soft UI tick (pickups, menu).
export function uiClick() {
  if (!ctx || !started) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.value = 320;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.12);
}

// Master volume 0..100 from settings.
export function setMasterVolume(v0to100) {
  if (!master || !ctx) return;
  master.gain.setTargetAtTime(Math.max(0, Math.min(1, v0to100 / 100)), ctx.currentTime, 0.05);
}
