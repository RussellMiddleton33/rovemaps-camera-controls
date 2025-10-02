import type { PerspectiveCamera, OrthographicCamera } from 'three';
import { Evented } from './evented';
import { PlanarCameraHelper } from '../helpers/planarCameraHelper';
import type { ICameraHelper, EaseOptions, FlyToOptions } from '../helpers/icameraHelper';
import { ThreePlanarTransform } from '../transform/threePlanarTransform';
import type { ITransform, Padding, TransformConstraints, Bounds2D } from '../transform/interfaces';
import { browser, raf, caf } from '../util/browser';
import { defaultEasing } from '../util/easing';
import { HandlerManager, type HandlerManagerOptions } from '../handlers/handlerManager';
import { computeFlyParams, uAt, widthAt } from '../util/flight';

export type Projection = 'planar'; // future: 'spherical'

export interface CameraControllerOptions {
  camera: PerspectiveCamera | OrthographicCamera;
  domElement: HTMLElement;
  width?: number;
  height?: number;
  devicePixelRatio?: number;
  projection?: Projection;
  bearingSnap?: number;
  bearingSnapEpsilon?: number;
  handlers?: HandlerManagerOptions;
  minZoom?: number;
  maxZoom?: number;
  minPitch?: number;
  maxPitch?: number;
  panBounds?: Bounds2D;
}

export type CameraMoveEvents = {
  movestart: { originalEvent?: Event };
  move: { originalEvent?: Event };
  moveend: { originalEvent?: Event };
  zoomstart: { originalEvent?: Event };
  zoom: { originalEvent?: Event };
  zoomend: { originalEvent?: Event };
  rotatestart: { originalEvent?: Event };
  rotate: { originalEvent?: Event };
  rotateend: { originalEvent?: Event };
  pitchstart: { originalEvent?: Event };
  pitch: { originalEvent?: Event };
  pitchend: { originalEvent?: Event };
  rollstart: { originalEvent?: Event };
  roll: { originalEvent?: Event };
  rollend: { originalEvent?: Event };
  dragstart: { originalEvent?: Event };
  drag: { originalEvent?: Event };
  dragend: { originalEvent?: Event };
  renderFrame: {};
  error: { error: Error };
};

export class CameraController extends Evented<CameraMoveEvents> {
  private readonly _camera: PerspectiveCamera | OrthographicCamera;
  private readonly _dom: HTMLElement;
  private readonly _helper: ICameraHelper;
  readonly transform: ITransform;
  private _moving = false;
  private _animHandle: number | null = null;
  private _easeAbort?: AbortController;
  private _bearingSnap: number;
  private _bearingSnapEps: number = 0.001;
  private _handlers?: HandlerManager;
  private _moveEndTimer: number | null = null;
  private _zooming = false;
  private _rotating = false;
  private _pitching = false;
  private _rolling = false;
  private _dragging = false;
  private _constraints: TransformConstraints = { minZoom: -Infinity, maxZoom: Infinity, minPitch: 0.001, maxPitch: 85 };
  private _softClamping = false;

  constructor(opts: CameraControllerOptions) {
    super();
    if (typeof window === 'undefined') {
      // SSR guard: don't access DOM
      // @ts-expect-error intentional
      this._camera = opts.camera;
      // @ts-expect-error intentional
      this._dom = {} as any;
      this._helper = new PlanarCameraHelper();
      this.transform = new ThreePlanarTransform({
        camera: opts.camera,
        width: opts.width ?? 0,
        height: opts.height ?? 0,
        devicePixelRatio: opts.devicePixelRatio,
      });
      this._bearingSnap = opts.bearingSnap ?? 7;
      return;
    }

    this._camera = opts.camera;
    this._dom = opts.domElement;
    this._helper = new PlanarCameraHelper();
    this.transform = new ThreePlanarTransform({
      camera: opts.camera,
      width: opts.width ?? this._dom.clientWidth,
      height: opts.height ?? this._dom.clientHeight,
      devicePixelRatio: opts.devicePixelRatio,
    });
    this._bearingSnap = opts.bearingSnap ?? 7;
    this._bearingSnapEps = opts.bearingSnapEpsilon ?? 0.001;
    // Constraints
    this._constraints = {
      minZoom: opts.minZoom ?? -Infinity,
      maxZoom: opts.maxZoom ?? Infinity,
      minPitch: opts.minPitch ?? 0.001,
      maxPitch: opts.maxPitch ?? 85,
      panBounds: opts.panBounds,
    };
    this.transform.setConstraints(this._constraints);

    // Handlers (Pointer/Wheel/Touch will be added as we implement)
    this._handlers = new HandlerManager(this._dom, this.transform, this._helper, {
      scrollZoom: opts.handlers?.scrollZoom ?? { around: 'center' },
      onChange: (ev?: Event) => this._externalChange(ev),
    });
  }

