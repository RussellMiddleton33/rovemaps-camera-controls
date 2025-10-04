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
  inertiaPanXSign?: 1 | -1;
  inertiaPanYSign?: 1 | -1;
  rotateSign?: 1 | -1;
  // MapLibre-style gating: allow two-finger pitch only when second touch arrives quickly
  allowedSingleTouchTimeMs?: number; // time between first and second touch to allow pitch
  pitchFirstMoveWindowMs?: number; // window since two-finger start for first pitch move
  // Inertia friction (higher = faster decay, less glide)
  inertiaPanFriction?: number; // friction for pan (default: 12)
  inertiaZoomFriction?: number; // friction for zoom (default: 20)
  inertiaRotateFriction?: number; // friction for rotate/pitch (default: 12)
  // Debug overlay for mobile testing (shows gesture detection state on screen)
  showDebugOverlay?: boolean;
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
  private lastCenterEl = { x: 0, y: 0 }; // element-relative centroid to avoid visualViewport drift
  private lastDist = 0;
  private lastAngle = 0; // radians
  private mode: 'idle' | 'pan' | 'zoomRotate' = 'idle';
  private lastGroundCenter: { gx: number; gz: number } | null = null;
  private lastPinchPointer: { x: number; y: number } | null = null; // screen coords of last pinch centroid
  private lastSinglePt: { x: number; y: number } | null = null;
  private lastSingleGround: { gx: number; gz: number } | null = null;
  private lastP0: Pt | null = null;
  private lastP1: Pt | null = null;

  // inertias
  private vz = 0; // zoom units/s
  private vb = 0; // bearing deg/s
  private vp = 0; // pitch deg/s
  private vpx = 0; // pan px/s
  private vpy = 0;
  private instVpx = 0; // last instantaneous pan px/s
  private instVpy = 0;
  private gvx = 0; // ground-space pan velocity (world/s)
  private gvz = 0;
  private inertiaHandle: number | null = null;
  private lastTs = 0;
  private firstTouchDownTs = 0;
  private allowPitchThisGesture = true;
  private debugOverlay: HTMLDivElement | null = null;

  constructor(el: HTMLElement, transform: ITransform, helper: ICameraHelper, opts?: TouchMultiOptions) {
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      enablePan: true,
      enableZoom: true,
      enableRotate: true,
      enablePitch: true,
      pitchPerPx: 0.5, // match MapLibre sensitivity
      // MapLibre-like, reduce accidental mode switching on touch
      rotateThresholdDeg: 0.5,
      // Lower pitch threshold for MapLibre-like responsiveness
      pitchThresholdPx: 5,
      zoomThreshold: 0.04,
      onChange: () => {},
      preventDefault: true,
      around: 'pinch',
      rubberbandStrength: 0.5,
      panXSign: 1,
      panYSign: 1,
      recenterOnGestureStart: false,
      // Touch-specific: slightly loosen anchor to reduce counter-drift
      anchorTightness: 0.95,
      inertiaPanXSign: 1,
      inertiaPanYSign: 1,
      rotateSign: 1,
      allowedSingleTouchTimeMs: 999, // effectively disabled - allow pitch anytime (better UX than MapLibre's strict 100ms)
      pitchFirstMoveWindowMs: 120,
      inertiaPanFriction: 12,
      inertiaZoomFriction: 20,
      inertiaRotateFriction: 12,
      showDebugOverlay: false,
      ...opts,
    };
  }

  // Enable/disable on-screen debug overlay at runtime
  setShowDebugOverlay(enabled: boolean) {
    (this.opts as any).showDebugOverlay = !!enabled;
    if (enabled) {
      if (!this.debugOverlay) this.createDebugOverlay();
    } else if (this.debugOverlay) {
      this.debugOverlay.remove();
      this.debugOverlay = null;
    }
  }

  enable() {
    if (typeof window === 'undefined' || this.unbindDown) return;
    // Use TouchEvent API to match MapLibre and ensure synchronous multi-touch state
    this.unbindDown = on(this.el, 'touchstart', this.onDown as any, { passive: true });
    if (this.opts.showDebugOverlay) {
      this.createDebugOverlay();
    }
  }

  destroy() {
    this.unbindDown?.();
    this.unbindDown = null;
    if (this.unbindMoveUp) { this.unbindMoveUp(); this.unbindMoveUp = null; }
    if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
    this.pts.clear();
    if (this.debugOverlay) {
      this.debugOverlay.remove();
      this.debugOverlay = null;
    }
  }

  private onDown = (e: TouchEvent) => {
    // Sync all current touches into our map to ensure consistent multi-touch state
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches.item(i)!;
      this.pts.set(t.identifier, { id: t.identifier, x: t.clientX, y: t.clientY });
    }
    this.bindMoveUp();
    if (e.touches.length === 1) {
      // Single-finger pan: initialize ground anchor at finger
      this.firstTouchDownTs = performance.now();
      const t = e.touches.item(0)!;
      const rect = this.el.getBoundingClientRect();
      const vv = (window as any).visualViewport as VisualViewport | undefined;
      const pointer = { x: (t.clientX + (vv?.offsetLeft ?? 0)) - (rect.left + (vv?.offsetLeft ?? 0)), y: (t.clientY + (vv?.offsetTop ?? 0)) - (rect.top + (vv?.offsetTop ?? 0)) };
      const gp = (this.transform as any).groundFromScreen?.(pointer) ?? null;
      this.lastSinglePt = pointer;
      this.lastSingleGround = gp;
      this.active = true;
      this.mode = 'pan';
      this.lastTs = performance.now();
    } else if (e.touches.length === 2) {
      this.startGesture();
    }
  };

  private bindMoveUp() {
    if (this.unbindMoveUp) return;
    const offMove = on(window, 'touchmove', this.onMove as any, { passive: !this.opts.preventDefault });
    const offUp = on(window, 'touchend', this.onUp as any, { passive: true });
    const offCancel = on(window, 'touchcancel', this.onUp as any, { passive: true });
    this.unbindMoveUp = () => { offMove(); offUp(); offCancel(); };
  }

  private startGesture(_e?: TouchEvent) {
    const pts = [...this.pts.values()];
    // Choose two touches in a stable order (by identifier)
    const [p0, p1] = pts.sort((a, b) => a.id - b.id);
    if (!p0 || !p1) return;
    this.lastCenter = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    this.lastDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    this.lastAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    this.lastP0 = { ...p0 };
    this.lastP1 = { ...p1 };
    this.active = true;
    this.lastTs = performance.now();
    this.mode = 'idle';
    // Optional pitch gating (effectively disabled by default with 999ms threshold)
    this.allowPitchThisGesture = (performance.now() - this.firstTouchDownTs) <= this.opts.allowedSingleTouchTimeMs;
    // Seed ground center so first movement immediately pans (grab feel)
    // Use fresh rect per move to avoid iOS visual viewport shifts
    const rect = this.el.getBoundingClientRect();
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const centerEl = { x: (this.lastCenter.x + (vv?.offsetLeft ?? 0)) - (rect.left + (vv?.offsetLeft ?? 0)), y: (this.lastCenter.y + (vv?.offsetTop ?? 0)) - (rect.top + (vv?.offsetTop ?? 0)) };
    this.lastCenterEl = centerEl;
    const gp = (this.transform as any).groundFromScreen?.(centerEl) ?? null;
    this.lastGroundCenter = gp;
    if (this.opts.recenterOnGestureStart && this.opts.around === 'pinch') {
      const gp = (this.transform as any).groundFromScreen?.(centerEl) ?? null;
      if (gp) (this.transform as any).setGroundCenter?.(gp);
    }
    // end any inertia
    if (this.inertiaHandle != null) { cancelAnimationFrame(this.inertiaHandle); this.inertiaHandle = null; }
  }

  private onMove = (e: TouchEvent) => {
    // Update all tracked touches from the synchronous TouchEvent.touches list
    this.pts.clear();
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches.item(i)!;
      this.pts.set(t.identifier, { id: t.identifier, x: t.clientX, y: t.clientY });
    }
    if (this.opts.preventDefault) e.preventDefault();
    if (!this.active && this.pts.size === 2) this.startGesture();
    // Single-finger pan path
    if (this.pts.size === 1 && e.touches.length === 1) {
      const now = performance.now();
      const dt = Math.max(1 / 120, (now - this.lastTs) / 1000);
      this.lastTs = now;
      const rect = this.el.getBoundingClientRect();
      const vv = (window as any).visualViewport as VisualViewport | undefined;
      const t = e.touches.item(0)!;
      const pointer = { x: (t.clientX + (vv?.offsetLeft ?? 0)) - (rect.left + (vv?.offsetLeft ?? 0)), y: (t.clientY + (vv?.offsetTop ?? 0)) - (rect.top + (vv?.offsetTop ?? 0)) };
      const gpNow = (this.transform as any).groundFromScreen?.(pointer) ?? null;
      if (this.lastSingleGround && gpNow) {
        let dgx = (this.lastSingleGround.gx - gpNow.gx) * (this.opts.panXSign ?? 1);
        let dgz = (this.lastSingleGround.gz - gpNow.gz) * (this.opts.panYSign ?? 1);
        const bounds = (this.transform as any).getPanBounds?.();
        if (bounds) {
          const nx = this.transform.center.x + dgx; const ny = this.transform.center.y + dgz;
          const overX = nx < bounds.min.x ? bounds.min.x - nx : nx > bounds.max.x ? nx - bounds.max.x : 0;
          const overY = ny < bounds.min.y ? bounds.min.y - ny : ny > bounds.max.y ? ny - bounds.max.y : 0;
          const s = this.opts.rubberbandStrength; const damp = (o: number) => (o > 0 ? 1 / (1 + o * s) : 1);
          dgx *= damp(overX); dgz *= damp(overY);
        }
        (this.transform as any).adjustCenterByGroundDelta?.(dgx, dgz);
        // Recompute ground under pointer after adjustment to keep anchor locked (like mouse pan)
        const after = (this.transform as any).groundFromScreen?.(pointer) ?? null;
        this.lastSingleGround = after ?? gpNow;
        // velocity
        const alpha = 0.3;
        const igx = dgx / dt;
        const igz = dgz / dt;
        this.gvx = this.gvx * (1 - alpha) + igx * alpha;
        this.gvz = this.gvz * (1 - alpha) + igz * alpha;
        const sdx = (pointer.x - (this.lastSinglePt?.x ?? pointer.x));
        const sdy = (pointer.y - (this.lastSinglePt?.y ?? pointer.y));
        this.vpx = this.vpx * (1 - alpha) + (sdx / dt) * alpha;
        this.vpy = this.vpy * (1 - alpha) + (sdy / dt) * alpha;
      } else {
        this.lastSingleGround = gpNow;
      }
      this.lastSinglePt = pointer;
      this.opts.onChange({ axes: { pan: true }, originalEvent: e });
      return;
    }
    if (!this.active || this.pts.size < 2) return;

    const rect = this.el.getBoundingClientRect();
    // Keep pairing stable by previous identifiers where possible
    let p0: Pt | undefined;
    let p1: Pt | undefined;
    if (this.lastP0 && this.lastP1) {
      p0 = this.pts.get(this.lastP0.id) ?? undefined;
      p1 = this.pts.get(this.lastP1.id) ?? undefined;
    }
    if (!p0 || !p1) {
      const arr = [...this.pts.values()].sort((a, b) => a.id - b.id);
      p0 = arr[0]; p1 = arr[1];
    }
    if (!p0 || !p1) return;
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    const center = { x: ((p0.x + p1.x) / 2 + (vv?.offsetLeft ?? 0)) - (rect.left + (vv?.offsetLeft ?? 0)), y: ((p0.y + p1.y) / 2 + (vv?.offsetTop ?? 0)) - (rect.top + (vv?.offsetTop ?? 0)) };
    this.lastPinchPointer = center;
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const now = performance.now();
    const dt = Math.max(1 / 120, (now - this.lastTs) / 1000);
    this.lastTs = now;

    // Compute candidate deltas
    const dxPan = (center.x - this.lastCenterEl.x) * (this.opts.panXSign ?? 1);
    const dyPan = (center.y - this.lastCenterEl.y) * (this.opts.panYSign ?? 1);
    const s = this.lastDist > 0 && dist > 0 ? dist / this.lastDist : 1;
    const dzCand = scaleZoom(s);
    let dAng = angle - this.lastAngle;
    if (dAng > Math.PI) dAng -= Math.PI * 2; else if (dAng < -Math.PI) dAng += Math.PI * 2;
    const dDeg = radToDeg(dAng);
    // Per-finger movement vectors since last frame (MapLibre-style pitch detection)
    const vA = this.lastP0 ? { x: p0.x - this.lastP0.x, y: p0.y - this.lastP0.y } : { x: 0, y: 0 };
    const vB = this.lastP1 ? { x: p1.x - this.lastP1.x, y: p1.y - this.lastP1.y } : { x: 0, y: 0 };
    const movedA = Math.hypot(vA.x, vA.y) >= 2;
    const movedB = Math.hypot(vB.x, vB.y) >= 2;
    const verticalA = Math.abs(vA.y) > Math.abs(vA.x);
    const verticalB = Math.abs(vB.y) > Math.abs(vB.x);
    const sameDir = (vA.y > 0) === (vB.y > 0);
    const avgDy = (vA.y + vB.y) / 2;
    const dpCand = -avgDy * (this.opts.pitchPerPx ?? 0.5);

    // MapLibre-style pitch detection: both fingers vertical, same direction, both moved
    // Note: We allow pitch to run concurrently with zoom/rotate (like MapLibre's separate handlers)
    let pitchStrong = this.opts.enablePitch && movedA && movedB && verticalA && verticalB && sameDir;
    // Optional timing gate (disabled by default for better UX)
    if (this.opts.allowedSingleTouchTimeMs < 999 && !this.allowPitchThisGesture) pitchStrong = false;
    const zoomStrong = this.opts.enableZoom && (Math.abs(dzCand) >= (this.opts.zoomThreshold ?? 0.04));
    const rotateStrong = this.opts.enableRotate && Math.abs(dDeg) >= (this.opts.rotateThresholdDeg ?? 0.5);

    // Determine primary mode for pan vs zoom/rotate
    if (this.mode === 'idle') {
      if (zoomStrong || rotateStrong || pitchStrong) {
        this.mode = 'zoomRotate';
      }
    }

    // Apply transformations
    const axes: HandlerDelta['axes'] = {};

    // PITCH: Apply independently WITHOUT anchor correction (like MapLibre's pitch handler)
    // Pitch changes viewing angle, so anchor-to-pointer doesn't make sense
    if (pitchStrong && dpCand && this.opts.enablePitch) {
      this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dpCand, 0, 0, 'center');
      this.vp = dpCand / dt;
      axes.pitch = true;
    }

    // Calculate anchor point AFTER pitch (for zoom/rotate only)
    const ptr = this.opts.around === 'pinch' ? center : null;
    const groundBefore = ptr ? this.transform.groundFromScreen(ptr) : null;

    if (this.mode === 'pan' && this.opts.enablePan) {
      // Two-finger pan mode (rare, only when no zoom/rotate detected)
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
          if (dt > 0) {
            const alphaG = 0.3;
            const igx = dgx / dt;
            const igz = dgz / dt;
            this.gvx = this.gvx * (1 - alphaG) + igx * alphaG;
            this.gvz = this.gvz * (1 - alphaG) + igz * alphaG;
          }
        }
        const after = (this.transform as any).groundFromScreen?.(center) ?? null;
        this.lastGroundCenter = after ?? gp;
      } else {
        this.helper.handleMapControlsPan(this.transform, dxPan, dyPan);
      }
      const vdx = dxPan / dt;
      const vdy = dyPan / dt;
      this.instVpx = vdx; this.instVpy = vdy;
      const alpha = 0.3;
      this.vpx = this.vpx * (1 - alpha) + vdx * alpha;
      this.vpy = this.vpy * (1 - alpha) + vdy * alpha;
      axes.pan = true;
    } else if (this.mode === 'zoomRotate') {
      // Apply zoom/rotate (pitch already applied above independently)
      const dRot = (this.opts.enableRotate && Math.abs(dDeg) >= this.opts.rotateThresholdDeg) ? (-dDeg * (this.opts.rotateSign ?? 1)) : 0;
      const dZoom = this.opts.enableZoom ? dzCand : 0;
      if (dZoom) { this.vz = dZoom / dt; axes.zoom = true; }
      if (dRot) { this.vb = dRot / dt; axes.rotate = true; }
      if (dZoom || dRot) {
        this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, dRot, dZoom, 'center');
      }
      // Clear pan velocities
      this.vpx = 0; this.vpy = 0; this.gvx = 0; this.gvz = 0;
    }

    // Anchor correction (for both zoom/rotate and pitch)
    if (ptr && groundBefore) {
      const groundAfter = this.transform.groundFromScreen(ptr);
      if (groundAfter) {
        const tight = Math.max(0, Math.min(1, this.opts.anchorTightness ?? 1));
        let dgx = (groundBefore.gx - groundAfter.gx) * tight;
        let dgz = (groundBefore.gz - groundAfter.gz) * tight;
        const maxShift = 500;
        if (dgx > maxShift) dgx = maxShift; else if (dgx < -maxShift) dgx = -maxShift;
        if (dgz > maxShift) dgz = maxShift; else if (dgz < -maxShift) dgz = -maxShift;
        this.transform.adjustCenterByGroundDelta(dgx, dgz);
        this.lastGroundCenter = groundAfter;
      }
    }

    // Update debug overlay if enabled
    if (this.opts.showDebugOverlay) {
      this.updateDebugOverlay({
        mode: this.mode,
        fingers: this.pts.size,
        pitchStrong,
        zoomStrong,
        rotateStrong,
        vA: { x: vA.x, y: vA.y, mag: Math.hypot(vA.x, vA.y), vertical: verticalA },
        vB: { x: vB.x, y: vB.y, mag: Math.hypot(vB.x, vB.y), vertical: verticalB },
        sameDir,
        dpCand,
        dzCand,
        dDeg,
        pitchApplied: axes.pitch || false,
        currentPitch: this.transform.pitch || 0,
      });
    }

    this.lastCenter = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    this.lastCenterEl = center;
    this.lastDist = dist;
    this.lastAngle = angle;
    this.lastP0 = { ...p0 };
    this.lastP1 = { ...p1 };
    this.opts.onChange({ axes, originalEvent: e });
  };

  private onUp = (e: TouchEvent) => {
    // Remove ended touches
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i)!;
      this.pts.delete(t.identifier);
    }
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
    const before = this.transform.groundFromScreen(pointer);
    this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, 'center');
    if (!before) return;
    const after = this.transform.groundFromScreen(pointer);
    if (!after) return;
    const tight = Math.max(0, Math.min(1, this.opts.anchorTightness ?? 1));
    let dgx = (before.gx - after.gx) * tight;
    let dgz = (before.gz - after.gz) * tight;
    const maxShift = 500;
    if (dgx > maxShift) dgx = maxShift; else if (dgx < -maxShift) dgx = -maxShift;
    if (dgz > maxShift) dgz = maxShift; else if (dgz < -maxShift) dgz = -maxShift;
    this.transform.adjustCenterByGroundDelta(dgx, dgz);
  }

  private startInertia() {
    if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
    // If we weren't in pan mode, don't carry pan inertia into zoom/rotate release
    if (this.mode !== 'pan') { this.vpx = 0; this.vpy = 0; this.gvx = 0; this.gvz = 0; }
    // Directional clamp for pan inertia to avoid backslide at release
    const d = this.vpx * this.instVpx + this.vpy * this.instVpy;
    if (d <= 0) { this.vpx = 0; this.vpy = 0; }
    // MapLibre-like gating and caps (touch only)
    const panSpeed = Math.hypot(this.vpx, this.vpy); // px/s
    const minPanSpeed = 80; // below this, no pan inertia
    if (panSpeed < minPanSpeed) { this.vpx = 0; this.vpy = 0; this.gvx = 0; this.gvz = 0; }
    const maxPanSpeed = 1400; // cap
    if (panSpeed > maxPanSpeed) {
      const k = maxPanSpeed / panSpeed; this.vpx *= k; this.vpy *= k; this.gvx *= k; this.gvz *= k;
    }
    // Zoom inertia on touch feels negligible in ML; disable
    this.vz = 0;
    // Gate rotate/pitch small velocities
    if (Math.abs(this.vb) < 8) this.vb = 0; // deg/s
    if (Math.abs(this.vp) < 8) this.vp = 0;
    let last = performance.now();
    // Separate frictions per axis (configurable)
    const frPan = this.opts.inertiaPanFriction ?? 12; // pan dies quickly
    const frZoom = this.opts.inertiaZoomFriction ?? 20; // zoom off
    const frAng = this.opts.inertiaRotateFriction ?? 12; // rotate/pitch quick
    const step = () => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const decayPan = Math.exp(-frPan * dt);
      const decayZoom = Math.exp(-frZoom * dt);
      const decayAng = Math.exp(-frAng * dt);
      this.vpx *= decayPan; this.vpy *= decayPan;
      this.vz *= decayZoom; this.vb *= decayAng; this.vp *= decayAng;
      const zAbs = Math.abs(this.vz), bAbs = Math.abs(this.vb), pAbs = Math.abs(this.vp), panAbs = Math.hypot(this.vpx, this.vpy);
      if (zAbs < 1e-3 && bAbs < 1e-2 && pAbs < 1e-2 && panAbs < 2) {
        this.inertiaHandle = null;
        return;
      }
      const dz = this.vz * dt;
      const db = this.vb * dt;
      const dp = this.vp * dt;
      const axes: HandlerDelta['axes'] = {};
      if (this.mode === 'zoomRotate') {
        // We disable zoom inertia (vz zeroed) but keep logic here guarded
        if (this.opts.enableZoom && dz) { this.applyZoomAround(dz, this.lastPinchPointer ?? null); axes.zoom = true; }
        if (this.opts.enableRotate && db) { this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, db, 0, 'center'); axes.rotate = true; }
        // Pitch inertia applies here too (since pitch runs concurrently with zoom/rotate)
        if (this.opts.enablePitch && dp) { this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dp, 0, 0, 'center'); axes.pitch = true; }
      } else if (this.mode === 'pan') {
        if (this.opts.enablePan && (this.gvx || this.gvz)) {
          // Integrate stored ground-space velocity directly
          let dgx = this.gvx * dt;
          let dgz = this.gvz * dt;
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

  private createDebugOverlay() {
    if (typeof document === 'undefined') return;
    this.debugOverlay = document.createElement('div');
    this.debugOverlay.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.85);
      color: #0f0;
      font-family: monospace;
      font-size: 11px;
      line-height: 1.4;
      padding: 8px;
      border-radius: 4px;
      z-index: 99999;
      max-width: 90vw;
      pointer-events: none;
      white-space: pre;
    `;
    document.body.appendChild(this.debugOverlay);
  }

  private updateDebugOverlay(data: {
    mode: string;
    fingers: number;
    pitchStrong: boolean;
    zoomStrong: boolean;
    rotateStrong: boolean;
    vA: { x: number; y: number; mag: number; vertical: boolean };
    vB: { x: number; y: number; mag: number; vertical: boolean };
    sameDir: boolean;
    dpCand: number;
    dzCand: number;
    dDeg: number;
    pitchApplied: boolean;
    currentPitch: number;
  }) {
    if (!this.debugOverlay) return;
    this.debugOverlay.textContent = `
TOUCH DEBUG
───────────
Mode: ${data.mode}
Fingers: ${data.fingers}

DETECTION
PitchStrong: ${data.pitchStrong ? 'YES ✓' : 'NO ✗'}
ZoomStrong:  ${data.zoomStrong ? 'YES' : 'NO'}
RotateStrong: ${data.rotateStrong ? 'YES' : 'NO'}

FINGER A
  dx: ${data.vA.x.toFixed(1)}  dy: ${data.vA.y.toFixed(1)}
  mag: ${data.vA.mag.toFixed(1)}  vert: ${data.vA.vertical ? 'YES' : 'NO'}

FINGER B
  dx: ${data.vB.x.toFixed(1)}  dy: ${data.vB.y.toFixed(1)}
  mag: ${data.vB.mag.toFixed(1)}  vert: ${data.vB.vertical ? 'YES' : 'NO'}

SAME DIR: ${data.sameDir ? 'YES ✓' : 'NO ✗'}

DELTAS
Pitch: ${data.dpCand.toFixed(2)}° ${data.pitchApplied ? '✓ APPLIED' : '✗ NOT APPLIED'}
Zoom:  ${data.dzCand.toFixed(3)}
Rotate: ${data.dDeg.toFixed(1)}°

CURRENT PITCH: ${data.currentPitch.toFixed(1)}°
`.trim();
  }
}
