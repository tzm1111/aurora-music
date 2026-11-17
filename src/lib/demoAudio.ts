/**
 * 高品质本地演示音频合成器
 * 支持：和弦进行 · 鼓点节拍 · Bass · 旋律 · 多风格音色
 * 零网络依赖，纯浏览器 WAV Blob 生成
 */

const SR = 22050;

/* ──── 音高工具 ──── */
const midiFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);

/* ──── 风格预设 ──── */
interface StylePreset {
  name: string;
  bpm: number;
  chords: number[][];   // 每个和弦 = [root, ...intervals] MIDI
  melodyScale: number[];
  melodyOctave: number;
  hasKick: boolean;
  hasSnare: boolean;
  hasHihat: boolean;
  padGain: number;
  leadGain: number;
  bassGain: number;
  waveform: 'sine' | 'tri' | 'fm' | 'soft';
  swingFactor: number;
}

const STYLES: StylePreset[] = [
  {
    name: 'lofi',
    bpm: 80,
    chords: [[60,64,67,71],[65,69,72,76],[62,65,69,72],[67,71,74,77]],
    melodyScale: [0,2,4,7,9],  // 五声
    melodyOctave: 72,
    hasKick: true, hasSnare: true, hasHihat: true,
    padGain: 0.06, leadGain: 0.18, bassGain: 0.15,
    waveform: 'tri', swingFactor: 0.12,
  },
  {
    name: 'ambient',
    bpm: 65,
    chords: [[60,64,67],[57,60,64],[53,57,60],[55,59,62]],
    melodyScale: [0,2,4,5,7,9,11],
    melodyOctave: 72,
    hasKick: false, hasSnare: false, hasHihat: false,
    padGain: 0.14, leadGain: 0.08, bassGain: 0.08,
    waveform: 'sine', swingFactor: 0,
  },
  {
    name: 'electronic',
    bpm: 120,
    chords: [[60,64,67],[63,67,70],[65,69,72],[58,62,65]],
    melodyScale: [0,2,3,5,7,8,10],
    melodyOctave: 72,
    hasKick: true, hasSnare: true, hasHihat: true,
    padGain: 0.05, leadGain: 0.15, bassGain: 0.2,
    waveform: 'fm', swingFactor: 0,
  },
  {
    name: 'pop',
    bpm: 110,
    chords: [[60,64,67],[65,69,72],[57,60,64],[55,59,62]],
    melodyScale: [0,2,4,5,7,9,11],
    melodyOctave: 72,
    hasKick: true, hasSnare: true, hasHihat: true,
    padGain: 0.07, leadGain: 0.16, bassGain: 0.14,
    waveform: 'tri', swingFactor: 0.05,
  },
  {
    name: 'jazz',
    bpm: 90,
    chords: [[60,64,67,70],[65,69,72,75],[62,65,69,72],[67,71,74,78]],
    melodyScale: [0,2,4,5,7,9,10],
    melodyOctave: 72,
    hasKick: true, hasSnare: false, hasHihat: true,
    padGain: 0.06, leadGain: 0.14, bassGain: 0.12,
    waveform: 'sine', swingFactor: 0.15,
  },
  {
    name: 'rnb',
    bpm: 85,
    chords: [[60,64,67,71],[58,62,65,69],[63,67,70,74],[65,69,72,76]],
    melodyScale: [0,2,3,5,7,9,10],
    melodyOctave: 72,
    hasKick: true, hasSnare: true, hasHihat: true,
    padGain: 0.06, leadGain: 0.12, bassGain: 0.16,
    waveform: 'soft', swingFactor: 0.1,
  },
  {
    name: 'dreamy',
    bpm: 72,
    chords: [[60,64,67,72],[65,69,72,77],[62,66,69,74],[67,71,74,79]],
    melodyScale: [0,2,4,7,9],
    melodyOctave: 76,
    hasKick: false, hasSnare: false, hasHihat: true,
    padGain: 0.12, leadGain: 0.1, bassGain: 0.06,
    waveform: 'sine', swingFactor: 0.08,
  },
  {
    name: 'chill',
    bpm: 95,
    chords: [[60,64,67],[63,67,70],[58,62,65],[55,59,62]],
    melodyScale: [0,2,4,5,7,9],
    melodyOctave: 72,
    hasKick: true, hasSnare: false, hasHihat: true,
    padGain: 0.08, leadGain: 0.14, bassGain: 0.12,
    waveform: 'tri', swingFactor: 0.06,
  },
];

/* ──── 伪随机 ──── */
function xorshift(seed: number) {
  let s = seed | 1;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return ((s >>> 0) / 0xFFFFFFFF);
  };
}

/* ──── 振荡器 ──── */
function osc(phase: number, type: StylePreset['waveform']): number {
  const p = phase % 1;
  switch (type) {
    case 'sine': return Math.sin(2 * Math.PI * p);
    case 'tri': return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
    case 'fm': return Math.sin(2 * Math.PI * p + 1.5 * Math.sin(4 * Math.PI * p));
    case 'soft': return Math.tanh(2.5 * Math.sin(2 * Math.PI * p));
  }
}