  dispose() {
    if (this._animHandle != null) {
      caf(this._animHandle);
      this._animHandle = null;
    }
    if (this._easeAbort) this._easeAbort.abort();
    this._handlers?.dispose();
    if (this._moveEndTimer != null) {
      window.clearTimeout(this._moveEndTimer);
      this._moveEndTimer = null;
    }
    this._endAllAxes();
  }

  setViewport(view: { width: number; height: number; devicePixelRatio?: number }) {
    this.transform.setViewport(view);
  }

  getCenter() { return this.transform.center; }
  getZoom() { return this.transform.zoom; }
  getBearing() { return this.transform.bearing; }
  getPitch() { return this.transform.pitch; }
  getRoll() { return this.transform.roll; }
  getPadding() { return this.transform.padding; }

  isMoving() { return this._moving; }
  isZooming() { return false; }
  isRotating() { return false; }
  isPitching() { return false; }
  isRolling() { return false; }

  setCenter(center: { x: number; y: number; z?: number }) { this.transform.setCenter(center); this._emitRender(); return this; }
  setZoom(zoom: number) { this.transform.setZoom(zoom); this._emitRender(); return this; }
  setBearing(bearing: number) { this.transform.setBearing(bearing); this._emitRender(); return this; }
  setPitch(pitch: number) { this.transform.setPitch(pitch); this._emitRender(); return this; }
  setRoll(roll: number) { this.transform.setRoll(roll); this._emitRender(); return this; }
  setPadding(padding: Partial<Padding>) { this.transform.setPadding(padding); this._emitRender(); return this; }
  setConstraints(c: Partial<TransformConstraints>) { this._constraints = { ...this._constraints, ...c }; this.transform.setConstraints(this._constraints); this._emitRender(); return this; }

  jumpTo(options: { center?: { x: number; y: number; z?: number }; zoom?: number; bearing?: number; pitch?: number; roll?: number; padding?: Partial<Padding> }) {
    if (options.center) this.transform.setCenter(options.center);
    if (typeof options.zoom === 'number') this.transform.setZoom(options.zoom);
    if (typeof options.bearing === 'number') this.transform.setBearing(options.bearing);
    if (typeof options.pitch === 'number') this.transform.setPitch(options.pitch);
    if (typeof options.roll === 'number') this.transform.setRoll(options.roll);
    if (options.padding) this.transform.setPadding(options.padding);
    this._emitRender();
    return this;
  }

  panBy(offset: { x: number; y: number }, _opts?: EaseOptions) {
    this._helper.handleMapControlsPan(this.transform, offset.x, offset.y);
    this._emitRender();
    return this;
  }

  panTo(center: { x: number; y: number }, opts?: EaseOptions) {
    return this.easeTo({ ...opts, center });
  }

  zoomTo(zoom: number, opts?: EaseOptions) { return this.easeTo({ ...opts, zoom }); }
  zoomIn(delta = 1, opts?: EaseOptions) { return this.zoomTo(this.getZoom() + delta, opts); }
  zoomOut(delta = 1, opts?: EaseOptions) { return this.zoomTo(this.getZoom() - delta, opts); }

  rotateTo(bearing: number, opts?: EaseOptions) { return this.easeTo({ ...opts, bearing }); }
  rotateBy(delta: number, opts?: EaseOptions) { return this.rotateTo(this.getBearing() + delta, opts); }
  pitchTo(pitch: number, opts?: EaseOptions) { return this.easeTo({ ...opts, pitch }); }
  pitchBy(delta: number, opts?: EaseOptions) { return this.pitchTo(this.getPitch() + delta, opts); }
  rollTo(roll: number, opts?: EaseOptions) { return this.easeTo({ ...opts, roll }); }
  rollBy(delta: number, opts?: EaseOptions) { return this.rollTo(this.getRoll() + delta, opts); }

