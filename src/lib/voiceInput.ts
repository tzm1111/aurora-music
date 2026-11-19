// 浏览器语音识别：不保存录音，结果留在输入框由用户确认。
type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
export interface VoiceRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  processLocally?: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionConstructor = { new (): VoiceRecognition; available?: (options: { langs: string[]; processLocally: boolean }) => Promise<string> };
type VoiceBrowser = { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
export function voiceRecognitionConstructor(): RecognitionConstructor | undefined {
  const browser = globalThis as VoiceBrowser;
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}
export type VoiceSession = { stop: () => void; abort: () => void };
export type VoicePhase = 'idle' | 'starting' | 'listening';
export function startVoiceInput(callbacks: { onText: (text: string) => void; onListening: (value: boolean) => void; onError: (message: string) => void; onPhase?: (phase: VoicePhase) => void }, Constructor = voiceRecognitionConstructor()): VoiceSession | null {
  if (globalThis.isSecureContext === false) {
    callbacks.onError('语音需要 HTTPS 页面，请通过正式网站地址打开播放器。');
    return null;
  }
  const policy = typeof document === 'undefined' ? undefined : (document as Document & { permissionsPolicy?: { allowsFeature: (feature: string) => boolean } }).permissionsPolicy;
  if (policy && !policy.allowsFeature('microphone')) {
    callbacks.onError('当前内嵌页面无法使用麦克风，请在手机浏览器中打开播放器；也可用键盘上的语音输入。');
    return null;
  }
  if (!Constructor) {
    callbacks.onError('当前浏览器不支持网页语音识别。可点输入框，用手机键盘上的麦克风说话。');
    return null;
  }
  let recognition: VoiceRecognition;
  try { recognition = new Constructor(); }
  catch { callbacks.onError('无法开启语音输入，请检查浏览器麦克风权限。'); return null; }
  let cancelled = false;
  let heard = false;
  let failed = false;
  let ended = false;
  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = true;
  const finish = () => {
    if (ended) return;
    ended = true; clearTimeout(timer);
    callbacks.onListening(false); callbacks.onPhase?.('idle');
  };
  const abortRecognition = () => { try { recognition.abort(); } catch { /* 部分手机浏览器在识别已结束后会抛异常。 */ } };
  const stopRecording = () => {
    if (cancelled || ended) return;
    if (!started) { cancelled = true; finish(); abortRecognition(); return; }
    try { recognition.stop(); } catch { finish(); }
    if (!ended) { clearTimeout(timer); timer = setTimeout(finish, 3000); }
  };
  recognition.onstart = () => {
    if (cancelled || ended) return;
    started = true;
    clearTimeout(timer);
    callbacks.onPhase?.('listening'); callbacks.onListening(true);
    timer = setTimeout(stopRecording, 30000);
  };
  recognition.onresult = event => {
    if (cancelled || failed || ended) return;
    const text = Array.from(event.results).map(result => result[0]?.transcript || '').join('').trim();
    if (text) { heard = true; callbacks.onText(text); }
  };
  recognition.onerror = event => {
    if (cancelled || ended) return;
    failed = true;
    finish();
    const messages: Record<string, string> = {
      'not-allowed': '麦克风未获授权，请在浏览器中允许麦克风后重试。',
      'service-not-allowed': '浏览器未允许语音识别服务，请改用 Chrome 或 Edge。',
      'audio-capture': '未找到可用麦克风，请检查麦克风连接。',
      'no-speech': '没有听清，再说一次吧。',
      network: '浏览器的语音识别服务连接失败。可点输入框，使用手机键盘的语音输入。',
    };
    if (event.error !== 'aborted') callbacks.onError(messages[event.error] || '语音输入暂时不可用，请重试或直接打字。');
  };
  recognition.onend = () => {
    if (cancelled || ended) return;
    finish();
    if (!heard && !failed) callbacks.onError('没有听清，再说一次吧。');
  };
  const start = () => {
    if (cancelled || ended) return;
    try { recognition.start(); }
    catch { failed = true; finish(); callbacks.onError('无法开启语音输入，请检查浏览器麦克风权限。'); }
  };
  callbacks.onPhase?.('starting');
  timer = setTimeout(() => {
    if (ended) return;
    cancelled = true; finish(); abortRecognition();
    callbacks.onError('麦克风未能启动，请检查权限，或使用手机键盘的语音输入。');
  }, 10000);
  // Safari/WebKit 必须在点击回调中同步启动，不能先等待权限查询。
  // 支持本机识别的浏览器只使用已安装语言，不自动下载模型。
  if (Constructor.available && 'processLocally' in recognition && (!policy || policy.allowsFeature('on-device-speech-recognition'))) {
    Constructor.available({ langs: ['zh-CN'], processLocally: true }).then(availability => {
      if (availability === 'available') recognition.processLocally = true;
      start();
    }).catch(start);
  } else start();
  if (failed) return null;
  return {
    stop: stopRecording,
    abort: () => { cancelled = true; finish(); recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.onstart = null; abortRecognition(); },
  };
}
