import { apiRequest } from '../services/api';
import type { DJResult } from '../services/api';
import { usePlayer, resolveTrack } from '../store/usePlayer';
import { dedupeSongs } from '../../shared/djDiversity.js';
import { connectAudioElement, resumeContext } from './audioVisualizer';
let generation = 0;
let request: AbortController | null = null;
function recentTracks(state: ReturnType<typeof usePlayer.getState>) {
  const ids = [...new Set([...state.queue.slice(Math.max(0, state.currentIndex)), ...[...state.djSeen].reverse(), ...state.djPlaylists.slice(0, 5).flatMap(playlist => playlist.trackIds)])].slice(0, 100);
  return ids.flatMap(id => { const track = resolveTrack(state, id); return track ? [{ title: track.title, artist: track.artist }] : []; });
}
function unlockAudio() {
  // 在用户点击时解锁音频，推荐的异步请求结束后也能自动开始。
  const el = document.querySelector('audio');
  if (el) { try { connectAudioElement(el); resumeContext(); } catch { /* 无频谱也可听音乐 */ } }
}
export async function startDJ(description: string, adjustment = false) {
  if (!description.trim()) return false;
  unlockAudio();
  const ticket = ++generation;
  request?.abort(); request = new AbortController();
  const previous = usePlayer.getState();
  usePlayer.setState({ djBusy: true, djError: null, djRefillNotice: null });
  try {
    const result = await apiRequest<DJResult>('/api/dj/session', { description, previous: adjustment ? previous.djPlan : null,
      excludeIds: previous.djSeen, recentTracks: recentTracks(previous), offset: adjustment && /换一批|换种|换一种/.test(description) ? previous.djOffset + 12 : 0 }, request.signal);
    if (ticket !== generation) return false;
    const state = usePlayer.getState();
    const tracks = dedupeSongs(result.tracks, recentTracks(state));
    if (!tracks.length) throw new Error('暂时没找到不重复的新歌，请换个描述再试。');
    state.registerRemoteTracks(tracks);
    const ids = tracks.map(t => t.id);
    if (adjustment && state.isPlaying && state.currentIndex >= 0) {
      const currentId = state.queue[state.currentIndex];
      usePlayer.setState({ queue: [currentId, ...ids.filter(id => id !== currentId)], currentIndex: 0 });
    } else state.playTrack(ids[0], ids);
    usePlayer.setState({ djActive: true, djPlan: result.plan, djMode: result.mode, repeat: 'off', shuffle: false,
      djSeen: [...new Set([...previous.djSeen, ...ids])].slice(-80), djOffset: adjustment ? previous.djOffset + 12 : 0 });
    usePlayer.getState().saveDJPlaylist(result.plan, result.mode, ids);
    return true;
  } catch (error) {
    if (ticket !== generation || request?.signal.aborted) return false;
    usePlayer.setState({ djError: error instanceof Error ? error.message : 'DJ 暂时无法选歌，请重试。' });
    return false;
  } finally { if (ticket === generation) usePlayer.setState({ djBusy: false }); }
}
export async function refillDJ() {
  const state = usePlayer.getState();
  if (!state.djActive || !state.djPlan || state.djBusy) return;
  const ticket = generation;
  const description = state.djPlan.description;
  const plan = state.djPlan;
  usePlayer.setState({ djBusy: true });
  try {
    const recent = recentTracks(state);
    const result = await apiRequest<DJResult>('/api/dj/session', { description, previous: plan, excludeIds: state.djSeen, recentTracks: recent, offset: state.djOffset + 12 });
    const latest = usePlayer.getState();
    if (ticket !== generation || !latest.djActive || latest.djPlan !== plan) return;
    const tracks = dedupeSongs(result.tracks, recentTracks(latest));
    latest.registerRemoteTracks(tracks);
    const ids = tracks.map(t => t.id).filter(id => !latest.queue.includes(id));
    const wasAtEnd = latest.djWaitingAtEnd;
    const trim = Math.max(0, latest.currentIndex - 10);
    usePlayer.setState({ queue: [...latest.queue.slice(trim), ...ids], currentIndex: latest.currentIndex - trim, djOffset: latest.djOffset + 12,
      djSeen: [...new Set([...latest.djSeen, ...ids])].slice(-80), djRefillNotice: ids.length ? null : '暂时没找到新歌，可点击换一批。' });
    if (wasAtEnd && ids.length) usePlayer.getState().next();
  } catch {
    if (ticket === generation) usePlayer.setState({ djRefillNotice: '下一段音乐暂未准备好，当前歌曲照常播放。可点击换一批重试。' });
  } finally { if (ticket === generation) usePlayer.setState({ djBusy: false }); }
}
export function stopDJ() {
  generation++; request?.abort();
  usePlayer.setState({ djActive: false, djBusy: false, djWaitingAtEnd: false, isPlaying: false, playbackStatus: 'paused' });
}

export function watchDJQueue() {
  const prepare = () => {
    const s = usePlayer.getState();
    if (s.djActive && s.djPlan && !s.djBusy && !s.djRefillNotice && s.queue.length - s.currentIndex - 1 <= 2) void refillDJ();
  };
  const unsubscribe = usePlayer.subscribe(prepare);
  prepare();
  return unsubscribe;
}
