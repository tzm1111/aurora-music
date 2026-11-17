import type { Track, Playlist } from '../types';

// picsum 封面（国内可访问）
const cover = (seed: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`;

/* ──── 曲库 ──── */
export const TRACKS: Track[] = [];

/* ──── 歌单 ──── */
export const PLAYLISTS: Playlist[] = [
  { id: 'p1', name: '今日精选', description: '根据你的天气和心情智能挑选',
    cover: cover('today'), trackIds: [] },
  { id: 'p2', name: '我的歌单', description: '导入歌曲后展示在这里',
    cover: cover('my-playlist'), trackIds: [] },
];

export function trackById(id: string): Track | undefined {
  return TRACKS.find(t => t.id === id);
}