  easeTo(options: { center?: { x: number; y: number; z?: number }; zoom?: number; bearing?: number; pitch?: number; roll?: number; padding?: Partial<Padding>; offset?: { x: number; y: number } } & EaseOptions) {
    // Reduced motion handling
    const essential = options.essential ?? false;
    const animate = options.animate ?? true;
    if (!essential && browser.reducedMotion()) {
      return this.jumpTo(options);
    }

    const start = {
      center: this.getCenter(),
      zoom: this.getZoom(),
      bearing: this.getBearing(),
      pitch: this.getPitch(),
      roll: this.getRoll(),
      padding: this.getPadding(),
    };
    const target = {
      center: options.center ?? start.center,
      zoom: typeof options.zoom === 'number' ? options.zoom : start.zoom,
      bearing: typeof options.bearing === 'number' ? options.bearing : start.bearing,
      pitch: typeof options.pitch === 'number' ? options.pitch : start.pitch,
      roll: typeof options.roll === 'number' ? options.roll : start.roll,
      padding: options.padding ? { ...start.padding, ...options.padding } : start.padding,
    };
    // Apply offset in screen space to adjust target center
    if (options.offset && (options.offset.x !== 0 || options.offset.y !== 0)) {
      // Apply offset in rotated screen-space relative to target bearing
      const rad = (target.bearing ?? this.getBearing()) * Math.PI / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const ox = options.offset.x, oy = options.offset.y;
      const rx = ox * cos + oy * sin;
      const ry = -ox * sin + oy * cos;
      const s = Math.pow(2, target.zoom);
      const dxW = -rx / s;
      const dyW = ry / s;
      target.center = { x: target.center.x + dxW, y: target.center.y + dyW, z: target.center.z };
    }

    if (!animate) {
      return this.jumpTo(target);
    }

    const duration = Math.max(0, options.duration ?? 300);
    const easing = options.easing ?? defaultEasing;
    // Axis starts
    const axes = {
      zoom: target.zoom !== start.zoom,
      rotate: target.bearing !== start.bearing,
      pitch: target.pitch !== start.pitch,
      roll: target.roll !== start.roll,
    };
    this._startMoveLifecycle();
    this._axisStart(axes);

    if (this._easeAbort) this._easeAbort.abort();
    this._easeAbort = new AbortController();
    const signal = this._easeAbort.signal;

    const t0 = browser.now();
    const loop = () => {
      const now = browser.now();
      const k = Math.min(1, (now - t0) / duration);
      const e = easing(k);

      this.transform.setCenter({
        x: start.center.x + (target.center.x - start.center.x) * e,
        y: start.center.y + (target.center.y - start.center.y) * e,
        z: start.center.z + ((target.center.z ?? 0) - (start.center.z ?? 0)) * e,
      });
      this.transform.setZoom(start.zoom + (target.zoom - start.zoom) * e);
      this.transform.setBearing(start.bearing + (target.bearing - start.bearing) * e);
      this.transform.setPitch(start.pitch + (target.pitch - start.pitch) * e);
      this.transform.setRoll(start.roll + (target.roll - start.roll) * e);
      this.transform.setPadding({
        top: start.padding.top + (target.padding.top - start.padding.top) * e,
        right: start.padding.right + (target.padding.right - start.padding.right) * e,
        bottom: start.padding.bottom + (target.padding.bottom - start.padding.bottom) * e,
        left: start.padding.left + (target.padding.left - start.padding.left) * e,
      });

      this._axisEmitDuring(axes);
      this._emitRender();

      if (k < 1 && !signal.aborted) {
        this._animHandle = raf(loop);
      } else {
        this._animHandle = null;
        // Bearing snap on animation end
        if (axes.rotate) this._applyBearingSnap();
        this._applySoftPanBounds();
        this._axisEnd(axes);
        this._endMoveLifecycle();
      }
    };
    this._animHandle = raf(loop);
    return this;
  }

