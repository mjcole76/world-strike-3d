let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let crowdSource: AudioBufferSourceNode | null = null;
let crowdGain: GainNode | null = null;
let crowdFilter: BiquadFilterNode | null = null;

const CROWD_BASE = .014;
const CROWD_PEAK = .046;

export function ensureAudio(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

function noise(): AudioBuffer {
  if (!ctx) throw new Error('audio not ready');
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

export function sfx(freq: number, duration: number, type: OscillatorType = 'sine', volume = .035, end = freq): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(now + duration);
}

export function whistle(long = false): void {
  sfx(1700, long ? .7 : .25, 'sine', .03, 2200);
  setTimeout(() => sfx(1450, long ? .55 : .18, 'sine', .025, 1900), long ? 260 : 110);
}

/** One sharp blast - fouls and stoppages. */
export function foulWhistle(): void {
  sfx(1850, .32, 'sine', .034, 1600);
}

/** Kick thump that scales with power (0..1) - soft taps to full volleys. */
export function kickSound(power: number): void {
  const p = Math.max(0, Math.min(1, power));
  sfx(150 - p * 75, .09 + p * .13, p > .6 ? 'triangle' : 'sine', .035 + p * .035, 40);
}

/** High-frequency noise flick for the ball hitting the net. */
export function netSwish(): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noise();
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2600;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(.05, now);
  gain.gain.exponentialRampToValueAtTime(.001, now + .28);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  source.stop(now + .3);
}

/** Low disappointed murmur for misses and near things. */
export function crowdOoh(): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noise();
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 340;
  filter.Q.value = .9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.07, now + .1);
  gain.gain.exponentialRampToValueAtTime(.001, now + .9);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  source.stop(now + 1);
}

/** Looping filtered-noise ambience that swells with `setCrowdExcitement`. */
export function startCrowd(): void {
  ensureAudio();
  if (!ctx || crowdSource) return;
  crowdSource = ctx.createBufferSource();
  crowdSource.buffer = noise();
  crowdSource.loop = true;
  crowdFilter = ctx.createBiquadFilter();
  crowdFilter.type = 'lowpass';
  crowdFilter.frequency.value = 420;
  crowdGain = ctx.createGain();
  crowdGain.gain.value = 0;
  crowdSource.connect(crowdFilter).connect(crowdGain).connect(ctx.destination);
  crowdSource.start();
  crowdGain.gain.setTargetAtTime(CROWD_BASE, ctx.currentTime, .6);
}

export function stopCrowd(): void {
  if (!ctx || !crowdSource || !crowdGain) return;
  const source = crowdSource;
  crowdGain.gain.setTargetAtTime(0, ctx.currentTime, .3);
  setTimeout(() => { try { source.stop(); } catch { /* already stopped */ } }, 900);
  crowdSource = null;
  crowdGain = null;
  crowdFilter = null;
}

export function setCrowdExcitement(level: number): void {
  if (!ctx || !crowdGain || !crowdFilter) return;
  const eased = Math.max(0, Math.min(1, level));
  crowdGain.gain.setTargetAtTime(CROWD_BASE + eased * (CROWD_PEAK - CROWD_BASE), ctx.currentTime, .35);
  crowdFilter.frequency.setTargetAtTime(420 + eased * 900, ctx.currentTime, .35);
}

/** A goal/save roar: bandpassed noise burst with a fast attack and long decay. */
export function crowdRoar(volume = .16): void {
  if (!ctx) return;
  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = noise();
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 640;
  filter.Q.value = .6;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + .08);
  gain.gain.exponentialRampToValueAtTime(.001, now + 2.1);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  source.stop(now + 2.2);
}
