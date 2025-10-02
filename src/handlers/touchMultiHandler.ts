import type { ITransform } from '../transform/interfaces';
import type { ICameraHelper } from '../helpers/icameraHelper';
import { on } from '../util/dom';
import type { HandlerDelta } from './types';
import { radToDeg, scaleZoom } from '../util/math';

export interface TouchMultiOptions {
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
  enablePitch?: boolean;
  pitchPerPx?: number; // deg per px of average vertical movement
  rotateThresholdDeg?: number; // deg per frame to consider rotate significant
  pitchThresholdPx?: number; // px average vertical to switch to pitch mode
  zoomThreshold?: number; // zoom units threshold to enter zoom mode (approx log2 scale)
  onChange?: (delta: HandlerDelta) => void;
  preventDefault?: boolean;
  around?: 'center' | 'pinch';
  rubberbandStrength?: number;
  panXSign?: 1 | -1;
  panYSign?: 1 | -1;
  recenterOnGestureStart?: boolean;
  anchorTightness?: number; // 0..1
}

type Pt = { id: number; x: number; y: number };

export class TouchMultiHandler {
  private el: HTMLElement;
  private transform: ITransform;
  private helper: ICameraHelper;
  private opts: Required<TouchMultiOptions>;
  private unbindDown: (() => void) | null = null;
  private unbindMoveUp: (() => void) | null = null;
  private pts: Map<number, Pt> = new Map();
  private active = false;
  private lastCenter = { x: 0, y: 0 };
  private lastDist = 0;
  private lastAngle = 0; // radians
  private mode: 'idle' | 'pan' | 'zoomRotate' | 'pitch' = 'idle';
  private lastGroundCenter: { gx: number; gz: number } | null = null;