  flyTo(options: { center?: { x: number; y: number; z?: number }; zoom?: number; bearing?: number; pitch?: number; roll?: number; maxDuration?: number } & FlyToOptions) {
    const startCenter = this.getCenter();
    const endCenter = options.center ?? startCenter;
    const startZoom = this.getZoom();
    const endZoom = typeof options.zoom === 'number' ? options.zoom : startZoom;
    const startBearing = this.getBearing();
    const endBearing = typeof options.bearing === 'number' ? options.bearing : startBearing;
    const startPitch = this.getPitch();
    const endPitch = typeof options.pitch === 'number' ? options.pitch : startPitch;
    const startRoll = this.getRoll();
    const endRoll = typeof options.roll === 'number' ? options.roll : startRoll;

    const dx = endCenter.x - startCenter.x;
    const dy = endCenter.y - startCenter.y;
    const worldDist = Math.hypot(dx, dy);
    const pad = options.padding ?? this.getPadding();
    const effH = Math.max(1, this.transform.height - ((pad?.top ?? 0) + (pad?.bottom ?? 0)));
    const startScale = Math.pow(2, startZoom);
    const pxDist = worldDist * startScale;

    // Determine duration
    let duration = options.duration;
    if (duration == null) {
      if (options.screenSpeed && options.screenSpeed > 0) {
        duration = (pxDist / options.screenSpeed) * 1000;
      } else if (options.speed && options.speed > 0) {
        duration = (pxDist / (options.speed * 100)) * 1000;
      } else {
        duration = 1000;
      }
      if (options.maxDuration != null) duration = Math.min(duration, options.maxDuration);
    }

    // If screenSpeed provided, run a constant-pixel-speed center motion with eased zoom/angles
    const useScreenSpeed = !!options.screenSpeed && options.screenSpeed! > 0 && pxDist > 0;
    if (!useScreenSpeed) {
      // Van Wijk & Nuij-like path with hyperbolic functions
      const rho = Math.max(0.01, Math.min(5, options.curve ?? 1.42));
      const u1 = pxDist; // pixel ground distance at start scale
      // Use effective viewport height as visible span including padding
      const w0 = effH;
      const w1 = w0 * (Math.pow(2, startZoom) / Math.pow(2, endZoom));
      if (u1 < 1e-3) {
        return this.easeTo({ ...options, duration });
      }
      const params = computeFlyParams(w0, w1, u1, rho);
      const S = params.S;
      // If duration not provided, derive from S and speed
      if (options.duration == null) {
        const v = options.speed && options.speed > 0 ? options.speed : 1.2;
        duration = (Math.abs(S) / v) * 1000;
      }
      // Align durations across axes: ensure rotation/pitch/roll can complete
      const degSpeed = 180; // deg/sec baseline
      const pitchSpeed = 120; // deg/sec baseline
      const rollSpeed = 180; // deg/sec baseline
      const rotDur = Math.abs(endBearing - startBearing) / degSpeed * 1000;
      const pitDur = Math.abs(endPitch - startPitch) / pitchSpeed * 1000;
      const rolDur = Math.abs(endRoll - startRoll) / rollSpeed * 1000;
      duration = Math.max(duration!, rotDur, pitDur, rolDur);
      if (options.maxDuration != null) duration = Math.min(duration, options.maxDuration);
      const easing = options.easing ?? defaultEasing;
      this._startMoveLifecycle();
      this._axisStart({ zoom: endZoom !== startZoom, rotate: endBearing !== startBearing, pitch: endPitch !== startPitch, roll: endRoll !== startRoll, pan: worldDist > 0 });
      if (this._easeAbort) this._easeAbort.abort();
      this._easeAbort = new AbortController();
      const signal = this._easeAbort.signal;

      const t0 = browser.now();
      const loop = () => {
        const now = browser.now();
        const k = Math.min(1, (now - t0) / (duration!));
        // Map eased time to s in [0, S]
        const e = easing(k);
        const s = S * e;
        // Width/scale along path
        const w = widthAt(params, s);
        const scaleRatio = w0 / w; // relative to start
        const z = startZoom + Math.log2(scaleRatio);
        // Distance traveled along line in pixels
        const u = uAt(params, s);
        const fu = Math.max(0, Math.min(1, u / u1));
        const cx = startCenter.x + dx * (fu / (worldDist || 1));
        const cy = startCenter.y + dy * (fu / (worldDist || 1));
        // Interpolate angles linearly by eased time
        const b = startBearing + (endBearing - startBearing) * e;
        const p = startPitch + (endPitch - startPitch) * e;
        const rr = startRoll + (endRoll - startRoll) * e;

        this.transform.setZoom(z);
        this.transform.setBearing(b);
        this.transform.setPitch(p);
        this.transform.setRoll(rr);
        this.transform.setCenter({ x: cx, y: cy, z: startCenter.z });

        this._axisEmitDuring({ zoom: endZoom !== startZoom, rotate: endBearing !== startBearing, pitch: endPitch !== startPitch, roll: endRoll !== startRoll, pan: worldDist > 0 });
        this._emitRender();

        if (k < 1 && !signal.aborted) {
          this._animHandle = raf(loop);
        } else {
          this.transform.setZoom(endZoom);
          this.transform.setBearing(endBearing);
          this.transform.setPitch(endPitch);
          this.transform.setRoll(endRoll);
          this.transform.setCenter({ x: endCenter.x, y: endCenter.y, z: endCenter.z ?? startCenter.z });
          if (endBearing !== startBearing) this._applyBearingSnap();
          this._applySoftPanBounds();
          this._axisEnd({ zoom: endZoom !== startZoom, rotate: endBearing !== startBearing, pitch: endPitch !== startPitch, roll: endRoll !== startRoll, pan: worldDist > 0 });
          this._endMoveLifecycle();
          this._animHandle = null;
        }
      };
      this._animHandle = raf(loop);
      return this;
    }

    const easing = options.easing ?? defaultEasing;
    this._startMoveLifecycle();
    this._axisStart({ zoom: endZoom !== startZoom, rotate: endBearing !== startBearing, pitch: endPitch !== startPitch, roll: endRoll !== startRoll, pan: worldDist > 0 });
    if (this._easeAbort) this._easeAbort.abort();
    this._easeAbort = new AbortController();
    const signal = this._easeAbort.signal;

    const t0 = browser.now();
    const dirX = worldDist > 0 ? dx / worldDist : 0;
    const dirY = worldDist > 0 ? dy / worldDist : 0;
    let traveled = 0; // world units
    let last = t0;

    const loop = () => {
      const now = browser.now();
      const k = Math.min(1, (now - t0) / duration!);
      const e = easing(k);

      // Eased zoom/bearing/pitch/roll
      const z = startZoom + (endZoom - startZoom) * e;
      const b = startBearing + (endBearing - startBearing) * e;
      const p = startPitch + (endPitch - startPitch) * e;
      const r = startRoll + (endRoll - startRoll) * e;
      this.transform.setZoom(z);
      this.transform.setBearing(b);
      this.transform.setPitch(p);
      this.transform.setRoll(r);

      // Constant screen speed center motion
      const dt = (now - last) / 1000;
      last = now;
      const scale = Math.pow(2, z);
      const stepWorld = (options.screenSpeed! * dt) / scale;
      traveled = Math.min(worldDist, traveled + stepWorld);
      const cx = startCenter.x + dirX * traveled;
      const cy = startCenter.y + dirY * traveled;
      this.transform.setCenter({ x: cx, y: cy, z: startCenter.z });

      this._axisEmitDuring({ zoom: endZoom !== startZoom, rotate: endBearing !== startBearing, pitch: endPitch !== startPitch, roll: endRoll !== startRoll, pan: worldDist > 0 });
      this._emitRender();

      if (k < 1 && traveled < worldDist && !signal.aborted) {
        this._animHandle = raf(loop);
      } else {
        // Ensure final state
        this.transform.setZoom(endZoom);
        this.transform.setBearing(endBearing);
        this.transform.setPitch(endPitch);
        this.transform.setRoll(endRoll);
        this.transform.setCenter({ x: endCenter.x, y: endCenter.y, z: endCenter.z ?? startCenter.z });
        if (endBearing !== startBearing) this._applyBearingSnap();
        this._applySoftPanBounds();
        this._axisEnd({ zoom: endZoom !== startZoom, rotate: endBearing !== startBearing, pitch: endPitch !== startPitch, roll: endRoll !== startRoll, pan: worldDist > 0 });
        this._endMoveLifecycle();
        this._animHandle = null;
      }
    };
    this._animHandle = raf(loop);
    return this;
  }