/* ──── 鼓音合成 ──── */
function kick(t: number): number {
  if (t < 0 || t > 0.3) return 0;
  const freq = 150 * Math.exp(-t * 30) + 40;
  return Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 10) * 0.7;
}

function snare(t: number, rng: () => number): number {
  if (t < 0 || t > 0.2) return 0;
  const noise = rng() * 2 - 1;
  const tone = Math.sin(2 * Math.PI * 200 * t);
  return (noise * 0.6 + tone * 0.4) * Math.exp(-t * 18) * 0.45;
}

function hihat(t: number, rng: () => number): number {
  if (t < 0 || t > 0.08) return 0;
  return (rng() * 2 - 1) * Math.exp(-t * 60) * 0.2;
}

/* ──── 主生成函数 ──── */
export function generateDemoTrack(seed: number, durationSec = 50): string {
  const rng = xorshift(seed);
  const styleIdx = Math.abs(seed) % STYLES.length;
  const style = STYLES[styleIdx];
  const bpm = style.bpm + Math.floor(rng() * 10) - 5;
  const beatDur = 60 / bpm;
  const barDur = beatDur * 4;

  const numSamples = Math.floor(SR * durationSec);
  const buf = new ArrayBuffer(44 + numSamples * 2);
  const dv = new DataView(buf);

  // WAV 头
  writeStr(dv, 0, 'RIFF');
  dv.setUint32(4, 36 + numSamples * 2, true);
  writeStr(dv, 8, 'WAVE');
  writeStr(dv, 12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, SR, true);
  dv.setUint32(28, SR * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  writeStr(dv, 36, 'data');
  dv.setUint32(40, numSamples * 2, true);

  // 预生成旋律序列（每拍一个音）
  const melodyLen = Math.ceil(durationSec / beatDur) + 4;
  const melodyNotes: number[] = [];
  for (let i = 0; i < melodyLen; i++) {
    const deg = style.melodyScale[Math.floor(rng() * style.melodyScale.length)];
    melodyNotes.push(style.melodyOctave + deg);
  }

  // 渲染 PCM
  for (let i = 0; i < numSamples; i++) {
    const t = i / SR;

    // 当前位置
    const barPos = t / barDur;
    const barIdx = Math.floor(barPos);
    const inBar = barPos - barIdx;
    const beatInBar = inBar * 4;
    const beatIdx = Math.floor(t / beatDur);
    const inBeat = (t / beatDur) - beatIdx;

    // swing
    const swungBeat = beatInBar + (Math.floor(beatInBar * 2) % 2 === 1 ? style.swingFactor : 0);

    // 选和弦
    const chord = style.chords[barIdx % style.chords.length];

    // === PAD（和弦垫） ===
    let padSig = 0;
    for (const note of chord) {
      const f = midiFreq(note);
      padSig += osc(f * t / SR * SR, 'sine') * 0.25;
    }
    padSig *= style.padGain;
    // pad 缓慢包络
    const padEnv = Math.sin(Math.PI * inBar);
    padSig *= padEnv * 0.7 + 0.3;

    // === BASS ===
    const bassNote = chord[0] - 12;
    const bassFreq = midiFreq(bassNote);
    const bassSig = osc(bassFreq * t, 'soft') * style.bassGain;

    // === LEAD（旋律） ===
    const mNote = melodyNotes[beatIdx % melodyNotes.length];
    const mFreq = midiFreq(mNote);
    let leadSig = osc(mFreq * t, style.waveform);
    // 旋律 ADSR
    const atk = Math.min(inBeat * beatDur / 0.015, 1);
    const dec = Math.exp(-inBeat * beatDur * 4);
    leadSig *= atk * dec * style.leadGain;

    // === DRUMS ===
    let drumSig = 0;
    if (style.hasKick) {
      // kick: 每拍第 0 和 2
      const kickBeats = [0, 2];
      for (const kb of kickBeats) {
        const dt = (swungBeat - kb) * beatDur;
        drumSig += kick(dt);
      }
    }
    if (style.hasSnare) {
      // snare: 每拍第 1 和 3
      const snareBeats = [1, 3];
      for (const sb of snareBeats) {
        const dt = (swungBeat - sb) * beatDur;
        drumSig += snare(dt, rng);
      }
    }
    if (style.hasHihat) {
      // hihat: 每半拍
      for (let hb = 0; hb < 8; hb++) {
        const dt = (beatInBar - hb * 0.5) * beatDur;
        drumSig += hihat(dt, rng);
      }
    }

    // === MIX ===
    // 淡入淡出
    const fadeIn = Math.min(t / 2, 1);
    const fadeOut = Math.min((durationSec - t) / 3, 1);
    const master = fadeIn * Math.max(fadeOut, 0) * 0.55;

    let mix = (padSig + bassSig + leadSig + drumSig) * master;
    // 软限幅
    mix = Math.tanh(mix * 1.2);

    dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, mix)) * 30000, true);
  }

  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

function writeStr(dv: DataView, off: number, s: string) {
  for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
}

/** track ID → stable seed */
export function trackIdToSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
