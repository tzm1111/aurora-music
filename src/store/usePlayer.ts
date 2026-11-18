import { create } from 'zustand';
import type { Mood, Weather, Track, ChatMessage, LyricLine } from '../types';
import type { ExtractedPalette } from '../lib/colorExtract';
import { TRACKS, trackById } from '../data/tracks';

type PlayerState = {
  // ui
  view: 'home' | 'discover';
  immersive: boolean;
  chatOpen: boolean;
  nowPlayingOpen: boolean;
  navOpen: boolean;
  // 当前封面取色快照（mesh 背景交叉淡入用）
  palette: ExtractedPalette | null;

  // queue
  queue: string[];        // track ids
  currentIndex: number;   // -1 if none
  isPlaying: boolean;
  progress: number;       // seconds
  duration: number;       // seconds
  volume: number;         // 0..1

  // context
  mood: Mood;
  weather: Weather;
  city: string;
  temperatureC: number;

  // chat
  messages: ChatMessage[];

  // 本地导入的曲目
  importedTracks: Track[];

  // 远程音源（网易云等）搜索到的曲目，仅用于解析当前播放
  remoteTracks: Track[];

  // 当前曲目播放失败提示（远程音源不可用时）
  audioError: string | null;

  // 用户自定义歌词（覆盖 track.lyrics）
  customLyrics: Record<string, LyricLine[]>;

  // ----- actions -----
  playTrack: (id: string, queue?: string[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  setMood: (m: Mood) => void;
  setWeather: (w: Weather) => void;
  setProgress: (p: number) => void;
  setDuration: (d: number) => void;
  pushMessage: (m: ChatMessage) => void;
  addImportedTracks: (tracks: Track[]) => void;
  registerRemoteTracks: (tracks: Track[]) => void;
  setAudioError: (msg: string | null) => void;
  setView: (v: 'home' | 'discover') => void;
  setImmersive: (v: boolean) => void;
  setChatOpen: (v: boolean) => void;
  setNowPlayingOpen: (v: boolean) => void;
  setNavOpen: (v: boolean) => void;
  setPalette: (p: ExtractedPalette | null) => void;
  setLyrics: (trackId: string, lines: LyricLine[]) => void;
};

export const usePlayer = create<PlayerState>((set, get) => ({
  view: 'home',
  immersive: false,
  chatOpen: false,
  nowPlayingOpen: false,
  navOpen: false,
  palette: null,
  queue: TRACKS.map(t => t.id),
  currentIndex: -1,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: 0.8,

  mood: 'chill',
  weather: 'cloudy',
  city: '上海',
  temperatureC: 18,

  messages: [
    {
      id: 'm0',
      role: 'ai',
      text: '嗨，我是 Aurora。告诉我你现在的心情，或者你想听点什么风格的音乐？',
    },
  ],

  importedTracks: [],
  remoteTracks: [],
  audioError: null,
  customLyrics: {},

  playTrack: (id, queueOverride) => {
    const queue = queueOverride && queueOverride.length ? queueOverride : get().queue;
    const idx = queue.indexOf(id);
    if (idx === -1) return;
    set({ queue, currentIndex: idx, isPlaying: true, progress: 0, audioError: null });
  },
  togglePlay: () => {
    const { currentIndex, queue } = get();
    if (currentIndex === -1 && queue.length) {
      set({ currentIndex: 0, isPlaying: true });
    } else {
      set(s => ({ isPlaying: !s.isPlaying }));
    }
  },
  next: () => {
    const { queue, currentIndex } = get();
    if (!queue.length) return;
    const ni = (currentIndex + 1) % queue.length;
    set({ currentIndex: ni, isPlaying: true, progress: 0 });
  },
  prev: () => {
    const { queue, currentIndex } = get();
    if (!queue.length) return;
    const ni = (currentIndex - 1 + queue.length) % queue.length;
    set({ currentIndex: ni, isPlaying: true, progress: 0 });
  },
  seek: (sec) => set({ progress: sec }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
  setMood: (m) => set({ mood: m }),
  setWeather: (w) => set({ weather: w }),
  setProgress: (p) => set({ progress: p }),
  setDuration: (d) => set({ duration: d }),
  pushMessage: (m) => set(s => ({ messages: [...s.messages, m] })),
  addImportedTracks: (tracks) =>
    set(s => ({
      importedTracks: [...s.importedTracks, ...tracks],
      queue: [...s.queue, ...tracks.map(t => t.id)],
    })),
  registerRemoteTracks: (tracks) =>
    set(s => {
      const map = new Map(s.remoteTracks.map(t => [t.id, t]));
      for (const t of tracks) map.set(t.id, t);
      // 只保留最近 400 条，避免长时间搜索无限增长
      return { remoteTracks: Array.from(map.values()).slice(-400) };
    }),
  setAudioError: (msg) => set({ audioError: msg }),
  setView: (v) => set({ view: v }),
  setImmersive: (v) => set({ immersive: v }),
  setChatOpen: (v) => set({ chatOpen: v }),
  setNowPlayingOpen: (v) => set({ nowPlayingOpen: v }),
  setNavOpen: (v) => set({ navOpen: v }),
  setPalette: (p) => set({ palette: p }),
  setLyrics: (trackId, lines) =>
    set(s => ({ customLyrics: { ...s.customLyrics, [trackId]: lines } })),
}));

// 派生：当前 track
export function useCurrentTrack(): Track | null {
  const { queue, currentIndex, importedTracks, remoteTracks } = usePlayer();
  if (currentIndex < 0 || currentIndex >= queue.length) return null;
  const id = queue[currentIndex];
  return (
    trackById(id) ??
    importedTracks.find(t => t.id === id) ??
    remoteTracks.find(t => t.id === id) ??
    null
  );
}
