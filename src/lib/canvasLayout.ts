// 使用布局尺寸，避免播放器展开动画的 CSS transform 污染画布坐标。
export function fitCanvas(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  return { width, height };
}

export function ringGeometry(width: number, height: number, coverRadius: number, maxAmplitude = 56) {
  const cx = width / 2, cy = height / 2;
  const limit = Math.max(0, Math.min(cx, cy) - 8);
  const baseRadius = Math.min(Math.max(0, coverRadius) + 10, limit);
  return { cx, cy, baseRadius, amplitude: Math.max(0, Math.min(maxAmplitude, limit - baseRadius)) };
}
