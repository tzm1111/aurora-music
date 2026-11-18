import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import type { Mood, Weather, Track, ChatMessage, LyricLine, Playlist } from '../types';
import type { DJPlan } from '../services/api';
import type { ExtractedPalette } from '../lib/colorExtract';
import { TRACKS, trackById } from '../data/tracks';
import { loadAudioFile } from '../lib/localLibrary';

export type PlayerView = 'home' | 'search' | 'discover' | 'library' | 'favorites' | 'playlists' | 'djplaylists';
export type DJPlaylist = { id: string; name: string; createdAt: number; plan: DJPlan; mode: 'ai' | 'rules'; trackIds: string[] };
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'buffering' | 'error';
export type RepeatMode = 'off' | 'all' | 'one';

type PlayerState = {
  view: PlayerView;
  immersive: boolean;
  chatOpen: boolean;
  nowPlayingOpen: boolean;
  navOpen: boolean;
  queueOpen: boolean;
  palette: ExtractedPalette | null;
  queue: string[];
  currentIndex: number;
  isPlaying: boolean;
  playbackStatus: PlaybackStatus;
  playRequest: number;
  progress: number;
  seekRequest: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  shuffledPlayed: string[];
  favoriteIds: string[];
  playlists: Playlist[];
  activePlaylistId: string | null;
  libraryReady: boolean;
  storageError: string | null;
  djActive: boolean;
  djPlan: DJPlan | null;
  djMode: 'ai' | 'rules';
  djBusy: boolean;
  djError: string | null;
  djOffset: number;
  djSeen: string[];
  djRefillNotice: string | null;
  djWaitingAtEnd: boolean;
  djPlaylists: DJPlaylist[];
  saveDJPlaylist: (plan: DJPlan, mode: 'ai' | 'rules', trackIds: string[]) => void;
  mood: Mood;
  weather: Weather;
  city: string;
  temperatureC: number;
  messages: ChatMessage[];
  importedTracks: Track[];
  remoteTracks: Track[];
  audioError: string | null;
  customLyrics: Record<string, LyricLine[]>;
  playTrack: (id: string, queue?: string[]) => void;
  togglePlay: () => void;
  retry: () => void;
  next: () => void;
  prev: () => void;
  trackEnded: () => void;
  seek: (sec: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  toggleFavorite: (id: string) => void;
  enqueue: (id: string, next?: boolean) => void;
  removeFromQueue: (index: number) => void;
  moveInQueue: (from: number, to: number) => void;
  createPlaylist: (name: string) => string;
  addToPlaylist: (playlistId: string, trackId: string) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  renamePlaylist: (playlistId: string, name: string) => void;
  deletePlaylist: (playlistId: string) => void;
  openPlaylist: (id: string) => void;
  setMood: (m: Mood) => void;
  setWeather: (w: Weather) => void;
  setProgress: (p: number) => void;
  setDuration: (d: number) => void;
  pushMessage: (m: ChatMessage) => void;
  addImportedTracks: (tracks: Track[]) => void;
  registerRemoteTracks: (tracks: Track[]) => void;
  setAudioError: (msg: string | null) => void;
  setView: (v: PlayerView) => void;
  setImmersive: (v: boolean) => void;
  setChatOpen: (v: boolean) => void;
  setNowPlayingOpen: (v: boolean) => void;
  setNavOpen: (v: boolean) => void;
  setQueueOpen: (v: boolean) => void;
  setPalette: (p: ExtractedPalette | null) => void;
  setLyrics: (trackId: string, lines: LyricLine[]) => void;
};

// 进度变化最多每秒落盘一次，离开页面时立即保存最后状态。
let pendingSave: [string, string] | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function flushSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  if (!pendingSave) return;
  try { localStorage.setItem(...pendingSave); }
  catch { usePlayer.setState({ storageError: '无法保存到此浏览器，请检查存储空间或隐私设置。' }); }
  pendingSave = null;
}
const storage: StateStorage = {
  getItem: name => { try { return localStorage.getItem(name); } catch { return null; } },
  setItem: (name, value) => {
    pendingSave = [name, value];
    saveTimer ??= setTimeout(flushSave, 1000);
  },
  removeItem: name => localStorage.removeItem(name),
};
if (typeof window !== 'undefined') window.addEventListener('pagehide', flushSave);