  fitBounds(bounds: { min: { x: number; y: number }; max: { x: number; y: number } }, options?: EaseOptions & { offset?: { x: number; y: number } }) {
    const { center, zoom, bearing } = new PlanarCameraHelper().cameraForBoxAndBearing(this.transform, bounds, options);
    return this.easeTo({ center, zoom, bearing, ...options });
  }

  cameraForBounds(bounds: { min: { x: number; y: number }; max: { x: number; y: number } }, options?: EaseOptions & { offset?: { x: number; y: number } }) {
    return new PlanarCameraHelper().cameraForBoxAndBearing(this.transform, bounds, options);
  }

  private _emitRender() {
    this.fire('renderFrame', {});
  }

  private _startMoveLifecycle() {
    if (!this._moving) {
      this._moving = true;
      this.fire('movestart', {});
    }
    this.fire('move', {});
  }

  private _endMoveLifecycle() {
    if (this._moving) {
      this._moving = false;
      this.fire('moveend', {});
    }
  }

  private _externalChange(delta?: { axes?: { pan?: boolean; zoom?: boolean; rotate?: boolean; pitch?: boolean; roll?: boolean }; originalEvent?: Event }) {
    const axes = delta?.axes ?? {};
    this._startMoveLifecycle();
    this._axisStart(axes, delta?.originalEvent);
    this._axisEmitDuring(axes, delta?.originalEvent);
    this._emitRender();
    if (this._moveEndTimer != null) {
      window.clearTimeout(this._moveEndTimer);
    }
    // Debounce moveend after burst of external changes
    this._moveEndTimer = window.setTimeout(() => {
      if (axes.rotate) this._applyBearingSnap(delta?.originalEvent);
      this._applySoftPanBounds();
      this._axisEnd(axes, delta?.originalEvent);
      this._endMoveLifecycle();
      this._moveEndTimer = null;
    }, 120);
  }

