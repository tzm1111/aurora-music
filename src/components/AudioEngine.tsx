import { useEffect, useRef, useCallback } from 'react';
import { usePlayer, useCurrentTrack } from '../store/usePlayer';
import { connectAudioElement, resumeContext } from '../lib/audioVisualizer';
import { API_BASE, resolveAudioSource } from '../services/api';
import { generateDemoTrack, trackIdToSeed } from '../lib/demoAudio';

const synthCache = new Map<string, string>();
function synthUrl(id: string, duration: number) {
  let url = synthCache.get(id);
  if (!url) {
    url = generateDemoTrack(trackIdToSeed(id), Math.min(duration || 45, 60));
    synthCache.set(id, url);
    if (synthCache.size > 12) {
      const oldest = synthCache.keys().next().value!;
      URL.revokeObjectURL(synthCache.get(oldest)!);
      synthCache.delete(oldest);
    }
  }
  return url;
}

export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const generation = useRef(0);
  const failures = useRef(0);
  const restoringPosition = useRef(false);
  const current = useCurrentTrack();
  const trackId = current?.id;
  const trackSrc = current?.src;
  const trackDuration = current?.duration ?? 0;
  const isDemo = current?.tags.includes('demo') ?? false;
  const isPlaying = usePlayer(s => s.isPlaying);
  const volume = usePlayer(s => s.volume);
  const playRequest = usePlayer(s => s.playRequest);
  const seekRequest = usePlayer(s => s.seekRequest);
  const libraryReady = usePlayer(s => s.libraryReady);
  const playbackStatus = usePlayer(s => s.playbackStatus);

  const failPlayback = useCallback((message: string) => {
    const state = usePlayer.getState();
    if (state.djActive && failures.current < 3 && state.currentIndex < state.queue.length - 1) {
      failures.current++; state.next(); return;
    }
    usePlayer.setState({ isPlaying: false, playbackStatus: 'error', audioError: message });
  }, []);

  const startPlayback = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.getAttribute('src') || !usePlayer.getState().isPlaying) return;
    const ticket = generation.current;
    usePlayer.setState({ playbackStatus: 'loading' });
    try { connectAudioElement(el); resumeContext(); } catch { /* 不支持频谱时仍可播放 */ }
    el.play().catch(error => {
      if (ticket !== generation.current || error.name === 'AbortError' || !usePlayer.getState().isPlaying) return;
      usePlayer.setState({ isPlaying: false, playbackStatus: 'error', audioError: error.name === 'NotAllowedError' ? '浏览器暂未允许播放，请点击重试。' : '无法开始播放，请检查音频或网络后重试。' });
    });
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !libraryReady) return;
    generation.current++;
    if (!trackId) {
      el.pause(); el.removeAttribute('src'); el.load();
      usePlayer.setState({ isPlaying: false, playbackStatus: 'idle' });
      return;
    }
    usePlayer.getState().setAudioError(null);
    // 只有明确标注的演示环境音才合成，真实曲目失败不会替换成另一段音频。
    const url = trackSrc || (isDemo ? synthUrl(trackId, trackDuration) : null);
    if (!url) {
      usePlayer.setState({ isPlaying: false, playbackStatus: 'error', audioError: '这首歌还没有音频文件，请重新导入或搜索原曲。' });
      el.removeAttribute('src'); el.load(); return;
    }
    const ticket = generation.current;
    const ctrl = new AbortController();
    el.pause(); el.removeAttribute('src'); el.load();
    restoringPosition.current = true;
    usePlayer.setState({ duration: 0 });
    if (API_BASE && url.startsWith('/api/')) {
      el.crossOrigin = 'anonymous';
      resolveAudioSource(url, ctrl.signal).then(src => {
        if (ctrl.signal.aborted || ticket !== generation.current) return;
        el.src = src; el.load(); startPlayback();
      }).catch(error => { if (!ctrl.signal.aborted) failPlayback(error.message || '音频连接失败'); });
    } else { el.src = url; el.load(); }
    return () => ctrl.abort();
  }, [trackId, trackSrc, trackDuration, isDemo, playRequest, libraryReady, startPlayback, failPlayback]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !trackId || !libraryReady || !el.getAttribute('src')) return;
    if (!isPlaying) { el.pause(); return; }
    startPlayback();
  }, [isPlaying, trackId, trackSrc, playRequest, libraryReady, startPlayback]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => {
    const el = audioRef.current;
    if (el && el.readyState >= 1) el.currentTime = usePlayer.getState().progress;
  }, [seekRequest]);

  // 缓冲不能无限等待；暂停请求后让重试重新发起加载。
  useEffect(() => {
    if (playbackStatus !== 'loading' && playbackStatus !== 'buffering') return;
    const timer = setTimeout(() => {
      audioRef.current?.pause();
      failPlayback('音频加载超时，请重试或换一首。');
    }, 15000);
    return () => clearTimeout(timer);
  }, [playbackStatus, trackId, playRequest, failPlayback]);

  // 支持的浏览器中，耳机与系统媒体键也可控制播放。
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    if (current) session.metadata = new MediaMetadata({ title: current.title, artist: current.artist,
      album: current.album, artwork: [{ src: current.cover }] });
    else session.metadata = null;
    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => { if (!usePlayer.getState().isPlaying) usePlayer.getState().togglePlay(); },
      pause: () => { if (usePlayer.getState().isPlaying) usePlayer.getState().togglePlay(); },
      nexttrack: () => usePlayer.getState().next(), previoustrack: () => usePlayer.getState().prev(),
      seekto: details => { if (details.seekTime !== undefined) usePlayer.getState().seek(details.seekTime); },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { session.setActionHandler(action as MediaSessionAction, handler!); } catch { /* 按能力降级 */ }
    }
    return () => { for (const action of Object.keys(handlers)) { try { session.setActionHandler(action as MediaSessionAction, null); } catch { /* 按能力降级 */ } } };
  }, [current]);

  const fail = () => {
    const code = audioRef.current?.error?.code;
    failPlayback(code === 2
      ? '音频连接中断，请检查网络后重试。'
      : code === 3 ? '这个音频文件无法解码，请尝试其他格式。'
      : '当前音源不可用，可能受版权、会员或格式限制。可以重试或换一首。');
  };
  return <audio ref={audioRef} preload="metadata"
    onLoadedMetadata={e => {
      const el = e.currentTarget;
      usePlayer.getState().setDuration(el.duration);
      const position = usePlayer.getState().progress;
      if (position > 0 && Number.isFinite(el.duration)) el.currentTime = Math.min(position, Math.max(0, el.duration - 0.05));
      restoringPosition.current = false;
    }}
    onTimeUpdate={e => { if (!restoringPosition.current && e.currentTarget.readyState >= 1) usePlayer.getState().setProgress(e.currentTarget.currentTime); }}
    onDurationChange={e => usePlayer.getState().setDuration(e.currentTarget.duration)}
    onPlaying={() => { failures.current = 0; usePlayer.setState({ playbackStatus: 'playing' }); }}
    onWaiting={() => { if (usePlayer.getState().isPlaying) usePlayer.setState({ playbackStatus: 'buffering' }); }}
    onStalled={() => { if (usePlayer.getState().isPlaying) usePlayer.setState({ playbackStatus: 'buffering' }); }}
    onEnded={() => usePlayer.getState().trackEnded()}
    onError={fail} />;
}
