/**
 * 单例 AudioContext + AnalyserNode
 * 把 <audio> 元素作为源连接进来，让任意组件都能读 frequencyData/timeDomainData
 */

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let connectedEl: HTMLAudioElement | null = null;
let source: MediaElementAudioSourceNode | null = null;

function ensure(): { ctx: AudioContext; analyser: AnalyserNode } {
  if (!ctx) {
    const AC: typeof AudioContext =
      window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
    ctx = new AC();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;        // 256 个频段
    analyser.smoothingTimeConstant = 0.78;
    analyser.connect(ctx.destination);
  }
  return { ctx: ctx!, analyser: analyser! };
}

/** 把 audio 元素连接到 analyser（同一 element 只会连一次） */
export function connectAudioElement(el: HTMLAudioElement) {
  const { ctx, analyser } = ensure();
  if (connectedEl === el && source) return;
  // 同一 audio 元素只能创建一次 MediaElementSource
  if (source && connectedEl !== el) {
    try { source.disconnect(); } catch { /* 已断开的节点无需再次处理 */ }
  }
  if (connectedEl !== el) {
    source = ctx.createMediaElementSource(el);
    source.connect(analyser);
    connectedEl = el;
  }
}

/** 用户首次交互后才能 resume */
export function resumeContext() {
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

export function getAnalyser(): AnalyserNode | null {
  return analyser;
}
