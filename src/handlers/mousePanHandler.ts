import type { ITransform } from '../transform/interfaces';
import type { ICameraHelper } from '../helpers/icameraHelper';
import { on } from '../util/dom';
import type { HandlerDelta } from './types';

export interface MousePanOptions {
  button?: number; // 0 = left
  dragThresholdPx?: number; // prevent clicks
  onChange?: (delta: HandlerDelta) => void;
  rubberbandStrength?: number; // higher = stronger resistance
  inertiaPanFriction?: number; // 1/s
  panXSign?: 1 | -1;
  panYSign?: 1 | -1;
  recenterOnPointerDown?: boolean;
  inertiaPanYSign?: 1 | -1;
}

export class MousePanHandler {
  private el: HTMLElement;
  private transform: ITransform;
  private helper: ICameraHelper;
  private opts: Required<MousePanOptions>;
  private unbindDown: (() => void) | null = null;
  private unbindMoveUp: (() => void) | null = null;
  private dragging = false;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private lastTs = 0;
  private vx = 0; // px/s
  private vy = 0; // px/s
  private inertiaHandle: number | null = null;
  private lastGround: { gx: number; gz: number } | null = null;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, opts?: MousePanOptions) {
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      button: 0,
      dragThresholdPx: 3,
      onChange: () => {},
      rubberbandStrength: 0.5,
      inertiaPanFriction: 6,
      panXSign: 1,
      panYSign: 1,
      recenterOnPointerDown: false,
      inertiaPanYSign: 1,
      ...opts,
    };
  }

  enable() {
    if (typeof window === 'undefined' || this.unbindDown) return;
    this.unbindDown = on(this.el, 'pointerdown', this.onDown as any, { passive: true });
  }

  destroy() {
    this.unbindDown?.();
    this.unbindDown = null;
    if (this.unbindMoveUp) {
      this.unbindMoveUp();
      this.unbindMoveUp = null;
    }
    if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== this.opts.button) return;
    this.el.setPointerCapture?.(e.pointerId);
    this.dragging = false;
    this.startX = this.lastX = e.clientX;
    this.startY = this.lastY = e.clientY;
    this.lastTs = performance.now();
    // Initialize ground anchor at pointer
    const rect = this.el.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const gp = (this.transform as any).groundFromScreen?.(pointer) ?? null;
    this.lastGround = gp;
    if (this.opts.recenterOnPointerDown && gp) {
      (this.transform as any).setGroundCenter?.(gp);
      this.opts.onChange({ axes: { pan: true }, originalEvent: e });
    }
    const offMove = on(window, 'pointermove', this.onMove as any, { passive: false });
    const offUp = on(window, 'pointerup', this.onUp as any, { passive: true });
    this.unbindMoveUp = () => { offMove(); offUp(); };
  };

  private onMove = (e: PointerEvent) => {
    const dx = (e.clientX - this.lastX) * (this.opts.panXSign ?? 1);
    const dy = (e.clientY - this.lastY) * (this.opts.panYSign ?? 1);
    const dt = (performance.now() - this.lastTs) / 1000;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastTs = performance.now();

    if (!this.dragging) {
      const dist = Math.hypot(this.lastX - this.startX, this.lastY - this.startY);
      if (dist < this.opts.dragThresholdPx) return;
      this.dragging = true;
    }
    // Pointer-anchored pan: keep ground under pointer fixed
    e.preventDefault();
    const rect = this.el.getBoundingClientRect();
    const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const currGround = (this.transform as any).groundFromScreen?.(pointer) ?? null;
    if (this.lastGround && currGround) {
      let dgx = (this.lastGround.gx - currGround.gx) * (this.opts.panXSign ?? 1);
      let dgz = (this.lastGround.gz - currGround.gz) * (this.opts.panYSign ?? 1);
      // Rubberband damping near/outside panBounds
      const bounds = this.transform.getPanBounds?.();
      if (bounds) {
        const nextX = this.transform.center.x + dgx;
        const nextY = this.transform.center.y + dgz;
        const overX = nextX < bounds.min.x ? bounds.min.x - nextX : nextX > bounds.max.x ? nextX - bounds.max.x : 0;
        const overY = nextY < bounds.min.y ? bounds.min.y - nextY : nextY > bounds.max.y ? nextY - bounds.max.y : 0;
        const s = this.opts.rubberbandStrength;
        const damp = (o: number) => (o > 0 ? 1 / (1 + o * s) : 1);
        dgx *= damp(overX);
        dgz *= damp(overY);
      }
      (this.transform as any).adjustCenterByGroundDelta?.(dgx, dgz);
    } else {
      // Fallback to screen-space pan
      this.helper.handleMapControlsPan(this.transform, dx, dy);
    }
    this.lastGround = currGround;
    this.opts.onChange({ axes: { pan: true }, originalEvent: e });

    // Velocity for inertia (px/s)
    if (dt > 0) {
      const alpha = 0.3;
      // Use sign-adjusted screen deltas for velocity to align with damping + inversion
      const sdx = dx * (this.opts.panXSign ?? 1);
      const sdy = dy * (this.opts.panYSign ?? 1);
      this.vx = this.vx * (1 - alpha) + (sdx / dt) * alpha;
      this.vy = this.vy * (1 - alpha) + (sdy / dt) * alpha;
    }
  };

  private onUp = (_e: PointerEvent) => {
    this.unbindMoveUp?.();
    this.unbindMoveUp = null;
    if (!this.dragging) return;
    this.dragging = false;
    // Start inertia
    if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
    this.inertiaHandle = requestAnimationFrame(() => this.runInertia());
  };

  private runInertia() {
    let last = performance.now();
    const friction = this.opts.inertiaPanFriction; // 1/s
    const step = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const decay = Math.exp(-friction * dt);
      this.vx *= decay;
      this.vy *= decay;
      if (Math.hypot(this.vx, this.vy) < 5) { // px/s threshold
        this.inertiaHandle = null;
        return;
      }
      // Convert screen velocity (px/s) to ground velocity (world/s) using bearing and scale
      const svx = this.vx; // already sign-adjusted via onMove
      const svy = this.vy * (this.opts.inertiaPanYSign ?? 1);
      const scale = Math.pow(2, this.transform.zoom);
      const rad = (this.transform.bearing * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      // Map screen dx,dy to ground dgx,dgz (same mapping as plan helper pan)
      // dWx = (-dx * cos + dy * sin) / scale;  dWz ~ (+dx * sin + dy * cos) / scale
      let dgx = (-svx * cos + svy * sin) / scale * dt;
      let dgz = (svx * sin + svy * cos) / scale * dt;
      // Rubberband damping near/outside panBounds in ground space
      const bounds = this.transform.getPanBounds?.();
      if (bounds) {
        const nx = this.transform.center.x + dgx; const ny = this.transform.center.y + dgz;
        const overX = nx < bounds.min.x ? bounds.min.x - nx : nx > bounds.max.x ? nx - bounds.max.x : 0;
        const overY = ny < bounds.min.y ? bounds.min.y - ny : ny > bounds.max.y ? ny - bounds.max.y : 0;
        const s = this.opts.rubberbandStrength; const damp = (o: number) => (o > 0 ? 1 / (1 + o * s) : 1);
        dgx *= damp(overX); dgz *= damp(overY);
      }
      (this.transform as any).adjustCenterByGroundDelta?.(dgx, dgz);
      this.opts.onChange({ axes: { pan: true } });
      this.inertiaHandle = requestAnimationFrame(step);
    };
    this.inertiaHandle = requestAnimationFrame(step);
  }
}
