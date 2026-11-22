/**
 * Referee's whistle, synthesised with Web Audio (no sound file, works offline).
 *
 * iPhones only allow sound after a tap, so `enableWhistle()` hooks every tap in the app
 * to switch audio on (Start Clock, Resume, anything). After that the clock can blow it.
 */

let ctx: AudioContext | null = null;
let out: AudioNode | null = null;

function setup(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  // Safari 17+: play like a media app, so the whistle still sounds with the silent switch on.
  const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'playback';
  ctx = new AC();
  // Squash peaks so the whistle can be loud without distorting.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 6;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  comp.connect(master).connect(ctx.destination);
  out = comp;
  return ctx;
}

/** Wake audio up from inside a tap (the only time iOS allows it). */
function unlock() {
  const c = setup();
  if (!c) return;
  if (c.state !== 'running') void c.resume();
  // A silent blip completes the unlock on older iPhones.
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start();
}

/** Call once at start-up. */
export function enableWhistle() {
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('keydown', unlock, { capture: true, passive: true });
}

/** One blast starting at time t (seconds, audio clock), `len` seconds long. */
function blast(c: AudioContext, dest: AudioNode, t: number, len: number) {
  const pitch = 2900; // Hz: a pea whistle's note
  const env = c.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.015);
  env.gain.setValueAtTime(1, t + len - 0.06);
  env.gain.linearRampToValueAtTime(0, t + len);
  env.connect(dest);

  // The note: slight scoop up at the start, like a real blow.
  const tone = c.createOscillator();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(pitch * 0.9, t);
  tone.frequency.exponentialRampToValueAtTime(pitch, t + 0.04);
  const bright = c.createOscillator(); // a little edge on top
  bright.type = 'triangle';
  bright.frequency.setValueAtTime(pitch * 0.9, t);
  bright.frequency.exponentialRampToValueAtTime(pitch, t + 0.04);
  const brightGain = c.createGain();
  brightGain.gain.value = 0.25;

  // The pea's rattle: wobble the pitch and the loudness ~40 times a second.
  const rattle = c.createOscillator();
  rattle.frequency.value = 40;
  const wobble = c.createGain();
  wobble.gain.value = 180; // ± Hz
  rattle.connect(wobble);
  wobble.connect(tone.frequency);
  wobble.connect(bright.frequency);
  const trill = c.createGain();
  trill.gain.value = 0.7;
  const trillDepth = c.createGain();
  trillDepth.gain.value = 0.3;
  rattle.connect(trillDepth).connect(trill.gain);

  tone.connect(trill);
  bright.connect(brightGain).connect(trill);
  trill.connect(env);

  // Breath: a touch of filtered noise.
  const noise = c.createBufferSource();
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = pitch;
  band.Q.value = 1.2;
  const breath = c.createGain();
  breath.gain.value = 0.12;
  noise.connect(band).connect(breath).connect(env);

  for (const node of [tone, bright, rattle, noise]) {
    node.start(t);
    node.stop(t + len + 0.02);
  }
}

/** Blow the whistle `times` times (3 = stop, 2 = rolling change). */
export function blowWhistle(times: number) {
  const c = setup();
  if (!c || !out || times <= 0) return;
  if (c.state !== 'running') void c.resume();
  const LEN = 0.45; // each blast
  const GAP = 0.2; // between blasts
  const t0 = c.currentTime + 0.05;
  for (let i = 0; i < times; i++) blast(c, out, t0 + i * (LEN + GAP), LEN);
}
