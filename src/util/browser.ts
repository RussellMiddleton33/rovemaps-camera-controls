export const browser = {
  now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  reducedMotion: () =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

export function raf(callback: FrameRequestCallback): number {
  if (typeof window === 'undefined') return -1 as unknown as number;
  return window.requestAnimationFrame(callback);
}

export function caf(handle: number) {
  if (typeof window === 'undefined') return;
  window.cancelAnimationFrame(handle);
}