  private _axisStart(axes: { zoom?: boolean; rotate?: boolean; pitch?: boolean; roll?: boolean; pan?: boolean }, originalEvent?: Event) {
    if (axes.zoom && !this._zooming) { this._zooming = true; this.fire('zoomstart', { originalEvent }); }
    if (axes.rotate && !this._rotating) { this._rotating = true; this.fire('rotatestart', { originalEvent }); }
    if (axes.pitch && !this._pitching) { this._pitching = true; this.fire('pitchstart', { originalEvent }); }
    if (axes.roll && !this._rolling) { this._rolling = true; this.fire('rollstart', { originalEvent }); }
    if (axes.pan && !this._dragging) { this._dragging = true; this.fire('dragstart', { originalEvent }); }
  }

  private _axisEmitDuring(axes: { zoom?: boolean; rotate?: boolean; pitch?: boolean; roll?: boolean; pan?: boolean }, originalEvent?: Event) {
    if (axes.zoom) this.fire('zoom', { originalEvent });
    if (axes.rotate) this.fire('rotate', { originalEvent });
    if (axes.pitch) this.fire('pitch', { originalEvent });
    if (axes.roll) this.fire('roll', { originalEvent });
    if (axes.pan) this.fire('drag', { originalEvent });
  }

  private _axisEnd(axes: { zoom?: boolean; rotate?: boolean; pitch?: boolean; roll?: boolean; pan?: boolean }, originalEvent?: Event) {
    if (axes.zoom && this._zooming) { this._zooming = false; this.fire('zoomend', { originalEvent }); }
    if (axes.rotate && this._rotating) { this._rotating = false; this.fire('rotateend', { originalEvent }); }
    if (axes.pitch && this._pitching) { this._pitching = false; this.fire('pitchend', { originalEvent }); }
    if (axes.roll && this._rolling) { this._rolling = false; this.fire('rollend', { originalEvent }); }
    if (axes.pan && this._dragging) { this._dragging = false; this.fire('dragend', { originalEvent }); }
  }

  private _endAllAxes() {
    if (this._zooming) { this._zooming = false; this.fire('zoomend', {}); }
    if (this._rotating) { this._applyBearingSnap(); this._rotating = false; this.fire('rotateend', {}); }
    if (this._pitching) { this._pitching = false; this.fire('pitchend', {}); }
    if (this._rolling) { this._rolling = false; this.fire('rollend', {}); }
    if (this._dragging) { this._dragging = false; this.fire('dragend', {}); }
  }

  private _applyBearingSnap(originalEvent?: Event) {
    const snap = this._bearingSnap;
    if (snap > 0) {
      const b = this.getBearing();
      if (Math.abs(b) <= snap + this._bearingSnapEps) {
        this.transform.setBearing(0);
        this.fire('rotate', { originalEvent });
        this._emitRender();
      }
    }
  }

  private _applySoftPanBounds() {
    if (this._softClamping) return;
    const bounds = this._constraints.panBounds;
    if (!bounds) return;
    const c = this.getCenter();
    const clamped = {
      x: Math.max(bounds.min.x, Math.min(bounds.max.x, c.x)),
      y: Math.max(bounds.min.y, Math.min(bounds.max.y, c.y)),
      z: c.z,
    };
    if (clamped.x !== c.x || clamped.y !== c.y) {
      this._softClamping = true;
      // Smooth nudge back to bounds
      this.easeTo({ center: clamped, duration: 180, easing: defaultEasing, essential: true });
      // Clear flag after short delay to avoid recursion
      window.setTimeout(() => { this._softClamping = false; }, 220);
    }
  }
}
