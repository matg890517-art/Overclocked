import type { Settings } from "./save";

let ctx: AudioContext | null = null;
let settings: Settings = { sound: true, haptics: true, shake: true, hints: true };

export function bindSettings(next: Settings): void {
  settings = next;
}

function ac(): AudioContext | null {
  if (!settings.sound) return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0): void {
  const audio = ac();
  if (!audio) return;
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(audio.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur: number, gain: number): void {
  const audio = ac();
  if (!audio) return;
  const length = Math.floor(audio.sampleRate * dur);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  const g = audio.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(audio.destination);
  src.start();
}

export function resumeAudio(): void {
  ac();
}

export function sfx(kind: string): void {
  switch (kind) {
    case "ui":
      tone(880, 0.05, "square", 0.04);
      break;
    case "place":
      tone(520, 0.07, "square", 0.05);
      tone(780, 0.09, "triangle", 0.03);
      break;
    case "pulse":
      tone(180, 0.12, "sawtooth", 0.05, -80);
      break;
    case "big":
      noise(0.18, 0.2);
      tone(90, 0.28, "sawtooth", 0.08, -40);
      tone(440, 0.16, "square", 0.04);
      break;
    case "kill":
      tone(660, 0.08, "square", 0.06);
      tone(990, 0.14, "triangle", 0.05);
      break;
    case "shield":
      noise(0.22, 0.18);
      tone(240, 0.3, "sawtooth", 0.06, 200);
      break;
    case "overload":
      tone(200, 0.25, "sawtooth", 0.06, 400);
      tone(600, 0.2, "square", 0.04, 200);
      break;
    case "win":
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, "triangle", 0.06), i * 90));
      break;
    case "lose":
      tone(300, 0.3, "sawtooth", 0.06, -180);
      tone(120, 0.4, "triangle", 0.05);
      break;
    default:
      break;
  }
}

export function buzz(pattern: number | number[]): void {
  if (!settings.haptics || !navigator.vibrate) return;
  navigator.vibrate(pattern);
}
