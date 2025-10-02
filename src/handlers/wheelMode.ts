export type WheelMode = 'trackpad' | 'wheel';

export class WheelClassifier {
  private lastTs = 0;
  private mode: WheelMode | null = null;
  private readonly hysteresis = 150; // ms

  classify(evt: WheelEvent): WheelMode {
    const now = performance.now();
    const dt = now - this.lastTs;
    this.lastTs = now;
    // Heuristic:
    // - deltaMode 0 (pixel) and small |deltaY| suggests trackpad
    // - frequent events (dt < 30ms) also suggest trackpad
    // - deltaMode 1 (line) or large deltas suggest wheel
    const absDY = Math.abs(evt.deltaY);
    let guess: WheelMode = 'wheel';
    if (evt.deltaMode === 0 && (absDY < 6 || dt < 30)) guess = 'trackpad';
    if (evt.deltaMode === 1) guess = 'wheel';

    // Simple hysteresis to stabilize
    if (this.mode === null) {
      this.mode = guess;
    } else if (this.mode !== guess && dt > this.hysteresis) {
      this.mode = guess;
    }
    return this.mode!;
  }
}

