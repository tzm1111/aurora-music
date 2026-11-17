import { useEffect, useRef } from 'react';
import { usePlayer, useCurrentTrack } from '../store/usePlayer';
import { connectAudioElement, resumeContext } from '../lib/audioVisualizer';
import { generateDemoTrack, trackIdToSeed } from '../lib/demoAudio';

// 缓存已生成的合成音频 Blob URL，避免重复生成
const synthCache = new Map<string, string>();

function getOrCreateSynth(trackId: string, duration: number): string {
  if (synthCache.has(trackId)) return synthCache.get(trackId)!;
  const url = generateDemoTrack(trackIdToSeed(trackId), Math.min(duration || 45, 60));
  synthCache.set(trackId, url);
  return url;
}

/**
 * 隐形 audio 引擎：
 * - 把 store 中的 currentTrack / isPlaying / volume / seek 与 <audio> 同步
 * - 外部音频加载失败时自动回退到本地合成音
 */
export function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const current = useCurrentTrack();
  const isPlaying = usePlayer(s => s.isPlaying);
  const volume = usePlayer(s => s.volume);
  const progress = usePlayer(s => s.progress);
  const setProgress = usePlayer(s => s.setProgress);
  const setDuration = usePlayer(s => s.setDuration);
  const setAudioError = usePlayer(s => s.setAudioError);
  const next = usePlayer(s => s.next);
  // 切歌：优先用 track.src（远程/本地导入），否则用合成音
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !current) return;
    setAudioError(null);
    const url = current.src || getOrCreateSynth(current.id, current.duration);
    el.src = url;
    el.load();
    if (usePlayer.getState().isPlaying) {
      el.play().catch(() => {});
    }
  }, [current?.id, current?.src]);

  // 外部音频加载失败 → 本地曲目回退合成音；远程音源直接提示
  const onError = () => {
    const el = audioRef.current;
    if (!current || !el) return;

    if (current.source === 'netease' || current.source === 'qq') {
      setAudioError(`「${current.title}」暂时无法播放，可能受版权或会员限制`);
      usePlayer.setState({ isPlaying: false });
      return;
    }

    // 已经是合成音的 blob: URL，不再重试
    if (el.src.startsWith('blob:')) return;
    const url = getOrCreateSynth(current.id, current.duration);
    el.src = url;
    el.load();
    if (usePlayer.getState().isPlaying) {
      el.play().catch(() => {});
    }
  };

  // 播放/暂停
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      resumeContext();
      try { connectAudioElement(el); } catch (_) {}
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isPlaying]);

  // 音量
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
  }, [volume]);

  // seek
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (Math.abs(el.currentTime - progress) > 0.6) {
      el.currentTime = progress;
    }
  }, [progress]);

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setProgress((e.target as HTMLAudioElement).currentTime)}
        onDurationChange={(e) => setDuration((e.target as HTMLAudioElement).duration || 0)}
        onEnded={() => next()}
        onError={onError}
        preload="metadata"
      />

    </>
  );
}