export function resolveTrack(s: Pick<PlayerState, 'importedTracks' | 'remoteTracks'>, id: string): Track | null {
  return trackById(id) ?? s.importedTracks.find(t => t.id === id) ?? s.remoteTracks.find(t => t.id === id) ?? null;
}
function chooseNext(s: PlayerState): number {
  if (s.shuffle && s.queue.length > 1) {
    const offset = 1 + Math.floor(Math.random() * (s.queue.length - 1));
    return (Math.max(0, s.currentIndex) + offset) % s.queue.length;
  }
  return (s.currentIndex + 1) % s.queue.length;
}
function stripBlob(t: Track): Track {
  return t.src?.startsWith('blob:') ? { ...t, src: undefined } : t;
}

export const usePlayer = create<PlayerState>()(persist((set, get) => ({
  view: 'home', immersive: false, chatOpen: false, nowPlayingOpen: false, navOpen: false,
  queueOpen: false, palette: null, queue: TRACKS.map(t => t.id), currentIndex: -1,
  isPlaying: false, playbackStatus: 'idle', playRequest: 0, progress: 0, seekRequest: 0,
  duration: 0, volume: 0.8, shuffle: false, repeat: 'all', shuffledPlayed: [], favoriteIds: [], playlists: [],
  activePlaylistId: null, libraryReady: false, storageError: null,
  djActive: false, djPlan: null, djMode: 'rules', djBusy: false, djError: null, djOffset: 0, djSeen: [], djRefillNotice: null, djWaitingAtEnd: false, djPlaylists: [],
  saveDJPlaylist: (plan, mode, trackIds) => set(s => ({ djPlaylists: [{ id: crypto.randomUUID(), name: plan.label || '此刻的音乐', createdAt: Date.now(), plan: { ...plan, queries: [...plan.queries], excludeTerms: [...plan.excludeTerms] }, mode, trackIds: [...new Set(trackIds)] }, ...s.djPlaylists].slice(0, 50) })),
  mood: 'chill', weather: 'cloudy', city: '上海', temperatureC: 18,
  messages: [{ id: 'm0', role: 'ai', text: '嗨，我是 Aurora。告诉我你想听的歌手，或先搜索、导入自己的音乐。' }],
  importedTracks: [], remoteTracks: [], audioError: null, customLyrics: {},
  playTrack: (id, queueOverride) => {
    const s = get();
    if (!resolveTrack(s, id)) return;
    const queue = [...new Set(queueOverride?.length ? queueOverride : s.queue.includes(id) ? s.queue : [...s.queue, id])]
      .filter(trackId => resolveTrack(s, trackId));
    const idx = queue.indexOf(id);
    if (idx === -1) return;
    set({ queue, currentIndex: idx, isPlaying: true, playbackStatus: 'loading', progress: 0,
      duration: 0, audioError: null, djWaitingAtEnd: false, djActive: queueOverride ? false : s.djActive,
      shuffledPlayed: queueOverride ? [id] : [...new Set([...s.shuffledPlayed, id])], playRequest: s.playRequest + 1 });
  },
  togglePlay: () => {
    const s = get();
    if (!s.queue.length) return;
    if (s.isPlaying) set({ isPlaying: false, playbackStatus: 'paused', djWaitingAtEnd: false });
    else if (s.playbackStatus === 'error') s.retry();
    else set({ currentIndex: Math.max(0, s.currentIndex), isPlaying: true, playbackStatus: 'loading' });
  },
  retry: () => {
    if (get().currentIndex < 0) return;
    set(s => ({ isPlaying: true, playbackStatus: 'loading', audioError: null, playRequest: s.playRequest + 1 }));
  },
  next: () => {
    const s = get();
    if (!s.queue.length) return;
    s.playTrack(s.queue[chooseNext(s)]);
  },
  prev: () => {
    const s = get();
    if (!s.queue.length) return;
    s.playTrack(s.queue[(s.currentIndex - 1 + s.queue.length) % s.queue.length]);
  },
  trackEnded: () => {
    const s = get();
    if (s.repeat === 'one') { s.playTrack(s.queue[s.currentIndex]); return; }
    if (s.shuffle && s.repeat === 'off') {
      const remaining = s.queue.filter(id => !s.shuffledPlayed.includes(id));
      if (!remaining.length) { set({ isPlaying: false, playbackStatus: 'paused' }); return; }
      s.playTrack(remaining[Math.floor(Math.random() * remaining.length)]); return;
    }
    if (!s.shuffle && s.repeat === 'off' && s.currentIndex === s.queue.length - 1) {
      set({ isPlaying: false, playbackStatus: 'paused', djWaitingAtEnd: s.djActive }); return;
    }
    s.next();
  },
  seek: sec => set(s => ({ progress: Math.max(0, Math.min(s.duration || Number.MAX_SAFE_INTEGER, sec)), seekRequest: s.seekRequest + 1 })),
  setVolume: volume => set({ volume: Math.max(0, Math.min(1, volume)) }),
  toggleShuffle: () => set(s => ({ shuffle: !s.shuffle, shuffledPlayed: s.queue[s.currentIndex] ? [s.queue[s.currentIndex]] : [] })),
  cycleRepeat: () => set(s => ({ repeat: s.repeat === 'all' ? 'one' : s.repeat === 'one' ? 'off' : 'all' })),
  toggleFavorite: id => set(s => ({ favoriteIds: s.favoriteIds.includes(id) ? s.favoriteIds.filter(x => x !== id) : [...s.favoriteIds, id] })),
  enqueue: (id, playNext = false) => {
    const s = get();
    if (!resolveTrack(s, id)) return;
    if (s.queue[s.currentIndex] === id || (!playNext && s.queue.includes(id))) return;
    const currentId = s.queue[s.currentIndex];
    const queue = s.queue.filter(trackId => trackId !== id);
    const index = currentId ? queue.indexOf(currentId) : -1;
    queue.splice(playNext ? Math.max(0, index + 1) : queue.length, 0, id);
    set({ queue, currentIndex: index });
  },
  removeFromQueue: index => {
    const s = get();
    if (index < 0 || index >= s.queue.length) return;
    const queue = s.queue.filter((_, i) => i !== index);
    const removingCurrent = index === s.currentIndex;
    set({ queue, currentIndex: !queue.length ? -1 : removingCurrent ? Math.min(index, queue.length - 1) : s.currentIndex - Number(index < s.currentIndex),
      ...(removingCurrent ? { progress: 0, duration: 0, isPlaying: false, playbackStatus: 'paused' as const, audioError: null } : {}) });
  },
  moveInQueue: (from, to) => {
    const s = get();
    if (from < 0 || to < 0 || from >= s.queue.length || to >= s.queue.length) return;
    const currentId = s.queue[s.currentIndex];
    const queue = [...s.queue];
    queue.splice(to, 0, queue.splice(from, 1)[0]);
    set({ queue, currentIndex: currentId ? queue.indexOf(currentId) : -1 });
  },
  createPlaylist: rawName => {
    const id = crypto.randomUUID();
    const name = rawName.trim() || '新歌单';
    set(s => ({ playlists: [...s.playlists, { id, name, trackIds: [] }], activePlaylistId: id }));
    return id;
  },
  addToPlaylist: (playlistId, trackId) => set(s => ({ playlists: s.playlists.map(p => p.id === playlistId ? { ...p, trackIds: [...new Set([...p.trackIds, trackId])] } : p) })),
  removeFromPlaylist: (playlistId, trackId) => set(s => ({ playlists: s.playlists.map(p => p.id === playlistId ? { ...p, trackIds: p.trackIds.filter(id => id !== trackId) } : p) })),
  renamePlaylist: (playlistId, name) => { if (name.trim()) set(s => ({ playlists: s.playlists.map(p => p.id === playlistId ? { ...p, name: name.trim() } : p) })); },
  deletePlaylist: playlistId => set(s => ({ playlists: s.playlists.filter(p => p.id !== playlistId), activePlaylistId: s.activePlaylistId === playlistId ? null : s.activePlaylistId })),
  openPlaylist: id => set({ view: 'playlists', activePlaylistId: id, navOpen: false }),
  setMood: mood => set({ mood }), setWeather: weather => set({ weather }),
  setProgress: progress => set({ progress: Number.isFinite(progress) ? Math.max(0, progress) : 0 }),
  setDuration: duration => set({ duration: Number.isFinite(duration) ? Math.max(0, duration) : 0 }),
  pushMessage: message => set(s => ({ messages: [...s.messages, message].slice(-100) })),
  addImportedTracks: tracks => set(s => {
    const merged = new Map(s.importedTracks.map(t => [t.id, t]));
    tracks.forEach(t => merged.set(t.id, t));
    return { importedTracks: [...merged.values()], queue: [...new Set([...s.queue, ...tracks.map(t => t.id)])] };
  }),
  registerRemoteTracks: tracks => set(s => {
    const map = new Map(s.remoteTracks.map(t => [t.id, t]));
    tracks.forEach(t => map.set(t.id, t));
    const pinned = new Set([...s.queue, ...s.favoriteIds, ...s.playlists.flatMap(p => p.trackIds), ...s.djPlaylists.flatMap(p => p.trackIds)]);
    const unpinned = [...map.values()].filter(t => !pinned.has(t.id)).slice(-200);
    return { remoteTracks: [...map.values()].filter(t => pinned.has(t.id)).concat(unpinned) };
  }),
  setAudioError: audioError => set({ audioError }), setView: view => set({ view, navOpen: false }),
  setImmersive: immersive => set({ immersive }), setChatOpen: chatOpen => set({ chatOpen }),
  setNowPlayingOpen: nowPlayingOpen => set({ nowPlayingOpen }), setNavOpen: navOpen => set({ navOpen }),
  setQueueOpen: queueOpen => set({ queueOpen }), setPalette: palette => set({ palette }),
  setLyrics: (id, lines) => set(s => ({ customLyrics: { ...s.customLyrics, [id]: lines } })),
}), {
  name: 'aurora-player-v1', version: 1,
  storage: createJSONStorage(() => storage),
  partialize: s => ({ queue: s.queue, currentIndex: s.currentIndex, progress: s.progress, volume: s.volume,
    shuffle: s.shuffle, repeat: s.repeat, favoriteIds: s.favoriteIds, playlists: s.playlists, djPlaylists: s.djPlaylists,
    importedTracks: s.importedTracks.map(stripBlob), remoteTracks: s.remoteTracks,
    mood: s.mood, weather: s.weather, customLyrics: s.customLyrics }),
  merge: (persisted, current) => ({ ...current, ...(persisted as Partial<PlayerState>), isPlaying: false, playbackStatus: 'paused' }),
}));

export function useCurrentTrack(): Track | null {
  return usePlayer(s => s.currentIndex < 0 ? null : resolveTrack(s, s.queue[s.currentIndex]));
}
let hydration: Promise<void> | null = null;
export function hydrateLocalAudio(): Promise<void> {
  hydration ??= (async () => {
    try {
      const restored = await Promise.all(usePlayer.getState().importedTracks.map(async track => {
        if (track.source !== 'local' || track.src) return track;
        const blob = await loadAudioFile(track.id);
        return blob ? { ...track, src: URL.createObjectURL(blob) } : track;
      }));
      const map = new Map(restored.map(t => [t.id, t]));
      const merged = usePlayer.getState().importedTracks.map(t => map.get(t.id) ?? t);
      usePlayer.setState({ importedTracks: merged });
    } catch {
      usePlayer.setState({ storageError: '本地音频恢复失败，请检查浏览器存储或重新导入文件。' });
    } finally { usePlayer.setState({ libraryReady: true }); }
  })();
  return hydration;
}
