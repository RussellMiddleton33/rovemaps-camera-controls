import type { ITransform } from '../transform/interfaces';
import type { ICameraHelper } from '../helpers/icameraHelper';
import { on } from '../util/dom';
import { WheelClassifier, type WheelMode } from './wheelMode';
import type { HandlerDelta } from './types';

export interface ScrollZoomOptions {
  // Max zoom change per wheel event (MapLibre limits per frame); tuned small for smoothness
  maxDeltaPerEvent?: number;
  preventDefault?: boolean;
  around?: 'center' | 'pointer';
  onWheelModeChange?: (mode: WheelMode) => void;
  onChange?: (delta: HandlerDelta) => void;
  cooperative?: boolean; // require ctrl/meta to zoom via wheel to avoid hijacking page scroll
  onCoopGestureHint?: (req: { type: 'pinch' | 'rotate' }) => void;
  zoomSign?: 1 | -1; // invert zoom direction if needed
}

export class ScrollZoomHandler {
  private readonly el: HTMLElement;
  private readonly transform: ITransform;
  private readonly helper: ICameraHelper;
  private readonly opts: Required<ScrollZoomOptions>;
  private unbind: (() => void) | null = null;
  private classifier = new WheelClassifier();
  private lastMode: WheelMode | null = null;
  private lastPointer: { x: number; y: number } = { x: 0, y: 0 };
  private inertiaHandle: number | null = null;
  private velocity = 0; // zoom units per second
  private lastWheelTs = 0;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, opts?: ScrollZoomOptions) {
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      maxDeltaPerEvent: 0.25,
      preventDefault: true,
      around: 'pointer',
      onWheelModeChange: () => {},
      onChange: () => {},
      cooperative: false,
      onCoopGestureHint: () => {},
      zoomSign: 1,
      ...opts,
    };
  }

  enable() {
    if (typeof window === 'undefined') return;
    if (this.unbind) return;
    const off = on(this.el, 'wheel', this._onWheel as any, { passive: !this.opts.preventDefault });
    this.unbind = () => {
      off();
    };
  }

  disable() {
    if (this.unbind) {
      this.unbind();
      this.unbind = null;
    }
    if (this.inertiaHandle != null) {
      cancelAnimationFrame(this.inertiaHandle);
      this.inertiaHandle = null;
    }
  }

  destroy() { this.disable(); }

  private _onWheel = (evt: WheelEvent) => {
    // Cooperative gestures: require ctrl/meta to zoom via wheel
    if (this.opts.cooperative && !(evt.ctrlKey || (evt as any).metaKey)) {
      this.opts.onCoopGestureHint({ type: 'pinch' });
      return;
    }
    if (this.opts.preventDefault) evt.preventDefault();
    const mode = this.classifier.classify(evt);
    if (mode !== this.lastMode) {
      this.lastMode = mode;
      this.opts.onWheelModeChange(mode);
    }

    // Map delta to zoom change
    // pixel mode (trackpad): small deltas; line mode (wheel): larger steps
    let dz: number;
    if (evt.deltaMode === 1) {
      // DOM_DELTA_LINE
      dz = -evt.deltaY * 0.08;
    } else {
      // pixels
      dz = -evt.deltaY / 250;
    }
    // Clamp
    const max = this.opts.maxDeltaPerEvent;
    if (dz > max) dz = max;
    if (dz < -max) dz = -max;

    // Track pointer
    const rect = (evt.currentTarget as HTMLElement).getBoundingClientRect();
    this.lastPointer.x = evt.clientX - rect.left;
    this.lastPointer.y = evt.clientY - rect.top;

    this.applyZoomAround(dz * (this.opts.zoomSign ?? 1), this.opts.around === 'pointer' ? this.lastPointer : null);
    this.opts.onChange({ axes: { zoom: true }, originalEvent: evt });

    // Inertia: update velocity and start decay timer
    const now = performance.now();
    const dt = this.lastWheelTs ? (now - this.lastWheelTs) / 1000 : 0;
    this.lastWheelTs = now;
    const targetV = dz / (dt || 1 / 60);
    // simple low-pass filter
    this.velocity = this.velocity * 0.7 + targetV * 0.3;

    if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
    this.inertiaHandle = requestAnimationFrame(() => this.runInertia());
  };

  private applyZoomAround(dz: number, pointer: { x: number; y: number } | null) {
    if (!pointer) {
      this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, 'center');
      return;
    }
    // Preserve the world point under the pointer by adjusting center after zoom
    const groundBefore = this.transform.groundFromScreen(pointer);
    this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, 'center');
    if (!groundBefore) return;
    const groundAfter = this.transform.groundFromScreen(pointer);
    if (!groundAfter) return;
    const dgx = groundBefore.gx - groundAfter.gx;
    const dgz = groundBefore.gz - groundAfter.gz;
    this.transform.adjustCenterByGroundDelta(dgx, dgz);
  }

  private runInertia() {
    const friction = 8; // 1/s, exponential decay constant
    let lastTime = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      // decay velocity
      const decay = Math.exp(-friction * dt);
      this.velocity *= decay;
      if (Math.abs(this.velocity) < 1e-3) {
        this.inertiaHandle = null;
        return;
      }
      const dz = this.velocity * dt * (this.opts.zoomSign ?? 1);
      this.applyZoomAround(dz, this.opts.around === 'pointer' ? this.lastPointer : null);
      this.opts.onChange({ axes: { zoom: true } });
      this.inertiaHandle = requestAnimationFrame(step);
    };
    this.inertiaHandle = requestAnimationFrame(step);
  }
}