  // inertias
  private vz = 0; // zoom units/s
  private vb = 0; // bearing deg/s
  private vp = 0; // pitch deg/s
  private vpx = 0; // pan px/s
  private vpy = 0;
  private inertiaHandle: number | null = null;
  private lastTs = 0;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, opts?: TouchMultiOptions) {
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      enablePan: true,
      enableZoom: true,
      enableRotate: true,
      enablePitch: true,
      pitchPerPx: 0.25,
      rotateThresholdDeg: 0.2,
      pitchThresholdPx: 8,
      zoomThreshold: 0.02,
      onChange: () => {},
      preventDefault: true,
      around: 'pinch',
      rubberbandStrength: 0.5,
      panXSign: 1,
      panYSign: 1,
      recenterOnGestureStart: false,
      anchorTightness: 1,
      ...opts,
    };
  }

  enable() {
    if (typeof window === 'undefined' || this.unbindDown) return;
    // Pointer Events first; passive true for down, move will be passive false if preventing default
    this.unbindDown = on(this.el, 'pointerdown', this.onDown as any, { passive: true });
  }

  destroy() {
    this.unbindDown?.();
    this.unbindDown = null;
    if (this.unbindMoveUp) { this.unbindMoveUp(); this.unbindMoveUp = null; }
    if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
    this.pts.clear();
  }

  private onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    this.el.setPointerCapture?.(e.pointerId);
    this.pts.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    if (this.pts.size === 1) {
      // wait for second touch
      this.bindMoveUp();
    } else if (this.pts.size === 2) {
      this.startGesture(e);
    }
  };

  private bindMoveUp() {
    if (this.unbindMoveUp) return;
    const offMove = on(window, 'pointermove', this.onMove as any, { passive: !this.opts.preventDefault });
    const offUp = on(window, 'pointerup', this.onUp as any, { passive: true });
    const offCancel = on(window, 'pointercancel', this.onUp as any, { passive: true });
    this.unbindMoveUp = () => { offMove(); offUp(); offCancel(); };
  }

  private startGesture(_e: PointerEvent) {
    const pts = [...this.pts.values()];
    const [p0, p1] = pts;
    this.lastCenter = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    this.lastDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    this.lastAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    this.active = true;
    this.lastTs = performance.now();
    this.mode = 'idle';
    this.lastGroundCenter = null;
    if (this.opts.recenterOnGestureStart && this.opts.around === 'pinch') {
      const rect = this.el.getBoundingClientRect();
      const gp = (this.transform as any).groundFromScreen?.({ x: this.lastCenter.x - rect.left, y: this.lastCenter.y - rect.top }) ?? null;
      if (gp) (this.transform as any).setGroundCenter?.(gp);
    }
    // end any inertia
    if (this.inertiaHandle != null) { cancelAnimationFrame(this.inertiaHandle); this.inertiaHandle = null; }
  }

  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    const pt = this.pts.get(e.pointerId);
    if (!pt) return;
    pt.x = e.clientX; pt.y = e.clientY;
    if (this.opts.preventDefault) e.preventDefault();
    if (!this.active && this.pts.size === 2) this.startGesture(e);
    if (!this.active || this.pts.size < 2) return;

    const rect = this.el.getBoundingClientRect();
    const [p0, p1] = [...this.pts.values()];
    const center = { x: (p0.x + p1.x) / 2 - rect.left, y: (p0.y + p1.y) / 2 - rect.top };
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const now = performance.now();
    const dt = Math.max(1 / 120, (now - this.lastTs) / 1000);
    this.lastTs = now;

    // Compute candidate deltas
    const dxPan = (center.x - (this.lastCenter.x - rect.left)) * (this.opts.panXSign ?? 1);
    const dyPan = (center.y - (this.lastCenter.y - rect.top)) * (this.opts.panYSign ?? 1);
    const s = this.lastDist > 0 && dist > 0 ? dist / this.lastDist : 1;
    const dzCand = scaleZoom(s);
    let dAng = angle - this.lastAngle;
    if (dAng > Math.PI) dAng -= Math.PI * 2; else if (dAng < -Math.PI) dAng += Math.PI * 2;
    const dDeg = radToDeg(dAng);
    const avgDy = ((p0.y - this.lastCenter.y) + (p1.y - this.lastCenter.y)) / 2;
    const dpCand = -avgDy * this.opts.pitchPerPx;

    // Determine mode if not locked
    if (this.mode === 'idle') {
      const pitchScore = Math.abs(avgDy);
      const zoomScore = Math.abs(dzCand);
      const rotateScore = Math.abs(dDeg);
      if (this.opts.enablePitch && pitchScore >= this.opts.pitchThresholdPx) this.mode = 'pitch';
      else if (this.opts.enableZoom && (Math.abs(zoomScore) >= this.opts.zoomThreshold || (this.opts.enableRotate && rotateScore >= this.opts.rotateThresholdDeg))) this.mode = 'zoomRotate';
      else if (this.opts.enablePan && Math.hypot(dxPan, dyPan) > 0) this.mode = 'pan';
    }

    // Apply based on locked mode, preserving around-point using centroid when enabled
    const axes: HandlerDelta['axes'] = {};
    if (this.mode === 'pan' && this.opts.enablePan) {
      // Pointer-anchored pan based on centroid
      const gp = (this.transform as any).groundFromScreen?.(center) ?? null;
      if (gp) {
        if (this.lastGroundCenter) {
          let dgx = (this.lastGroundCenter.gx - gp.gx) * (this.opts.panXSign ?? 1);
          let dgz = (this.lastGroundCenter.gz - gp.gz) * (this.opts.panYSign ?? 1);
          const bounds = (this.transform as any).getPanBounds?.();
          if (bounds) {
            const nx = this.transform.center.x + dgx; const ny = this.transform.center.y + dgz;
            const overX = nx < bounds.min.x ? bounds.min.x - nx : nx > bounds.max.x ? nx - bounds.max.x : 0;
            const overY = ny < bounds.min.y ? bounds.min.y - ny : ny > bounds.max.y ? ny - bounds.max.y : 0;
            const s = this.opts.rubberbandStrength; const damp = (o: number) => (o > 0 ? 1 / (1 + o * s) : 1);
            dgx *= damp(overX); dgz *= damp(overY);
          }
          (this.transform as any).adjustCenterByGroundDelta?.(dgx, dgz);
        }
        // Recompute ground under centroid after adjustment to keep anchor locked
        const after = (this.transform as any).groundFromScreen?.(center) ?? null;
        this.lastGroundCenter = after ?? gp;
      } else {
        this.helper.handleMapControlsPan(this.transform, dxPan, dyPan);
      }
      // Velocity aligned with applied (sign-adjusted) deltas after damping
      // dxPan/dyPan already include panXSign/panYSign; do not apply signs again
      const vdx = dxPan / dt;
      const vdy = dyPan / dt;
      this.vpx = vdx; this.vpy = vdy; axes.pan = true;
    } else if (this.mode === 'zoomRotate') {
      const ptr = this.opts.around === 'pinch' ? center : null;
      const groundBefore = ptr ? this.transform.groundFromScreen(ptr) : null;
      if (this.opts.enableZoom && dzCand) { this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dzCand, 'center'); this.vz = dzCand / dt; axes.zoom = true; }
      if (this.opts.enableRotate && Math.abs(dDeg) >= this.opts.rotateThresholdDeg) { this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, dDeg, 0, 'center'); this.vb = dDeg / dt; axes.rotate = true; }
      if (ptr && groundBefore) { const groundAfter = this.transform.groundFromScreen(ptr); if (groundAfter) { const tight = Math.max(0, Math.min(1, this.opts.anchorTightness ?? 1)); const dgx = (groundBefore.gx - groundAfter.gx) * tight; const dgz = (groundBefore.gz - groundAfter.gz) * tight; this.transform.adjustCenterByGroundDelta(dgx, dgz); } }
      // Optionally, small pan to compensate centroid drift is skipped to better preserve around-point lock
    } else if (this.mode === 'pitch' && this.opts.enablePitch) {
      const ptr = this.opts.around === 'pinch' ? center : null;
      const groundBefore = ptr ? this.transform.groundFromScreen(ptr) : null;
      if (dpCand) { this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dpCand, 0, 0, 'center'); this.vp = dpCand / dt; axes.pitch = true; }
      if (ptr && groundBefore) { const groundAfter = this.transform.groundFromScreen(ptr); if (groundAfter) { const tight = Math.max(0, Math.min(1, this.opts.anchorTightness ?? 1)); const dgx = (groundBefore.gx - groundAfter.gx) * tight; const dgz = (groundBefore.gz - groundAfter.gz) * tight; this.transform.adjustCenterByGroundDelta(dgx, dgz); } }
    }

    this.lastCenter = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    this.lastDist = dist;
    this.lastAngle = angle;
    this.opts.onChange({ axes, originalEvent: e });
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    this.pts.delete(e.pointerId);
    if (this.pts.size < 2) {
      // end gesture and start inertia
      if (this.active) {
        this.active = false;
        this.startInertia();
      }
    }
    if (this.pts.size === 0 && this.unbindMoveUp) {
      this.unbindMoveUp();
      this.unbindMoveUp = null;
    }
  };

  private applyZoomAround(dz: number, pointer: { x: number; y: number } | null) {
    if (!pointer) {
      this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, 'center');
      return;
    }
    const world = this.transform.screenToWorld(pointer);
    this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, 'center');
    if (!world) return;
    const sp = this.transform.worldToScreen(world);
    if (!sp) return;
    const dx = sp.x - pointer.x;
    const dy = sp.y - pointer.y;
    this.helper.handleMapControlsPan(this.transform, dx, dy);
  }

  private startInertia() {
    if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
    let last = performance.now();
    const friction = 7; // 1/s
    const step = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const decay = Math.exp(-friction * dt);
      this.vz *= decay; this.vb *= decay; this.vp *= decay; this.vpx *= decay; this.vpy *= decay;
      const zAbs = Math.abs(this.vz), bAbs = Math.abs(this.vb), pAbs = Math.abs(this.vp), panAbs = Math.hypot(this.vpx, this.vpy);
      if (zAbs < 1e-3 && bAbs < 1e-2 && pAbs < 1e-2 && panAbs < 2) {
        this.inertiaHandle = null;
        return;
      }
      const dz = this.vz * dt;
      const db = this.vb * dt;
      const dp = this.vp * dt;
      let dx = this.vpx * dt;
      let dy = this.vpy * dt;
      const axes: HandlerDelta['axes'] = {};
      if (this.mode === 'zoomRotate') {
        if (this.opts.enableZoom && dz) { this.applyZoomAround(dz, null); axes.zoom = true; }
        if (this.opts.enableRotate && db) { this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, db, 0, 'center'); axes.rotate = true; }
      } else if (this.mode === 'pitch') {
        if (this.opts.enablePitch && dp) { this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dp, 0, 0, 'center'); axes.pitch = true; }
      } else if (this.mode === 'pan') {
        if (this.opts.enablePan && (dx || dy)) {
          // Convert screen velocity (px/s) to ground velocity (world/s) using bearing and scale, then integrate
          const svx = this.vpx; // already aligned with applied pan direction
          const svy = this.vpy;
          const scale = Math.pow(2, this.transform.zoom);
          const rad = (this.transform.bearing * Math.PI) / 180;
          const cos = Math.cos(rad), sin = Math.sin(rad);
          let dgx = (-svx * cos + svy * sin) / scale * dt;
          let dgz = (svx * sin + svy * cos) / scale * dt;
          // Rubberband damping near/outside panBounds in ground space
          const bounds = (this.transform as any).getPanBounds?.();
          if (bounds) {
            const nx = this.transform.center.x + dgx; const ny = this.transform.center.y + dgz;
            const overX = nx < bounds.min.x ? bounds.min.x - nx : nx > bounds.max.x ? nx - bounds.max.x : 0;
            const overY = ny < bounds.min.y ? bounds.min.y - ny : ny > bounds.max.y ? ny - bounds.max.y : 0;
            const s = this.opts.rubberbandStrength; const damp = (o: number) => (o > 0 ? 1 / (1 + o * s) : 1);
            dgx *= damp(overX); dgz *= damp(overY);
          }
          (this.transform as any).adjustCenterByGroundDelta?.(dgx, dgz); axes.pan = true;
        }
      }
      this.opts.onChange({ axes });
      this.inertiaHandle = requestAnimationFrame(step);
    };
    this.inertiaHandle = requestAnimationFrame(step);
  }
}
