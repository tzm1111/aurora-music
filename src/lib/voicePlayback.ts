import { usePlayer } from '../store/usePlayer';
import { startVoiceInput } from './voiceInput';
import type { RecognitionConstructor, VoiceCallbacks, VoiceSession } from './voiceInput';

function pauseForVoice() {
  const before = usePlayer.getState();
  const id = before.queue[before.currentIndex];
  let eligible = before.isPlaying && Boolean(id);
  let finished = false;
  // 直接暂停正在发声的元素，不等待 React 完成下一次渲染。
  if (typeof document !== 'undefined') document.querySelector('audio')?.pause();
  if (before.isPlaying) usePlayer.setState({ isPlaying: false, playbackStatus: 'paused', djWaitingAtEnd: false });
  const unsubscribe = usePlayer.subscribe(state => {
    if (state.queue[state.currentIndex] !== id || state.playRequest !== before.playRequest || state.isPlaying || state.playbackStatus === 'error' || (before.djActive && !state.djActive)) eligible = false;
  });
  return () => {
    if (finished) return;
    finished = true; unsubscribe();
    const state = usePlayer.getState();
    if (eligible && !state.isPlaying && state.playbackStatus === 'paused' && state.queue[state.currentIndex] === id && state.playRequest === before.playRequest) state.togglePlay();
  };
}

// 麦克风关闭后恢复原曲；原先已暂停或录音期间主动切歌/操作过播放时不代替用户决定。
export function startPlayerVoiceInput(callbacks: VoiceCallbacks, Constructor?: RecognitionConstructor): VoiceSession | null {
  const resume = pauseForVoice();
  const session = startVoiceInput({ ...callbacks, onListening: value => { if (!value) resume(); callbacks.onListening(value); } }, Constructor);
  if (!session) resume();
  return session;
}
