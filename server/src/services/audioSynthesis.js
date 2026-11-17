// 音频合成服务 - 用 Node.js 生成演示用 WAV 音频
// 每首歌对应不同的音阶、节奏、氛围

/**
 * 生成一个 WAV 文件的 Buffer
 * @param {Object} params - { notes, tempo, duration, waveType }
 */
export function generateWavBuffer(params = {}) {
  const {
    notes = [440, 494, 523, 587, 659], // 默认 A大调
    tempo = 120,                        // BPM
    totalDuration = 30,                 // 秒
    waveType = 'sine',                  // sine | square | sawtooth
    volume = 0.3,
    reverb = false,
  } = params;

  const sampleRate = 22050;
  const numSamples = sampleRate * totalDuration;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // WAV 文件头
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);         // chunk size
  buffer.writeUInt16LE(1, 20);          // PCM
  buffer.writeUInt16LE(1, 22);          // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);          // block align
  buffer.writeUInt16LE(16, 34);         // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  const beatDuration = 60 / tempo;      // 每拍秒数
  const noteDuration = beatDuration;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIndex = Math.floor(t / noteDuration) % notes.length;
    const freq = notes[noteIndex];

    // 音符内的相对时间（0-1）
    const notePhase = (t % noteDuration) / noteDuration;

    // ADSR 包络：Attack 5% / Decay 10% / Sustain 70% / Release 15%
    let envelope = 1;
    if (notePhase < 0.05) {
      envelope = notePhase / 0.05;
    } else if (notePhase < 0.15) {
      envelope = 1 - (notePhase - 0.05) / 0.10 * 0.2;
    } else if (notePhase < 0.85) {
      envelope = 0.8;
    } else {
      envelope = 0.8 * (1 - (notePhase - 0.85) / 0.15);
    }

    // 波形生成
    let sample = 0;
    const phase = 2 * Math.PI * freq * t;
    if (waveType === 'sine') {
      sample = Math.sin(phase);
      // 加一点泛音使音色更丰富
      sample += 0.3 * Math.sin(phase * 2);
      sample += 0.1 * Math.sin(phase * 3);
      sample /= 1.4;
    } else if (waveType === 'square') {
      sample = Math.sin(phase) > 0 ? 1 : -1;
      // 软化方波
      sample = Math.tanh(sample * 3) * 0.6;
    } else if (waveType === 'sawtooth') {
      sample = ((freq * t) % 1) * 2 - 1;
      sample = Math.tanh(sample * 2) * 0.5;
    } else if (waveType === 'triangle') {
      const p = (freq * t) % 1;
      sample = p < 0.5 ? p * 4 - 1 : 3 - p * 4;
    }

    // 应用包络和音量
    const finalSample = sample * envelope * volume;

    // 转为 16-bit PCM
    const pcm = Math.max(-32767, Math.min(32767, Math.round(finalSample * 32767)));
    buffer.writeInt16LE(pcm, 44 + i * 2);
  }

  return buffer;
}

// 预设音阶和参数 - 对应不同的音乐风格/心情
export const AUDIO_PRESETS = {
  // 1. 悲伤钢琴 - d小调，慢节奏
  sad_piano: {
    notes: [293, 349, 392, 330, 311, 277, 293, 261],
    tempo: 60,
    totalDuration: 30,
    waveType: 'sine',
    volume: 0.25,
  },
  // 2. 开心流行 - C大调，活泼
  happy_pop: {
    notes: [523, 587, 659, 698, 784, 698, 659, 587],
    tempo: 130,
    totalDuration: 30,
    waveType: 'sine',
    volume: 0.28,
  },
  // 3. 平静氛围 - 五声音阶，中速
  calm_ambient: {
    notes: [440, 494, 554, 659, 740, 659, 554, 494],
    tempo: 80,
    totalDuration: 30,
    waveType: 'triangle',
    volume: 0.22,
  },
  // 4. 古典钢琴奏鸣曲风 - a小调
  classical_piano: {
    notes: [440, 415, 392, 370, 330, 311, 349, 392],
    tempo: 90,
    totalDuration: 30,
    waveType: 'sine',
    volume: 0.27,
  },
  // 5. 轻爵士 - 降B调
  light_jazz: {
    notes: [466, 523, 587, 554, 494, 466, 440, 415],
    tempo: 100,
    totalDuration: 30,
    waveType: 'triangle',
    volume: 0.25,
  },
  // 6. 放松 lo-fi - 低沉音符
  lofi_chill: {
    notes: [220, 247, 261, 294, 330, 294, 261, 247],
    tempo: 75,
    totalDuration: 30,
    waveType: 'triangle',
    volume: 0.28,
  },
  // 7. 活力电子 - 高频，快节奏
  energetic_edm: {
    notes: [523, 659, 784, 880, 784, 659, 523, 440],
    tempo: 140,
    totalDuration: 30,
    waveType: 'square',
    volume: 0.20,
  },
  // 8. 月光奏鸣曲风 - c#小调，慢
  moonlight: {
    notes: [277, 330, 415, 277, 330, 415, 277, 330],
    tempo: 55,
    totalDuration: 30,
    waveType: 'sine',
    volume: 0.22,
  },
  // 9. 乡村摇滚 - G大调
  country_rock: {
    notes: [392, 440, 494, 523, 587, 523, 494, 440],
    tempo: 120,
    totalDuration: 30,
    waveType: 'sawtooth',
    volume: 0.22,
  },
  // 10. 雨天爵士 - f小调
  rainy_jazz: {
    notes: [349, 415, 440, 466, 440, 415, 370, 349],
    tempo: 85,
    totalDuration: 30,
    waveType: 'triangle',
    volume: 0.24,
  },
  // 11. 另类摇滚
  alt_rock: {
    notes: [220, 247, 220, 196, 247, 220, 196, 175],
    tempo: 110,
    totalDuration: 30,
    waveType: 'square',
    volume: 0.20,
  },
  // 12. 德彪西印象派风 - 全音音阶
  impressionist: {
    notes: [440, 494, 554, 622, 698, 784, 622, 554],
    tempo: 70,
    totalDuration: 30,
    waveType: 'sine',
    volume: 0.24,
  },
};

// 根据 track id 选择预设
const PRESET_KEYS = Object.keys(AUDIO_PRESETS);
export function getPresetForTrack(trackId) {
  const index = (parseInt(trackId) - 1) % PRESET_KEYS.length;
  return AUDIO_PRESETS[PRESET_KEYS[index]] || AUDIO_PRESETS.calm_ambient;
}
