// 浏览器语音识别：不保存录音，结果留在输入框由用户确认。
type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
export interface VoiceRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionConstructor = new () => VoiceRecognition;
type VoiceBrowser = { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
export function voiceRecognitionConstructor(): RecognitionConstructor | undefined {
  const browser = globalThis as VoiceBrowser;
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}
export type VoiceSession = { stop: () => void; abort: () => void };
export function startVoiceInput(callbacks: { onText: (text: string) => void; onListening: (value: boolean) => void; onError: (message: string) => void }, Constructor = voiceRecognitionConstructor()): VoiceSession | null {
  if (!Constructor) {
    callbacks.onError('当前浏览器不支持语音输入，请使用 Chrome 或 Edge，或直接打字。');
    return null;
  }
  const recognition = new Constructor();
  let cancelled = false;
  let heard = false;
  let failed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.onresult = event => {
    if (cancelled || failed) return;
    const text = Array.from(event.results).map(result => result[0]?.transcript || '').join('').trim();
    if (text) { heard = true; callbacks.onText(text); }
  };
  recognition.onerror = event => {
    if (cancelled) return;
    failed = true;
    clearTimeout(timer);
    callbacks.onListening(false);
    const messages: Record<string, string> = {
      'not-allowed': '麦克风未获授权，请在浏览器中允许麦克风后重试。',
      'service-not-allowed': '浏览器未允许语音识别服务，请改用 Chrome 或 Edge。',
      'audio-capture': '未找到可用麦克风，请检查麦克风连接。',
      'no-speech': '没有听清，再说一次吧。',
      network: '语音识别连接失败，请检查网络或直接打字。',
    };
    if (event.error !== 'aborted') callbacks.onError(messages[event.error] || '语音输入暂时不可用，请重试或直接打字。');
  };
  recognition.onend = () => {
    clearTimeout(timer);
    if (cancelled) return;
    callbacks.onListening(false);
    if (!heard && !failed) callbacks.onError('没有听清，再说一次吧。');
  };
  try {
    recognition.start(); callbacks.onListening(true);
    timer = setTimeout(() => {
      cancelled = true; recognition.abort(); callbacks.onListening(false);
      if (!heard) callbacks.onError('没有听清，再说一次吧。');
    }, 30000);
  }
  catch { callbacks.onError('无法开启语音输入，请检查浏览器麦克风权限。'); return null; }
  return {
    stop: () => { if (!cancelled) recognition.stop(); },
    abort: () => { cancelled = true; clearTimeout(timer); recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); },
  };
}
