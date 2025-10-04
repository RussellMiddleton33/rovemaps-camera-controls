import { Vector3, Ray, Plane } from 'three';

// src/core/evented.ts
var Evented = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Map();
  }
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, /* @__PURE__ */ new Set());
    this.listeners.get(type).add(fn);
    return this;
  }
  once(type, fn) {
    const wrapped = (ev) => {
      this.off(type, wrapped);
      fn(ev);
    };
    return this.on(type, wrapped);
  }
  off(type, fn) {
    const set = this.listeners.get(type);
    if (set) set.delete(fn);
    return this;
  }
  fire(type, ev) {
    const set = this.listeners.get(type);
    if (!set) return this;
    [...set].forEach((fn) => {
      try {
        fn(ev);
      } catch (e) {
        console.error(e);
      }
    });
    return this;
  }
};

// src/util/math.ts
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function mod(n, m) {
  return (n % m + m) % m;
}
function degToRad(d) {
  return d * Math.PI / 180;
}
function radToDeg(r) {
  return r * 180 / Math.PI;
}
function normalizeAngleDeg(a) {
  const n = mod(a + 180, 360) - 180;
  return n === -180 ? 180 : n;
}
function zoomScale(zoomDelta) {
  return Math.pow(2, zoomDelta);
}
function scaleZoom(scale) {
  return Math.log2(scale);
}

// src/helpers/planarCameraHelper.ts
var PlanarCameraHelper = class {
  handleMapControlsPan(transform, dx, dy) {
    const scale = Math.pow(2, transform.zoom);
    const rad = transform.bearing * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dWx = (dx * cos - dy * sin) / scale;
    const dWz = (-dx * sin - dy * cos) / scale;
    transform.setCenter({
      x: transform.center.x + dWx,
      y: transform.center.y + dWz,
      z: transform.center.z
    });
  }
  handleMapControlsRollPitchBearingZoom(transform, dRoll, dPitch, dBearing, dZoom) {
    transform.deferApply(() => {
      transform.setRoll(normalizeAngleDeg(transform.roll + dRoll));
      transform.setPitch(clamp(transform.pitch + dPitch, 0, 85));
      transform.setBearing(normalizeAngleDeg(transform.bearing + dBearing));
      transform.setZoom(transform.zoom + dZoom);
    });
  }
  handleJumpToCenterZoom(transform, center, zoom) {
    if (center) transform.setCenter(center);
    if (typeof zoom === "number") transform.setZoom(zoom);
  }
  handleEaseTo(_transform, _opts) {
  }
  handleFlyTo(_transform, _opts) {
  }
  handlePanInertia(_transform, _vx, _vy) {
  }
  cameraForBoxAndBearing(transform, bounds, options) {
    var _a, _b;
    const bearing = (_a = options == null ? void 0 : options.bearing) != null ? _a : transform.bearing;
    const padding = { ...{ top: 0, right: 0, bottom: 0, left: 0 }, ...options == null ? void 0 : options.padding };
    const offset = (_b = options == null ? void 0 : options.offset) != null ? _b : { x: 0, y: 0 };
    const targetCenter = { x: (bounds.min.x + bounds.max.x) / 2, y: (bounds.min.y + bounds.max.y) / 2 };
    const worldCorners = [
      { x: bounds.min.x, y: bounds.min.y },
      { x: bounds.max.x, y: bounds.min.y },
      { x: bounds.max.x, y: bounds.max.y },
      { x: bounds.min.x, y: bounds.max.y }
    ];
    const saved = {
      center: transform.center,
      zoom: transform.zoom,
      bearing: transform.bearing,
      pitch: transform.pitch,
      roll: transform.roll
    };
    const viewW = Math.max(1, transform.width - (padding.left + padding.right));
    const viewH = Math.max(1, transform.height - (padding.top + padding.bottom));
    let lo = -24, hi = 32;
    const fitAtZoom = (z) => {
      var _a2, _b2;
      transform.setCenter({ x: targetCenter.x, y: targetCenter.y, z: (_a2 = saved.center.z) != null ? _a2 : 0 });
      transform.setBearing(bearing);
      transform.setPitch(saved.pitch);
      transform.setRoll(saved.roll);
      transform.setZoom(z);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of worldCorners) {
        const sp = transform.worldToScreen({ x: c.x, y: 0, z: c.y }) || transform.worldToScreen({ x: c.x, y: (_b2 = saved.center.z) != null ? _b2 : 0, z: c.y });
        const p = sp != null ? sp : { x: 0, y: 0 };
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const w = maxX - minX;
      const h = maxY - minY;
      return { w, h };
    };
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const { w, h } = fitAtZoom(mid);
      if (w <= viewW && h <= viewH) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    const zoom = lo;
    transform.setCenter(saved.center);
    transform.setZoom(saved.zoom);
    transform.setBearing(saved.bearing);
    transform.setPitch(saved.pitch);
    transform.setRoll(saved.roll);
    const center = { ...targetCenter };
    const s = Math.pow(2, zoom);
    const padCx = (padding.right - padding.left) / 2;
    const padCy = (padding.top - padding.bottom) / 2;
    if (padCx !== 0 || padCy !== 0) {
      center.x += -padCx / s;
      center.y += padCy / s;
    }
    if (offset.x !== 0 || offset.y !== 0) {
      const rad2 = bearing * Math.PI / 180;
      const cos2 = Math.cos(rad2), sin2 = Math.sin(rad2);
      const rx = offset.x * cos2 + offset.y * sin2;
      const ry = -offset.x * sin2 + offset.y * cos2;
      center.x += -rx / s;
      center.y += ry / s;
    }
    return { center, zoom, bearing, pitch: transform.pitch };
  }
};

// src/transform/interfaces.ts
var TILE_SIZE = 256;
function worldSizeForZoom(zoom, tileSize = TILE_SIZE) {
  return tileSize * Math.pow(2, zoom);
}

// src/transform/threePlanarTransform.ts
var ThreePlanarTransform = class {
  constructor(opts) {
    this._padding = { top: 0, right: 0, bottom: 0, left: 0 };
    this._center = { x: 0, y: 0, z: 0 };
    this._zoom = 0;
    // semantic zoom
    this._bearing = 0;
    // deg
    this._pitch = 0;
    // deg
    this._roll = 0;
    this._constraints = { minZoom: -Infinity, maxZoom: Infinity, minPitch: 0.01, maxPitch: 85 };
    // pooled objects to avoid allocs in hot path
    this._tmpVec3a = new Vector3();
    this._tmpVec3b = new Vector3();
    this._ray = new Ray();
    this._plane = new Plane();
    this._deferDepth = 0;
    this._needsApply = false;
    this._projDirty = true;
    var _a, _b, _c, _d;
    this._camera = opts.camera;
    this._width = opts.width;
    this._height = opts.height;
    this._dpr = (_a = opts.devicePixelRatio) != null ? _a : typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    this._tileSize = (_b = opts.tileSize) != null ? _b : 256;
    this._zoomMode = (_c = opts.zoomMode) != null ? _c : "fov";
    this._upAxis = (_d = opts.upAxis) != null ? _d : "y";
    this._getGroundIntersection = opts.getGroundIntersection;
    this._applyToCamera();
  }
  get camera() {
    return this._camera;
  }
  get width() {
    return this._width;
  }
  get height() {
    return this._height;
  }
  get devicePixelRatio() {
    return this._dpr;
  }
  get center() {
    return this._center;
  }
  get zoom() {
    return this._zoom;
  }
  get bearing() {
    return this._bearing;
  }
  get pitch() {
    return this._pitch;
  }
  get roll() {
    return this._roll;
  }
  get padding() {
    return this._padding;
  }
  get worldSize() {
    return worldSizeForZoom(this._zoom, this._tileSize);
  }
  setViewport(view) {
    this._width = view.width;
    this._height = view.height;
    if (view.devicePixelRatio) this._dpr = view.devicePixelRatio;
    this._projDirty = true;
    this._applyToCamera();
  }
  setPadding(padding) {
    this._padding = { ...this._padding, ...padding };
  }
  setCenter(center) {
    var _a;
    this._center = { x: center.x, y: center.y, z: (_a = center.z) != null ? _a : 0 };
    this._scheduleApply();
  }
  setZoom(zoom) {
    const z = Math.max(this._constraints.minZoom, Math.min(this._constraints.maxZoom, zoom));
    this._zoom = z;
    const cam = this._camera;
    if (cam && "isOrthographicCamera" in cam && cam.isOrthographicCamera) this._projDirty = true;
    this._scheduleApply();
  }
  setBearing(bearing) {
    this._bearing = normalizeAngleDeg(bearing);
    this._scheduleApply();
  }
  setPitch(pitch) {
    this._pitch = clamp(pitch, this._constraints.minPitch, this._constraints.maxPitch);
    this._scheduleApply();
  }
  setRoll(roll) {
    this._roll = normalizeAngleDeg(roll);
    this._scheduleApply();
  }
  setConstraints(constraints) {
    this._constraints = { ...this._constraints, ...constraints };
    this.clamp();
  }
  getPanBounds() {
    return this._constraints.panBounds;
  }
  deferApply(fn) {
    this._deferDepth++;
    try {
      return fn();
    } finally {
      this._deferDepth--;
      if (this._deferDepth === 0 && this._needsApply) {
        this._applyToCamera();
        this._needsApply = false;
      }
    }
  }
  screenToWorld(screen) {
    if (this._getGroundIntersection) return this._getGroundIntersection(screen);
    const ndcX = screen.x / this._width * 2 - 1;
    const ndcY = -(screen.y / this._height) * 2 + 1;
    const pNear = this._tmpVec3a.set(ndcX, ndcY, -1).unproject(this._camera);
    const pFar = this._tmpVec3b.set(ndcX, ndcY, 1).unproject(this._camera);
    const origin = pNear;
    const dir = pFar.sub(pNear).normalize();
    this._ray.set(origin, dir);
    if (this._upAxis === "y") {
      this._plane.set(new Vector3(0, 1, 0), 0);
    } else {
      this._plane.set(new Vector3(0, 0, 1), 0);
    }
    const hit = this._ray.intersectPlane(this._plane, new Vector3());
    return hit != null ? hit : null;
  }
  worldToScreen(world) {
    const v = this._tmpVec3a.copy(world).project(this._camera);
    const x = (v.x + 1) * 0.5 * this._width;
    const y = (-v.y + 1) * 0.5 * this._height;
    return { x, y };
  }
  groundFromScreen(screen) {
    const hit = this.screenToWorld(screen);
    if (!hit) return null;
    return { gx: hit.x, gz: hit.z };
  }
  adjustCenterByGroundDelta(dgx, dgz) {
    this._center = { x: this._center.x + dgx, y: this._center.y + dgz, z: this._center.z };
    this._scheduleApply();
  }
  getGroundCenter() {
    return { gx: this._center.x, gz: this._center.y };
  }
  setGroundCenter(g) {
    this._center = { x: g.gx, y: g.gz, z: this._center.z };
    this._applyToCamera();
  }
  clamp() {
    this._pitch = clamp(this._pitch, this._constraints.minPitch, this._constraints.maxPitch);
    this._zoom = clamp(this._zoom, this._constraints.minZoom, this._constraints.maxZoom);
    if (this._constraints.panBounds) {
      const b = this._constraints.panBounds;
      this._center = {
        x: clamp(this._center.x, b.min.x, b.max.x),
        y: clamp(this._center.y, b.min.y, b.max.y),
        z: this._center.z
      };
    }
    this._scheduleApply();
  }
  _applyToCamera() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v;
    const cam = this._camera;
    if (!cam) return;
    if (this._upAxis !== "y") ;
    const targetX = this._center.x;
    const targetZ = this._center.y;
    const targetY = 0;
    if ("isPerspectiveCamera" in cam && cam.isPerspectiveCamera) {
      const fovRad = cam.fov * Math.PI / 180;
      const s = Math.pow(2, this._zoom);
      const visibleWorldHeight = this._height / s;
      const dist = visibleWorldHeight / 2 / Math.tan(fovRad / 2);
      const bearingRad = -this._bearing * Math.PI / 180;
      const pitchRad = this._pitch * Math.PI / 180;
      const horiz = dist * Math.sin(pitchRad);
      const y = dist * Math.cos(pitchRad);
      const ox = horiz * Math.sin(bearingRad);
      const oz = horiz * Math.cos(bearingRad);
      (_b = (_a = cam.position) == null ? void 0 : _a.set) == null ? void 0 : _b.call(_a, targetX + ox, targetY + y, targetZ + oz);
      const eps = 1e-6;
      if (Math.abs(pitchRad) <= eps) {
        (_d = (_c = cam.up) == null ? void 0 : _c.set) == null ? void 0 : _d.call(_c, Math.sin(bearingRad), 0, Math.cos(bearingRad));
      } else {
        (_f = (_e = cam.up) == null ? void 0 : _e.set) == null ? void 0 : _f.call(_e, 0, 1, 0);
      }
      (_g = cam.lookAt) == null ? void 0 : _g.call(cam, targetX, targetY, targetZ);
      if (this._roll) {
        const rollRad = this._roll * Math.PI / 180;
        const dir = this._tmpVec3a.set(0, 0, -1).applyQuaternion((_h = cam.quaternion) != null ? _h : this._tmpVec3b.set(0, 0, -1));
        (_i = cam.rotateOnWorldAxis) == null ? void 0 : _i.call(cam, dir, rollRad);
      }
      if (this._projDirty) {
        (_j = cam.updateProjectionMatrix) == null ? void 0 : _j.call(cam);
        this._projDirty = false;
      }
      (_k = cam.updateMatrixWorld) == null ? void 0 : _k.call(cam);
    } else if ("isOrthographicCamera" in cam && cam.isOrthographicCamera) {
      const s = Math.pow(2, this._zoom);
      const halfW = this._width / (2 * s);
      const halfH = this._height / (2 * s);
      cam.left = -halfW;
      cam.right = halfW;
      cam.top = halfH;
      cam.bottom = -halfH;
      const baseDist = 1e3;
      const bearingRad = -this._bearing * Math.PI / 180;
      const pitchRad = this._pitch * Math.PI / 180;
      const horiz = baseDist * Math.sin(pitchRad);
      const y = baseDist * Math.cos(pitchRad);
      const ox = horiz * Math.sin(bearingRad);
      const oz = horiz * Math.cos(bearingRad);
      (_m = (_l = cam.position) == null ? void 0 : _l.set) == null ? void 0 : _m.call(_l, targetX + ox, targetY + y, targetZ + oz);
      const eps = 1e-6;
      if (Math.abs(pitchRad) <= eps) {
        (_o = (_n = cam.up) == null ? void 0 : _n.set) == null ? void 0 : _o.call(_n, Math.sin(bearingRad), 0, Math.cos(bearingRad));
      } else {
        (_q = (_p = cam.up) == null ? void 0 : _p.set) == null ? void 0 : _q.call(_p, 0, 1, 0);
      }
      (_r = cam.lookAt) == null ? void 0 : _r.call(cam, targetX, targetY, targetZ);
      if (this._roll) {
        const rollRad = this._roll * Math.PI / 180;
        const dir = this._tmpVec3a.set(0, 0, -1).applyQuaternion((_s = cam.quaternion) != null ? _s : this._tmpVec3b.set(0, 0, -1));
        (_t = cam.rotateOnWorldAxis) == null ? void 0 : _t.call(cam, dir, rollRad);
      }
      (_u = cam.updateProjectionMatrix) == null ? void 0 : _u.call(cam);
      (_v = cam.updateMatrixWorld) == null ? void 0 : _v.call(cam);
    }
  }
  _scheduleApply() {
    if (this._deferDepth > 0) {
      this._needsApply = true;
    } else {
      this._applyToCamera();
    }
  }
};

// src/util/browser.ts
var browser = {
  now: () => typeof performance !== "undefined" ? performance.now() : Date.now(),
  reducedMotion: () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
};
function raf(callback) {
  if (typeof window === "undefined") return -1;
  return window.requestAnimationFrame(callback);
}
function caf(handle) {
  if (typeof window === "undefined") return;
  window.cancelAnimationFrame(handle);
}

// src/util/easing.ts
var defaultEasing = (t) => t * (2 - t);
function cubicBezier(p1x, p1y, p2x, p2y) {
  const NEWTON_ITER = 5;
  const NEWTON_EPS = 1e-6;
  function A(a1, a2) {
    return 1 - 3 * a2 + 3 * a1;
  }
  function B(a1, a2) {
    return 3 * a2 - 6 * a1;
  }
  function C(a1) {
    return 3 * a1;
  }
  function calcBezier(t, a1, a2) {
    return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  }
  function slope(t, a1, a2) {
    return 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
  }
  return function(x) {
    if (p1x === p1y && p2x === p2y) return x;
    let t = x;
    for (let i = 0; i < NEWTON_ITER; i++) {
      const s = slope(t, p1x, p2x);
      if (Math.abs(s) < NEWTON_EPS) break;
      const x2 = calcBezier(t, p1x, p2x) - x;
      t -= x2 / s;
    }
    const y = calcBezier(Math.max(0, Math.min(1, t)), p1y, p2y);
    return y;
  };
}

// src/util/dom.ts
function on(el, type, listener, options) {
  el.addEventListener(type, listener, options);
  return () => off(el, type, listener, options);
}
function off(el, type, listener, options) {
  el.removeEventListener(type, listener, options);
}

// src/handlers/wheelMode.ts
var WheelClassifier = class {
  constructor() {
    this.lastTs = 0;
    this.mode = null;
    this.hysteresis = 150;
  }
  // ms
  classify(evt) {
    const now = performance.now();
    const dt = now - this.lastTs;
    this.lastTs = now;
    const absDY = Math.abs(evt.deltaY);
    let guess = "wheel";
    if (evt.deltaMode === 0 && (absDY < 6 || dt < 30)) guess = "trackpad";
    if (evt.deltaMode === 1) guess = "wheel";
    if (this.mode === null) {
      this.mode = guess;
    } else if (this.mode !== guess && dt > this.hysteresis) {
      this.mode = guess;
    }
    return this.mode;
  }
};

// src/handlers/scrollZoomHandler.ts
var ScrollZoomHandler = class {
  constructor(el, transform, helper, opts) {
    this.unbind = null;
    this.classifier = new WheelClassifier();
    this.lastMode = null;
    this.lastPointer = { x: 0, y: 0 };
    this.inertiaHandle = null;
    this.velocity = 0;
    // zoom units per second
    this.lastWheelTs = 0;
    this._onWheel = (evt) => {
      var _a;
      if (this.opts.cooperative && !(evt.ctrlKey || evt.metaKey)) {
        this.opts.onCoopGestureHint({ type: "pinch" });
        return;
      }
      if (this.opts.preventDefault) evt.preventDefault();
      const mode = this.classifier.classify(evt);
      if (mode !== this.lastMode) {
        this.lastMode = mode;
        this.opts.onWheelModeChange(mode);
      }
      let dz;
      if (evt.deltaMode === 1) {
        dz = -evt.deltaY * 0.08;
      } else {
        dz = -evt.deltaY / 250;
      }
      const max = this.opts.maxDeltaPerEvent;
      if (dz > max) dz = max;
      if (dz < -max) dz = -max;
      const rect = evt.currentTarget.getBoundingClientRect();
      this.lastPointer.x = evt.clientX - rect.left;
      this.lastPointer.y = evt.clientY - rect.top;
      this.applyZoomAround(dz * ((_a = this.opts.zoomSign) != null ? _a : 1), this.opts.around === "pointer" ? this.lastPointer : null);
      this.opts.onChange({ axes: { zoom: true }, originalEvent: evt });
      const now = performance.now();
      const dt = this.lastWheelTs ? (now - this.lastWheelTs) / 1e3 : 0;
      this.lastWheelTs = now;
      const targetV = dz / (dt || 1 / 60);
      this.velocity = this.velocity * 0.7 + targetV * 0.3;
      if (this.opts.zoomInertia) {
        if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
        this.inertiaHandle = requestAnimationFrame(() => this.runInertia());
      }
    };
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      maxDeltaPerEvent: 0.25,
      preventDefault: true,
      around: "pointer",
      onWheelModeChange: () => {
      },
      onChange: () => {
      },
      cooperative: false,
      onCoopGestureHint: () => {
      },
      zoomSign: 1,
      anchorTightness: 1,
      zoomInertia: false,
      ...opts
    };
  }
  enable() {
    if (typeof window === "undefined") return;
    if (this.unbind) return;
    const off2 = on(this.el, "wheel", this._onWheel, { passive: !this.opts.preventDefault });
    this.unbind = () => {
      off2();
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
  destroy() {
    this.disable();
  }
  applyZoomAround(dz, pointer) {
    var _a;
    if (!pointer) {
      this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, "center");
      return;
    }
    const groundBefore = this.transform.groundFromScreen(pointer);
    this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, "center");
    if (!groundBefore) return;
    const groundAfter = this.transform.groundFromScreen(pointer);
    if (!groundAfter) return;
    const tight = Math.max(0, Math.min(1, (_a = this.opts.anchorTightness) != null ? _a : 1));
    const dgx = (groundBefore.gx - groundAfter.gx) * tight;
    const dgz = (groundBefore.gz - groundAfter.gz) * tight;
    this.transform.adjustCenterByGroundDelta(dgx, dgz);
  }
  runInertia() {
    let lastTime = performance.now();
    const step = () => {
      var _a;
      const now = performance.now();
      const dt = (now - lastTime) / 1e3;
      lastTime = now;
      const decay = Math.exp(-8 * dt);
      this.velocity *= decay;
      if (Math.abs(this.velocity) < 1e-3) {
        this.inertiaHandle = null;
        return;
      }
      const dz = this.velocity * dt * ((_a = this.opts.zoomSign) != null ? _a : 1);
      this.applyZoomAround(dz, this.opts.around === "pointer" ? this.lastPointer : null);
      this.opts.onChange({ axes: { zoom: true } });
      this.inertiaHandle = requestAnimationFrame(step);
    };
    this.inertiaHandle = requestAnimationFrame(step);
  }
};

// src/handlers/mousePanHandler.ts
var MousePanHandler = class {
  constructor(el, transform, helper, opts) {
    this.unbindDown = null;
    this.unbindMoveUp = null;
    this.dragging = false;
    this.startX = 0;
    this.startY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastTs = 0;
    this.vx = 0;
    // px/s
    this.vy = 0;
    // px/s
    this.instVx = 0;
    // last instantaneous px/s
    this.instVy = 0;
    // Ground-space velocity (world units per second)
    this.gvx = 0;
    this.gvz = 0;
    this.igvx = 0;
    // instantaneous ground velocity at last move
    this.igvz = 0;
    this.inertiaHandle = null;
    this.lastGround = null;
    this.rectCache = null;
    this.onDown = (e) => {
      var _a, _b, _c, _d, _e, _f, _g, _h;
      if (e.pointerType !== "mouse") return;
      if (e.button !== this.opts.button) return;
      (_b = (_a = this.el).setPointerCapture) == null ? void 0 : _b.call(_a, e.pointerId);
      this.dragging = false;
      this.startX = this.lastX = e.clientX;
      this.startY = this.lastY = e.clientY;
      this.lastTs = performance.now();
      this.rectCache = this.el.getBoundingClientRect();
      const rect = (_c = this.rectCache) != null ? _c : this.el.getBoundingClientRect();
      const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const gp = (_f = (_e = (_d = this.transform).groundFromScreen) == null ? void 0 : _e.call(_d, pointer)) != null ? _f : null;
      this.lastGround = gp;
      if (this.opts.recenterOnPointerDown && gp) {
        (_h = (_g = this.transform).setGroundCenter) == null ? void 0 : _h.call(_g, gp);
        this.opts.onChange({ axes: { pan: true }, originalEvent: e });
      }
      const offMove = on(window, "pointermove", this.onMove, { passive: false });
      const offUp = on(window, "pointerup", this.onUp, { passive: true });
      this.unbindMoveUp = () => {
        offMove();
        offUp();
      };
    };
    this.onMove = (e) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
      const dx = (e.clientX - this.lastX) * ((_a = this.opts.panXSign) != null ? _a : 1);
      const dy = (e.clientY - this.lastY) * ((_b = this.opts.panYSign) != null ? _b : 1);
      const dt = (performance.now() - this.lastTs) / 1e3;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.lastTs = performance.now();
      if (!this.dragging) {
        const dist = Math.hypot(this.lastX - this.startX, this.lastY - this.startY);
        if (dist < this.opts.dragThresholdPx) return;
        this.dragging = true;
      }
      e.preventDefault();
      const rect = this.el.getBoundingClientRect();
      const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const currGround = (_e = (_d = (_c = this.transform).groundFromScreen) == null ? void 0 : _d.call(_c, pointer)) != null ? _e : null;
      if (this.lastGround && currGround) {
        let dgx = (this.lastGround.gx - currGround.gx) * ((_f = this.opts.panXSign) != null ? _f : 1);
        let dgz = (this.lastGround.gz - currGround.gz) * ((_g = this.opts.panYSign) != null ? _g : 1);
        const bounds = (_i = (_h = this.transform).getPanBounds) == null ? void 0 : _i.call(_h);
        if (bounds) {
          const nextX = this.transform.center.x + dgx;
          const nextY = this.transform.center.y + dgz;
          const overX = nextX < bounds.min.x ? bounds.min.x - nextX : nextX > bounds.max.x ? nextX - bounds.max.x : 0;
          const overY = nextY < bounds.min.y ? bounds.min.y - nextY : nextY > bounds.max.y ? nextY - bounds.max.y : 0;
          const s = this.opts.rubberbandStrength;
          const damp = (o) => o > 0 ? 1 / (1 + o * s) : 1;
          dgx *= damp(overX);
          dgz *= damp(overY);
        }
        (_k = (_j = this.transform).adjustCenterByGroundDelta) == null ? void 0 : _k.call(_j, dgx, dgz);
        const after = (_n = (_m = (_l = this.transform).groundFromScreen) == null ? void 0 : _m.call(_l, pointer)) != null ? _n : null;
        this.lastGround = after != null ? after : currGround;
        if (dt > 0) {
          const alphaG = 0.3;
          const igx = dgx / dt;
          const igz = dgz / dt;
          this.igvx = igx;
          this.igvz = igz;
          this.gvx = this.gvx * (1 - alphaG) + igx * alphaG;
          this.gvz = this.gvz * (1 - alphaG) + igz * alphaG;
        }
      } else {
        this.helper.handleMapControlsPan(this.transform, dx, dy);
        this.lastGround = currGround;
        if (dt > 0) {
          const scale = Math.pow(2, this.transform.zoom);
          const rad = this.transform.bearing * Math.PI / 180;
          const cos = Math.cos(rad), sin = Math.sin(rad);
          const dWx = (-dx * cos + dy * sin) / scale;
          const dWz = (dx * sin + dy * cos) / scale;
          const alphaG = 0.3;
          const igx = dWx / dt;
          const igz = dWz / dt;
          this.igvx = igx;
          this.igvz = igz;
          this.gvx = this.gvx * (1 - alphaG) + igx * alphaG;
          this.gvz = this.gvz * (1 - alphaG) + igz * alphaG;
        }
      }
      this.opts.onChange({ axes: { pan: true }, originalEvent: e });
      if (dt > 0) {
        const alpha = 0.3;
        const sdx = dx;
        const sdy = dy;
        const ivx = sdx / dt;
        const ivy = sdy / dt;
        this.instVx = ivx;
        this.instVy = ivy;
        this.vx = this.vx * (1 - alpha) + ivx * alpha;
        this.vy = this.vy * (1 - alpha) + ivy * alpha;
      }
    };
    this.onUp = (_e) => {
      var _a;
      (_a = this.unbindMoveUp) == null ? void 0 : _a.call(this);
      this.unbindMoveUp = null;
      if (!this.dragging) return;
      this.dragging = false;
      const dot = this.gvx * this.igvx + this.gvz * this.igvz;
      if (dot <= 0) {
        this.gvx = 0;
        this.gvz = 0;
        this.vx = 0;
        this.vy = 0;
      }
      this.rectCache = null;
      if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
      this.inertiaHandle = requestAnimationFrame(() => this.runInertia());
    };
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    const merged = {
      button: 0,
      dragThresholdPx: 3,
      onChange: () => {
      },
      rubberbandStrength: 0.5,
      inertiaPanFriction: 6,
      panXSign: 1,
      panYSign: 1,
      recenterOnPointerDown: false,
      inertiaPanYSign: 1,
      inertiaPanXSign: 1,
      anchorTightness: 1,
      ...opts || {}
    };
    if (opts && "inertiaPanFriction" in opts && opts.inertiaPanFriction == null) delete merged.inertiaPanFriction;
    if (opts && "rubberbandStrength" in opts && opts.rubberbandStrength == null) delete merged.rubberbandStrength;
    this.opts = merged;
  }
  enable() {
    if (typeof window === "undefined" || this.unbindDown) return;
    this.unbindDown = on(this.el, "pointerdown", this.onDown, { passive: true });
  }
  destroy() {
    var _a;
    (_a = this.unbindDown) == null ? void 0 : _a.call(this);
    this.unbindDown = null;
    if (this.unbindMoveUp) {
      this.unbindMoveUp();
      this.unbindMoveUp = null;
    }
    if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
  }
  runInertia() {
    let last = performance.now();
    const friction = Number.isFinite(this.opts.inertiaPanFriction) ? this.opts.inertiaPanFriction : 6;
    const step = () => {
      var _a, _b, _c, _d;
      const now = performance.now();
      const dt = (now - last) / 1e3;
      last = now;
      const decay = Math.exp(-friction * dt);
      this.gvx *= decay;
      this.gvz *= decay;
      if (Math.hypot(this.gvx, this.gvz) < 1e-3) {
        this.inertiaHandle = null;
        return;
      }
      let dgx = this.gvx * dt;
      let dgz = this.gvz * dt;
      const bounds = (_b = (_a = this.transform).getPanBounds) == null ? void 0 : _b.call(_a);
      if (bounds) {
        const nx = this.transform.center.x + dgx;
        const ny = this.transform.center.y + dgz;
        const overX = nx < bounds.min.x ? bounds.min.x - nx : nx > bounds.max.x ? nx - bounds.max.x : 0;
        const overY = ny < bounds.min.y ? bounds.min.y - ny : ny > bounds.max.y ? ny - bounds.max.y : 0;
        const s = this.opts.rubberbandStrength;
        const damp = (o) => o > 0 ? 1 / (1 + o * s) : 1;
        dgx *= damp(overX);
        dgz *= damp(overY);
      }
      (_d = (_c = this.transform).adjustCenterByGroundDelta) == null ? void 0 : _d.call(_c, dgx, dgz);
      this.opts.onChange({ axes: { pan: true } });
      this.inertiaHandle = requestAnimationFrame(step);
    };
    this.inertiaHandle = requestAnimationFrame(step);
  }
};

// src/handlers/mouseRotatePitchHandler.ts
var MouseRotatePitchHandler = class {
  constructor(el, transform, helper, opts) {
    this.unbindDown = null;
    this.unbindMoveUp = null;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.rectCache = null;
    this.onDown = (e) => {
      var _a, _b, _c, _d, _e, _f, _g;
      if (e.pointerType !== "mouse") return;
      const isRotateBtn = e.button === this.opts.rotateButton;
      const wantsPitch = this.opts.pitchModifier === "shift" && e.shiftKey || this.opts.pitchModifier === "alt" && (e.altKey || e.metaKey);
      if (!isRotateBtn && !wantsPitch) return;
      (_b = (_a = this.el).setPointerCapture) == null ? void 0 : _b.call(_a, e.pointerId);
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.rectCache = this.el.getBoundingClientRect();
      if (this.opts.recenterOnPointerDown && this.opts.around === "pointer") {
        const rect = this.el.getBoundingClientRect();
        const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const gp = (_e = (_d = (_c = this.transform).groundFromScreen) == null ? void 0 : _d.call(_c, pointer)) != null ? _e : null;
        if (gp) (_g = (_f = this.transform).setGroundCenter) == null ? void 0 : _g.call(_f, gp);
      }
      const offMove = on(window, "pointermove", this.onMove, { passive: false });
      const offUp = on(window, "pointerup", this.onUp, { passive: true });
      this.unbindMoveUp = () => {
        offMove();
        offUp();
      };
    };
    this.onMove = (e) => {
      var _a, _b, _c, _d, _e, _f;
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      e.preventDefault();
      const aroundPointer = this.opts.around === "pointer";
      const rect = (_a = this.rectCache) != null ? _a : this.el.getBoundingClientRect();
      const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const wantsPitchOnly = this.opts.pitchModifier === "shift" && e.shiftKey || this.opts.pitchModifier === "alt" && (e.altKey || e.metaKey);
      const rotPerPx = (_b = this.opts.sensitivity.rotatePerPx) != null ? _b : 0.3;
      const pitPerPx = (_c = this.opts.sensitivity.pitchPerPx) != null ? _c : 0.25;
      const db = (wantsPitchOnly ? 0 : dx * rotPerPx) * ((_d = this.opts.rotateSign) != null ? _d : 1);
      const dp = -dy * pitPerPx * ((_e = this.opts.pitchSign) != null ? _e : 1);
      const groundBefore = aroundPointer ? this.transform.groundFromScreen(pointer) : null;
      this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dp, db, 0, "center");
      if (aroundPointer && groundBefore) {
        const groundAfter = this.transform.groundFromScreen(pointer);
        if (groundAfter) {
          const tight = Math.max(0, Math.min(1, (_f = this.opts.anchorTightness) != null ? _f : 1));
          const dgx = (groundBefore.gx - groundAfter.gx) * tight;
          const dgz = (groundBefore.gz - groundAfter.gz) * tight;
          this.transform.adjustCenterByGroundDelta(dgx, dgz);
        }
      }
      this.opts.onChange({ axes: { rotate: db !== 0, pitch: dp !== 0 }, originalEvent: e });
    };
    this.onUp = (_e) => {
      var _a;
      if (!this.dragging) return;
      this.dragging = false;
      (_a = this.unbindMoveUp) == null ? void 0 : _a.call(this);
      this.unbindMoveUp = null;
      this.rectCache = null;
    };
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      rotateButton: 2,
      pitchModifier: "shift",
      sensitivity: { rotatePerPx: 0.3, pitchPerPx: 0.25 },
      onChange: () => {
      },
      around: "center",
      rotateSign: 1,
      pitchSign: 1,
      recenterOnPointerDown: false,
      anchorTightness: 1,
      ...opts
    };
  }
  enable() {
    if (typeof window === "undefined" || this.unbindDown) return;
    this.unbindDown = on(this.el, "pointerdown", this.onDown, { passive: true });
  }
  destroy() {
    var _a;
    (_a = this.unbindDown) == null ? void 0 : _a.call(this);
    this.unbindDown = null;
    if (this.unbindMoveUp) {
      this.unbindMoveUp();
      this.unbindMoveUp = null;
    }
  }
};

// src/handlers/touchMultiHandler.ts
var TouchMultiHandler = class {
  constructor(el, transform, helper, opts) {
    this.unbindDown = null;
    this.unbindMoveUp = null;
    this.pts = /* @__PURE__ */ new Map();
    this.active = false;
    this.lastCenter = { x: 0, y: 0 };
    this.lastCenterEl = { x: 0, y: 0 };
    // element-relative centroid to avoid visualViewport drift
    this.lastDist = 0;
    this.lastAngle = 0;
    // radians
    this.mode = "idle";
    this.lastGroundCenter = null;
    // For touch on mobile, recompute bounding rect each move to avoid visualViewport shifts
    this.rectCache = null;
    // unused for move; kept for potential future batching
    this.lastPinchPointer = null;
    // screen coords of last pinch centroid
    this.lastSinglePt = null;
    this.lastSingleGround = null;
    this.lastP0 = null;
    this.lastP1 = null;
    // inertias
    this.vz = 0;
    // zoom units/s
    this.vb = 0;
    // bearing deg/s
    this.vp = 0;
    // pitch deg/s
    this.vpx = 0;
    // pan px/s
    this.vpy = 0;
    this.instVpx = 0;
    // last instantaneous pan px/s
    this.instVpy = 0;
    this.gvx = 0;
    // ground-space pan velocity (world/s)
    this.gvz = 0;
    this.igvx = 0;
    // instantaneous ground-space velocity
    this.igvz = 0;
    this.inertiaHandle = null;
    this.lastTs = 0;
    this.firstTouchDownTs = 0;
    this.gestureStartTs = 0;
    this.firstPitchMoveSeen = false;
    this.allowPitchThisGesture = true;
    this.onDown = (e) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      if (e.pointerType !== "touch") return;
      (_b = (_a = this.el).setPointerCapture) == null ? void 0 : _b.call(_a, e.pointerId);
      this.pts.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
      if (this.pts.size === 1) {
        this.bindMoveUp();
        this.firstTouchDownTs = performance.now();
        const rect = this.el.getBoundingClientRect();
        const vv = window.visualViewport;
        const pointer = { x: e.clientX + ((_c = vv == null ? void 0 : vv.offsetLeft) != null ? _c : 0) - (rect.left + ((_d = vv == null ? void 0 : vv.offsetLeft) != null ? _d : 0)), y: e.clientY + ((_e = vv == null ? void 0 : vv.offsetTop) != null ? _e : 0) - (rect.top + ((_f = vv == null ? void 0 : vv.offsetTop) != null ? _f : 0)) };
        const gp = (_i = (_h = (_g = this.transform).groundFromScreen) == null ? void 0 : _h.call(_g, pointer)) != null ? _i : null;
        this.lastSinglePt = pointer;
        this.lastSingleGround = gp;
        this.active = true;
        this.mode = "pan";
        this.lastTs = performance.now();
      } else if (this.pts.size === 2) {
        this.startGesture(e);
      }
    };
    this.onMove = (e) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R;
      if (e.pointerType !== "touch") return;
      const pt = this.pts.get(e.pointerId);
      if (!pt) return;
      pt.x = e.clientX;
      pt.y = e.clientY;
      if (this.opts.preventDefault) e.preventDefault();
      if (!this.active && this.pts.size === 2) this.startGesture(e);
      if (this.pts.size === 1) {
        const now2 = performance.now();
        const dt2 = Math.max(1 / 120, (now2 - this.lastTs) / 1e3);
        this.lastTs = now2;
        const rect2 = this.el.getBoundingClientRect();
        const vv2 = window.visualViewport;
        const pointer = { x: e.clientX + ((_a = vv2 == null ? void 0 : vv2.offsetLeft) != null ? _a : 0) - (rect2.left + ((_b = vv2 == null ? void 0 : vv2.offsetLeft) != null ? _b : 0)), y: e.clientY + ((_c = vv2 == null ? void 0 : vv2.offsetTop) != null ? _c : 0) - (rect2.top + ((_d = vv2 == null ? void 0 : vv2.offsetTop) != null ? _d : 0)) };
        const gpNow = (_g = (_f = (_e = this.transform).groundFromScreen) == null ? void 0 : _f.call(_e, pointer)) != null ? _g : null;
        if (this.lastSingleGround && gpNow) {
          let dgx = (this.lastSingleGround.gx - gpNow.gx) * ((_h = this.opts.panXSign) != null ? _h : 1);
          let dgz = (this.lastSingleGround.gz - gpNow.gz) * ((_i = this.opts.panYSign) != null ? _i : 1);
          const bounds = (_k = (_j = this.transform).getPanBounds) == null ? void 0 : _k.call(_j);
          if (bounds) {
            const nx = this.transform.center.x + dgx;
            const ny = this.transform.center.y + dgz;
            const overX = nx < bounds.min.x ? bounds.min.x - nx : nx > bounds.max.x ? nx - bounds.max.x : 0;
            const overY = ny < bounds.min.y ? bounds.min.y - ny : ny > bounds.max.y ? ny - bounds.max.y : 0;
            const s2 = this.opts.rubberbandStrength;
            const damp = (o) => o > 0 ? 1 / (1 + o * s2) : 1;
            dgx *= damp(overX);
            dgz *= damp(overY);
          }
          (_m = (_l = this.transform).adjustCenterByGroundDelta) == null ? void 0 : _m.call(_l, dgx, dgz);
          const after = (_p = (_o = (_n = this.transform).groundFromScreen) == null ? void 0 : _o.call(_n, pointer)) != null ? _p : null;
          this.lastSingleGround = after != null ? after : gpNow;
          const alpha = 0.3;
          const igx = dgx / dt2;
          const igz = dgz / dt2;
          this.igvx = igx;
          this.igvz = igz;
          this.gvx = this.gvx * (1 - alpha) + igx * alpha;
          this.gvz = this.gvz * (1 - alpha) + igz * alpha;
          const sdx = pointer.x - ((_r = (_q = this.lastSinglePt) == null ? void 0 : _q.x) != null ? _r : pointer.x);
          const sdy = pointer.y - ((_t = (_s = this.lastSinglePt) == null ? void 0 : _s.y) != null ? _t : pointer.y);
          this.vpx = this.vpx * (1 - alpha) + sdx / dt2 * alpha;
          this.vpy = this.vpy * (1 - alpha) + sdy / dt2 * alpha;
        } else {
          this.lastSingleGround = gpNow;
        }
        this.lastSinglePt = pointer;
        this.opts.onChange({ axes: { pan: true }, originalEvent: e });
        return;
      }
      if (!this.active || this.pts.size < 2) return;
      const rect = this.el.getBoundingClientRect();
      const [p0, p1] = [...this.pts.values()];
      if (!p0 || !p1) return;
      const vv = window.visualViewport;
      const center = { x: (p0.x + p1.x) / 2 + ((_u = vv == null ? void 0 : vv.offsetLeft) != null ? _u : 0) - (rect.left + ((_v = vv == null ? void 0 : vv.offsetLeft) != null ? _v : 0)), y: (p0.y + p1.y) / 2 + ((_w = vv == null ? void 0 : vv.offsetTop) != null ? _w : 0) - (rect.top + ((_x = vv == null ? void 0 : vv.offsetTop) != null ? _x : 0)) };
      this.lastPinchPointer = center;
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const now = performance.now();
      const dt = Math.max(1 / 120, (now - this.lastTs) / 1e3);
      this.lastTs = now;
      const dxPan = (center.x - this.lastCenterEl.x) * ((_y = this.opts.panXSign) != null ? _y : 1);
      const dyPan = (center.y - this.lastCenterEl.y) * ((_z = this.opts.panYSign) != null ? _z : 1);
      const s = this.lastDist > 0 && dist > 0 ? dist / this.lastDist : 1;
      const dzCand = scaleZoom(s);
      let dAng = angle - this.lastAngle;
      if (dAng > Math.PI) dAng -= Math.PI * 2;
      else if (dAng < -Math.PI) dAng += Math.PI * 2;
      const dDeg = radToDeg(dAng);
      const vA = this.lastP0 ? { x: p0.x - this.lastP0.x, y: p0.y - this.lastP0.y } : { x: 0, y: 0 };
      const vB = this.lastP1 ? { x: p1.x - this.lastP1.x, y: p1.y - this.lastP1.y } : { x: 0, y: 0 };
      const movedA = Math.hypot(vA.x, vA.y) >= 2;
      const movedB = Math.hypot(vB.x, vB.y) >= 2;
      const verticalA = Math.abs(vA.y) > Math.abs(vA.x);
      const verticalB = Math.abs(vB.y) > Math.abs(vB.x);
      const sameDir = vA.y > 0 === vB.y > 0;
      const avgDy = (vA.y + vB.y) / 2;
      const dpCand = -avgDy * ((_A = this.opts.pitchPerPx) != null ? _A : 0.25);
      let pitchStrong = this.opts.enablePitch && movedA && movedB && verticalA && verticalB && sameDir;
      if (!this.allowPitchThisGesture) pitchStrong = false;
      const zoomStrong = this.opts.enableZoom && Math.abs(dzCand) >= ((_B = this.opts.zoomThreshold) != null ? _B : 0.04);
      const rotateStrong = this.opts.enableRotate && Math.abs(dDeg) >= ((_C = this.opts.rotateThresholdDeg) != null ? _C : 0.5);
      if (this.mode === "idle") {
        if (pitchStrong) {
          this.mode = "pitch";
        } else if (zoomStrong || rotateStrong) {
          this.mode = "zoomRotate";
        }
      } else if (this.mode === "zoomRotate") {
        if (pitchStrong) this.mode = "pitch";
      } else if (this.mode === "pitch") {
        if (!pitchStrong && (zoomStrong || rotateStrong)) this.mode = "zoomRotate";
      }
      const axes = {};
      if (this.mode === "pan" && this.opts.enablePan) {
        const gp = (_F = (_E = (_D = this.transform).groundFromScreen) == null ? void 0 : _E.call(_D, center)) != null ? _F : null;
        if (gp) {
          if (this.lastGroundCenter) {
            let dgx = (this.lastGroundCenter.gx - gp.gx) * ((_G = this.opts.panXSign) != null ? _G : 1);
            let dgz = (this.lastGroundCenter.gz - gp.gz) * ((_H = this.opts.panYSign) != null ? _H : 1);
            const bounds = (_J = (_I = this.transform).getPanBounds) == null ? void 0 : _J.call(_I);
            if (bounds) {
              const nx = this.transform.center.x + dgx;
              const ny = this.transform.center.y + dgz;
              const overX = nx < bounds.min.x ? bounds.min.x - nx : nx > bounds.max.x ? nx - bounds.max.x : 0;
              const overY = ny < bounds.min.y ? bounds.min.y - ny : ny > bounds.max.y ? ny - bounds.max.y : 0;
              const s2 = this.opts.rubberbandStrength;
              const damp = (o) => o > 0 ? 1 / (1 + o * s2) : 1;
              dgx *= damp(overX);
              dgz *= damp(overY);
            }
            (_L = (_K = this.transform).adjustCenterByGroundDelta) == null ? void 0 : _L.call(_K, dgx, dgz);
            if (dt > 0) {
              const alphaG = 0.3;
              const igx = dgx / dt;
              const igz = dgz / dt;
              this.igvx = igx;
              this.igvz = igz;
              this.gvx = this.gvx * (1 - alphaG) + igx * alphaG;
              this.gvz = this.gvz * (1 - alphaG) + igz * alphaG;
            }
          }
          const after = (_O = (_N = (_M = this.transform).groundFromScreen) == null ? void 0 : _N.call(_M, center)) != null ? _O : null;
          this.lastGroundCenter = after != null ? after : gp;
        } else {
          this.helper.handleMapControlsPan(this.transform, dxPan, dyPan);
        }
        const vdx = dxPan / dt;
        const vdy = dyPan / dt;
        this.instVpx = vdx;
        this.instVpy = vdy;
        const alpha = 0.3;
        this.vpx = this.vpx * (1 - alpha) + vdx * alpha;
        this.vpy = this.vpy * (1 - alpha) + vdy * alpha;
        axes.pan = true;
      } else if (this.mode === "zoomRotate") {
        const ptr = this.opts.around === "pinch" ? center : null;
        const groundBefore = ptr ? this.transform.groundFromScreen(ptr) : null;
        const dRot = this.opts.enableRotate && Math.abs(dDeg) >= this.opts.rotateThresholdDeg ? -dDeg * ((_P = this.opts.rotateSign) != null ? _P : 1) : 0;
        const dZoom = this.opts.enableZoom ? dzCand : 0;
        if (dZoom) {
          this.vz = dZoom / dt;
          axes.zoom = true;
        }
        if (dRot) {
          this.vb = dRot / dt;
          axes.rotate = true;
        }
        if (dZoom || dRot) {
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, dRot, dZoom, "center");
        }
        if (ptr && groundBefore) {
          const groundAfter = this.transform.groundFromScreen(ptr);
          if (groundAfter) {
            const tight = Math.max(0, Math.min(1, (_Q = this.opts.anchorTightness) != null ? _Q : 1));
            let dgx = (groundBefore.gx - groundAfter.gx) * tight;
            let dgz = (groundBefore.gz - groundAfter.gz) * tight;
            const maxShift = 500;
            if (dgx > maxShift) dgx = maxShift;
            else if (dgx < -maxShift) dgx = -maxShift;
            if (dgz > maxShift) dgz = maxShift;
            else if (dgz < -maxShift) dgz = -maxShift;
            this.transform.adjustCenterByGroundDelta(dgx, dgz);
            this.lastGroundCenter = groundAfter;
          }
        }
        this.vpx = 0;
        this.vpy = 0;
        this.gvx = 0;
        this.gvz = 0;
      } else if (this.mode === "pitch" && this.opts.enablePitch) {
        const ptr = this.opts.around === "pinch" ? center : null;
        const groundBefore = ptr ? this.transform.groundFromScreen(ptr) : null;
        if (dpCand) {
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dpCand, 0, 0, "center");
          this.vp = dpCand / dt;
          axes.pitch = true;
        }
        if (ptr && groundBefore) {
          const groundAfter = this.transform.groundFromScreen(ptr);
          if (groundAfter) {
            const tight = Math.max(0, Math.min(1, (_R = this.opts.anchorTightness) != null ? _R : 1));
            const dgx = (groundBefore.gx - groundAfter.gx) * tight;
            const dgz = (groundBefore.gz - groundAfter.gz) * tight;
            this.transform.adjustCenterByGroundDelta(dgx, dgz);
          }
        }
      }
      this.lastCenter = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      this.lastCenterEl = center;
      this.lastDist = dist;
      this.lastAngle = angle;
      this.lastP0 = { ...p0 };
      this.lastP1 = { ...p1 };
      this.opts.onChange({ axes, originalEvent: e });
    };
    this.onUp = (e) => {
      if (e.pointerType !== "touch") return;
      this.pts.delete(e.pointerId);
      if (this.pts.size < 2) {
        if (this.active) {
          this.active = false;
          this.startInertia();
        }
        this.rectCache = null;
      }
      if (this.pts.size === 0 && this.unbindMoveUp) {
        this.unbindMoveUp();
        this.unbindMoveUp = null;
      }
    };
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      enablePan: true,
      enableZoom: true,
      enableRotate: true,
      enablePitch: true,
      pitchPerPx: 0.25,
      // MapLibre-like, reduce accidental mode switching on touch
      rotateThresholdDeg: 0.5,
      // Lower pitch threshold for MapLibre-like responsiveness
      pitchThresholdPx: 5,
      zoomThreshold: 0.04,
      onChange: () => {
      },
      preventDefault: true,
      around: "pinch",
      rubberbandStrength: 0.5,
      panXSign: 1,
      panYSign: 1,
      recenterOnGestureStart: false,
      // Touch-specific: slightly loosen anchor to reduce counter-drift
      anchorTightness: 0.95,
      inertiaPanXSign: 1,
      inertiaPanYSign: 1,
      rotateSign: 1,
      allowedSingleTouchTimeMs: 200,
      // match MapLibre's timing window for deliberate two-finger gestures
      pitchFirstMoveWindowMs: 120,
      inertiaPanFriction: 12,
      inertiaZoomFriction: 20,
      inertiaRotateFriction: 12,
      ...opts
    };
  }
  enable() {
    if (typeof window === "undefined" || this.unbindDown) return;
    this.unbindDown = on(this.el, "pointerdown", this.onDown, { passive: true });
  }
  destroy() {
    var _a;
    (_a = this.unbindDown) == null ? void 0 : _a.call(this);
    this.unbindDown = null;
    if (this.unbindMoveUp) {
      this.unbindMoveUp();
      this.unbindMoveUp = null;
    }
    if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
    this.pts.clear();
  }
  bindMoveUp() {
    if (this.unbindMoveUp) return;
    const offMove = on(window, "pointermove", this.onMove, { passive: !this.opts.preventDefault });
    const offUp = on(window, "pointerup", this.onUp, { passive: true });
    const offCancel = on(window, "pointercancel", this.onUp, { passive: true });
    this.unbindMoveUp = () => {
      offMove();
      offUp();
      offCancel();
    };
  }
  startGesture(_e) {
    var _a, _b, _c, _d, _e2, _f, _g, _h, _i, _j, _k, _l;
    const pts = [...this.pts.values()];
    const [p0, p1] = pts;
    if (!p0 || !p1) return;
    this.lastCenter = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    this.lastDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    this.lastAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    this.lastP0 = { ...p0 };
    this.lastP1 = { ...p1 };
    this.active = true;
    this.lastTs = performance.now();
    this.mode = "idle";
    const now = this.lastTs;
    this.gestureStartTs = now;
    this.firstPitchMoveSeen = false;
    this.allowPitchThisGesture = now - this.firstTouchDownTs <= this.opts.allowedSingleTouchTimeMs;
    const rect = this.el.getBoundingClientRect();
    const vv = window.visualViewport;
    const centerEl = { x: this.lastCenter.x + ((_a = vv == null ? void 0 : vv.offsetLeft) != null ? _a : 0) - (rect.left + ((_b = vv == null ? void 0 : vv.offsetLeft) != null ? _b : 0)), y: this.lastCenter.y + ((_c = vv == null ? void 0 : vv.offsetTop) != null ? _c : 0) - (rect.top + ((_d = vv == null ? void 0 : vv.offsetTop) != null ? _d : 0)) };
    this.lastCenterEl = centerEl;
    const gp = (_g = (_f = (_e2 = this.transform).groundFromScreen) == null ? void 0 : _f.call(_e2, centerEl)) != null ? _g : null;
    this.lastGroundCenter = gp;
    this.rectCache = this.el.getBoundingClientRect();
    if (this.opts.recenterOnGestureStart && this.opts.around === "pinch") {
      this.el.getBoundingClientRect();
      const gp2 = (_j = (_i = (_h = this.transform).groundFromScreen) == null ? void 0 : _i.call(_h, centerEl)) != null ? _j : null;
      if (gp2) (_l = (_k = this.transform).setGroundCenter) == null ? void 0 : _l.call(_k, gp2);
    }
    if (this.inertiaHandle != null) {
      cancelAnimationFrame(this.inertiaHandle);
      this.inertiaHandle = null;
    }
  }
  applyZoomAround(dz, pointer) {
    var _a;
    if (!pointer) {
      this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, "center");
      return;
    }
    const before = this.transform.groundFromScreen(pointer);
    this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, "center");
    if (!before) return;
    const after = this.transform.groundFromScreen(pointer);
    if (!after) return;
    const tight = Math.max(0, Math.min(1, (_a = this.opts.anchorTightness) != null ? _a : 1));
    let dgx = (before.gx - after.gx) * tight;
    let dgz = (before.gz - after.gz) * tight;
    const maxShift = 500;
    if (dgx > maxShift) dgx = maxShift;
    else if (dgx < -maxShift) dgx = -maxShift;
    if (dgz > maxShift) dgz = maxShift;
    else if (dgz < -maxShift) dgz = -maxShift;
    this.transform.adjustCenterByGroundDelta(dgx, dgz);
  }
  startInertia() {
    var _a, _b, _c;
    if (this.inertiaHandle != null) cancelAnimationFrame(this.inertiaHandle);
    if (this.mode !== "pan") {
      this.vpx = 0;
      this.vpy = 0;
      this.gvx = 0;
      this.gvz = 0;
    }
    const d = this.vpx * this.instVpx + this.vpy * this.instVpy;
    if (d <= 0) {
      this.vpx = 0;
      this.vpy = 0;
    }
    const panSpeed = Math.hypot(this.vpx, this.vpy);
    const minPanSpeed = 80;
    if (panSpeed < minPanSpeed) {
      this.vpx = 0;
      this.vpy = 0;
      this.gvx = 0;
      this.gvz = 0;
    }
    const maxPanSpeed = 1400;
    if (panSpeed > maxPanSpeed) {
      const k = maxPanSpeed / panSpeed;
      this.vpx *= k;
      this.vpy *= k;
      this.gvx *= k;
      this.gvz *= k;
    }
    this.vz = 0;
    if (Math.abs(this.vb) < 8) this.vb = 0;
    if (Math.abs(this.vp) < 8) this.vp = 0;
    let last = performance.now();
    const frPan = (_a = this.opts.inertiaPanFriction) != null ? _a : 12;
    const frZoom = (_b = this.opts.inertiaZoomFriction) != null ? _b : 20;
    const frAng = (_c = this.opts.inertiaRotateFriction) != null ? _c : 12;
    const step = () => {
      var _a2, _b2, _c2, _d, _e;
      const now = performance.now();
      const dt = (now - last) / 1e3;
      last = now;
      const decayPan = Math.exp(-frPan * dt);
      const decayZoom = Math.exp(-frZoom * dt);
      const decayAng = Math.exp(-frAng * dt);
      this.vpx *= decayPan;
      this.vpy *= decayPan;
      this.vz *= decayZoom;
      this.vb *= decayAng;
      this.vp *= decayAng;
      const zAbs = Math.abs(this.vz), bAbs = Math.abs(this.vb), pAbs = Math.abs(this.vp), panAbs = Math.hypot(this.vpx, this.vpy);
      if (zAbs < 1e-3 && bAbs < 0.01 && pAbs < 0.01 && panAbs < 2) {
        this.inertiaHandle = null;
        return;
      }
      const dz = this.vz * dt;
      const db = this.vb * dt;
      const dp = this.vp * dt;
      this.vpx * dt;
      this.vpy * dt;
      const axes = {};
      if (this.mode === "zoomRotate") {
        if (this.opts.enableZoom && dz) {
          this.applyZoomAround(dz, (_a2 = this.lastPinchPointer) != null ? _a2 : null);
          axes.zoom = true;
        }
        if (this.opts.enableRotate && db) {
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, db, 0, "center");
          axes.rotate = true;
        }
      } else if (this.mode === "pitch") {
        if (this.opts.enablePitch && dp) {
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, dp, 0, 0, "center");
          axes.pitch = true;
        }
      } else if (this.mode === "pan") {
        if (this.opts.enablePan && (this.gvx || this.gvz)) {
          let dgx = this.gvx * dt;
          let dgz = this.gvz * dt;
          const bounds = (_c2 = (_b2 = this.transform).getPanBounds) == null ? void 0 : _c2.call(_b2);
          if (bounds) {
            const nx = this.transform.center.x + dgx;
            const ny = this.transform.center.y + dgz;
            const overX = nx < bounds.min.x ? bounds.min.x - nx : nx > bounds.max.x ? nx - bounds.max.x : 0;
            const overY = ny < bounds.min.y ? bounds.min.y - ny : ny > bounds.max.y ? ny - bounds.max.y : 0;
            const s = this.opts.rubberbandStrength;
            const damp = (o) => o > 0 ? 1 / (1 + o * s) : 1;
            dgx *= damp(overX);
            dgz *= damp(overY);
          }
          (_e = (_d = this.transform).adjustCenterByGroundDelta) == null ? void 0 : _e.call(_d, dgx, dgz);
          axes.pan = true;
        }
      }
      this.opts.onChange({ axes });
      this.inertiaHandle = requestAnimationFrame(step);
    };
    this.inertiaHandle = requestAnimationFrame(step);
  }
};

// src/handlers/keyboardHandler.ts
function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return true;
  return false;
}
var KeyboardHandler = class {
  constructor(el, transform, helper, opts) {
    this.unbind = null;
    this.onKey = (e) => {
      if (isEditableTarget(e.target)) return;
      let handled = false;
      const axes = {};
      const step = this.opts.panStepPx * (e.shiftKey ? 2 : 1);
      switch (e.key) {
        case "ArrowUp":
          this.helper.handleMapControlsPan(this.transform, 0, -step);
          axes.pan = true;
          handled = true;
          break;
        case "ArrowDown":
          this.helper.handleMapControlsPan(this.transform, 0, step);
          axes.pan = true;
          handled = true;
          break;
        case "ArrowLeft":
          this.helper.handleMapControlsPan(this.transform, -step, 0);
          axes.pan = true;
          handled = true;
          break;
        case "ArrowRight":
          this.helper.handleMapControlsPan(this.transform, step, 0);
          axes.pan = true;
          handled = true;
          break;
        case "+":
        case "=":
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, this.opts.zoomDelta, "center");
          axes.zoom = true;
          handled = true;
          break;
        case "-":
        case "_":
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, -this.opts.zoomDelta, "center");
          axes.zoom = true;
          handled = true;
          break;
        case "q":
        case "Q":
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, -this.opts.rotateStepDeg, 0, "center");
          axes.rotate = true;
          handled = true;
          break;
        case "e":
        case "E":
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, this.opts.rotateStepDeg, 0, "center");
          axes.rotate = true;
          handled = true;
          break;
        case "PageUp":
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, this.opts.pitchStepDeg, 0, 0, "center");
          axes.pitch = true;
          handled = true;
          break;
        case "PageDown":
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, -this.opts.pitchStepDeg, 0, 0, "center");
          axes.pitch = true;
          handled = true;
          break;
      }
      if (handled) {
        if (this.opts.preventDefault) e.preventDefault();
        this.opts.onChange({ axes, originalEvent: e });
      }
    };
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      panStepPx: 100,
      zoomDelta: 0.25,
      rotateStepDeg: 15,
      pitchStepDeg: 5,
      preventDefault: true,
      onChange: () => {
      },
      ...opts
    };
  }
  enable() {
    if (typeof window === "undefined" || this.unbind) return;
    const off2 = on(window, "keydown", this.onKey, { passive: !this.opts.preventDefault });
    this.unbind = () => off2();
  }
  destroy() {
    var _a;
    (_a = this.unbind) == null ? void 0 : _a.call(this);
    this.unbind = null;
  }
};

// src/handlers/dblclickHandler.ts
var DblclickHandler = class {
  constructor(el, transform, helper, opts) {
    this.unbind = null;
    this.lastTap = null;
    this.onDblClick = (e) => {
      if (this.opts.preventDefault) e.preventDefault();
      const rect = this.el.getBoundingClientRect();
      const pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const dz = this.getZoomDelta(e.shiftKey);
      this.applyZoomAround(dz, this.opts.around === "pointer" ? pointer : null);
      this.opts.onChange({ axes: { zoom: true }, originalEvent: e });
    };
    this.onPointerDown = (e) => {
      if (e.pointerType !== "touch") return;
      const now = performance.now();
      const rect = this.el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const prev = this.lastTap;
      this.lastTap = { t: now, x, y };
      if (prev && now - prev.t < 300 && Math.hypot(x - prev.x, y - prev.y) < 25) {
        const dz = this.getZoomDelta(false);
        this.applyZoomAround(dz, { x, y });
        this.opts.onChange({ axes: { zoom: true }, originalEvent: e });
        this.lastTap = null;
      }
    };
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      zoomDelta: 1,
      invertWithShift: true,
      around: "pointer",
      preventDefault: true,
      onChange: () => {
      },
      anchorTightness: 1,
      ...opts
    };
  }
  enable() {
    if (typeof window === "undefined" || this.unbind) return;
    const offDbl = on(this.el, "dblclick", this.onDblClick, { passive: !this.opts.preventDefault });
    const offDown = on(this.el, "pointerdown", this.onPointerDown, { passive: true });
    this.unbind = () => {
      offDbl();
      offDown();
    };
  }
  destroy() {
    var _a;
    (_a = this.unbind) == null ? void 0 : _a.call(this);
    this.unbind = null;
  }
  getZoomDelta(shift) {
    let dz = this.opts.zoomDelta;
    if (this.opts.invertWithShift && shift) dz = -dz;
    return dz;
  }
  applyZoomAround(dz, pointer) {
    var _a;
    if (!pointer) {
      this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, "center");
      return;
    }
    const groundBefore = this.transform.groundFromScreen(pointer);
    this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, "center");
    if (!groundBefore) return;
    const groundAfter = this.transform.groundFromScreen(pointer);
    if (!groundAfter) return;
    const tight = Math.max(0, Math.min(1, (_a = this.opts.anchorTightness) != null ? _a : 1));
    const dgx = (groundBefore.gx - groundAfter.gx) * tight;
    const dgz = (groundBefore.gz - groundAfter.gz) * tight;
    this.transform.adjustCenterByGroundDelta(dgx, dgz);
  }
};

// src/handlers/boxZoomHandler.ts
var BoxZoomHandler = class {
  constructor(el, transform, helper, opts) {
    this.unbindDown = null;
    this.unbindMoveUp = null;
    this.startPt = null;
    this.curPt = null;
    this.onDown = (e) => {
      const wants = this.opts.triggerModifier === "shift" ? e.shiftKey : false;
      if (!wants || e.button !== 0) return;
      const rect = this.el.getBoundingClientRect();
      this.startPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      this.curPt = { ...this.startPt };
      const offMove = on(window, "pointermove", this.onMove, { passive: false });
      const offUp = on(window, "pointerup", this.onUp, { passive: true });
      this.unbindMoveUp = () => {
        offMove();
        offUp();
      };
    };
    this.onMove = (e) => {
      if (!this.startPt) return;
      if (this.opts.preventDefault) e.preventDefault();
      const rect = this.el.getBoundingClientRect();
      this.curPt = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    this.onUp = (_e) => {
      if (!this.startPt || !this.curPt) return this.cleanup();
      const minX = Math.min(this.startPt.x, this.curPt.x);
      const minY = Math.min(this.startPt.y, this.curPt.y);
      const maxX = Math.max(this.startPt.x, this.curPt.x);
      const maxY = Math.max(this.startPt.y, this.curPt.y);
      const area = (maxX - minX) * (maxY - minY);
      if (area >= this.opts.minAreaPx) {
        const pMin = { x: minX, y: minY };
        const pMax = { x: maxX, y: maxY };
        const wMin = this.transform.screenToWorld(pMin);
        const wMax = this.transform.screenToWorld(pMax);
        if (wMin && wMax) {
          const bounds = { min: { x: Math.min(wMin.x, wMax.x), y: Math.min(wMin.y, wMax.y) }, max: { x: Math.max(wMin.x, wMax.x), y: Math.max(wMin.y, wMax.y) } };
          const cam = this.helper.cameraForBoxAndBearing(this.transform, bounds);
          this.transform.setCenter(cam.center);
          this.transform.setZoom(cam.zoom);
          this.opts.onChange({ axes: { pan: true, zoom: true } });
        } else {
          const scaleX = this.transform.width / (maxX - minX);
          const scaleY = this.transform.height / (maxY - minY);
          const zoomDelta = Math.log2(Math.min(scaleX, scaleY));
          this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, zoomDelta, "center");
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          const world = this.transform.screenToWorld({ x: cx, y: cy });
          if (world) {
            this.transform.setCenter({ x: world.x, y: world.y, z: this.transform.center.z });
          }
          this.opts.onChange({ axes: { pan: true, zoom: true } });
        }
      }
      this.cleanup();
    };
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = {
      triggerModifier: "shift",
      minAreaPx: 64,
      preventDefault: true,
      onChange: () => {
      },
      ...opts
    };
  }
  enable() {
    if (typeof window === "undefined" || this.unbindDown) return;
    this.unbindDown = on(this.el, "pointerdown", this.onDown, { passive: true });
  }
  destroy() {
    var _a;
    (_a = this.unbindDown) == null ? void 0 : _a.call(this);
    this.unbindDown = null;
    if (this.unbindMoveUp) {
      this.unbindMoveUp();
      this.unbindMoveUp = null;
    }
  }
  cleanup() {
    this.startPt = null;
    this.curPt = null;
    if (this.unbindMoveUp) {
      this.unbindMoveUp();
      this.unbindMoveUp = null;
    }
  }
};

// src/handlers/safariGestureHandler.ts
var SafariGestureHandler = class {
  constructor(el, transform, helper, opts) {
    this.bound = false;
    this.startScale = 1;
    this.startRotation = 0;
    this.lastGround = null;
    this.onStart = (e) => {
      var _a, _b;
      this.startScale = e.scale || 1;
      this.startRotation = e.rotation || 0;
      const rect = this.el.getBoundingClientRect();
      const pointer = this.opts.around === "pointer" ? { x: ((_a = e.clientX) != null ? _a : rect.width / 2) - rect.left, y: ((_b = e.clientY) != null ? _b : rect.height / 2) - rect.top } : null;
      this.lastGround = pointer ? this.transform.groundFromScreen(pointer) : null;
    };
    this.onChange = (e) => {
      var _a, _b, _c, _d, _e, _f, _g;
      (_a = e.preventDefault) == null ? void 0 : _a.call(e);
      const rect = this.el.getBoundingClientRect();
      const pointer = this.opts.around === "pointer" ? { x: ((_b = e.clientX) != null ? _b : rect.width / 2) - rect.left, y: ((_c = e.clientY) != null ? _c : rect.height / 2) - rect.top } : null;
      const scale = (e.scale || 1) / (this.startScale || 1);
      const dz = scaleZoom(scale) * ((_d = this.opts.zoomSign) != null ? _d : 1);
      const drot = ((e.rotation || 0) - (this.startRotation || 0)) * ((_e = this.opts.rotateSign) != null ? _e : 1);
      const gpNow = pointer ? this.transform.groundFromScreen(pointer) : null;
      if (gpNow && this.lastGround) {
        const tight = Math.max(0, Math.min(1, (_f = this.opts.anchorTightness) != null ? _f : 1));
        const dgxMov = (this.lastGround.gx - gpNow.gx) * tight;
        const dgzMov = (this.lastGround.gz - gpNow.gz) * tight;
        this.transform.adjustCenterByGroundDelta(dgxMov, dgzMov);
      }
      const gpBefore = pointer ? this.transform.groundFromScreen(pointer) : null;
      if (dz) this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, 0, dz, "center");
      if (drot) this.helper.handleMapControlsRollPitchBearingZoom(this.transform, 0, 0, drot, 0, "center");
      if (pointer && gpBefore) {
        const gpAfter = this.transform.groundFromScreen(pointer);
        if (gpAfter) {
          const tight = Math.max(0, Math.min(1, (_g = this.opts.anchorTightness) != null ? _g : 1));
          this.transform.adjustCenterByGroundDelta((gpBefore.gx - gpAfter.gx) * tight, (gpBefore.gz - gpAfter.gz) * tight);
        }
      }
      this.lastGround = gpNow;
      this.opts.onChange({ axes: { zoom: !!dz, rotate: !!drot } });
    };
    this.onEnd = (_e) => {
      this.lastGround = null;
    };
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    this.opts = { enabled: false, around: "pointer", onChange: () => {
    }, rotateSign: 1, zoomSign: 1, anchorTightness: 1, ...opts || {} };
  }
  enable() {
    if (this.bound || !this.opts.enabled) return;
    this.bound = true;
    this.el.addEventListener("gesturestart", this.onStart, { passive: true });
    this.el.addEventListener("gesturechange", this.onChange, { passive: false });
    this.el.addEventListener("gestureend", this.onEnd, { passive: true });
  }
  destroy() {
    if (!this.bound) return;
    this.el.removeEventListener("gesturestart", this.onStart);
    this.el.removeEventListener("gesturechange", this.onChange);
    this.el.removeEventListener("gestureend", this.onEnd);
    this.bound = false;
  }
};

// src/handlers/handlerManager.ts
var HandlerManager = class {
  constructor(el, transform, helper, options) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    this.el = el;
    this.transform = transform;
    this.helper = helper;
    if ((_a = options == null ? void 0 : options.suppressContextMenu) != null ? _a : true) {
      this.onCtx = (e) => e.preventDefault();
      this.el.addEventListener("contextmenu", this.onCtx, { capture: true });
      window.addEventListener("contextmenu", this.onCtx, { capture: true });
    }
    const scrollOpts = options == null ? void 0 : options.scrollZoom;
    if (scrollOpts) {
      this.scroll = new ScrollZoomHandler(
        this.el,
        this.transform,
        this.helper,
        { anchorTightness: options == null ? void 0 : options.anchorTightness, ...typeof scrollOpts === "object" ? scrollOpts : {}, onChange: options == null ? void 0 : options.onChange }
      );
      this.scroll.enable();
    }
    const mpOpts = (_b = options == null ? void 0 : options.mousePan) != null ? _b : {};
    const basePan = {
      onChange: options == null ? void 0 : options.onChange,
      rubberbandStrength: options == null ? void 0 : options.rubberbandStrength,
      ...typeof mpOpts === "object" ? mpOpts : {}
    };
    if ((options == null ? void 0 : options.inertiaPanFriction) != null) basePan.inertiaPanFriction = options.inertiaPanFriction;
    this.mousePan = new MousePanHandler(this.el, this.transform, this.helper, basePan);
    this.mousePan.enable();
    if (options == null ? void 0 : options.rightButtonPan) {
      const basePanSecondary = {
        onChange: options == null ? void 0 : options.onChange,
        rubberbandStrength: options == null ? void 0 : options.rubberbandStrength,
        ...typeof mpOpts === "object" ? mpOpts : {},
        button: 2
      };
      if ((options == null ? void 0 : options.inertiaPanFriction) != null) basePanSecondary.inertiaPanFriction = options.inertiaPanFriction;
      this.mousePanSecondary = new MousePanHandler(this.el, this.transform, this.helper, basePanSecondary);
      this.mousePanSecondary.enable();
    } else {
      const mrpOpts = (_c = options == null ? void 0 : options.mouseRotatePitch) != null ? _c : {};
      const mrpBase = {
        onChange: options == null ? void 0 : options.onChange,
        ...typeof mrpOpts === "object" ? mrpOpts : {}
      };
      if ((options == null ? void 0 : options.anchorTightness) != null) mrpBase.anchorTightness = options.anchorTightness;
      this.mouseRotatePitch = new MouseRotatePitchHandler(this.el, this.transform, this.helper, mrpBase);
      this.mouseRotatePitch.enable();
    }
    const touchOpts = (_d = options == null ? void 0 : options.touch) != null ? _d : {};
    const touchBase = typeof touchOpts === "object" ? { ...touchOpts } : { onChange: options == null ? void 0 : options.onChange };
    if ((options == null ? void 0 : options.anchorTightness) != null) touchBase.anchorTightness = options.anchorTightness;
    if ((options == null ? void 0 : options.rubberbandStrength) != null) touchBase.rubberbandStrength = options.rubberbandStrength;
    if ((options == null ? void 0 : options.inertiaPanFriction) != null) touchBase.inertiaPanFriction = options.inertiaPanFriction;
    if ((options == null ? void 0 : options.inertiaZoomFriction) != null) touchBase.inertiaZoomFriction = options.inertiaZoomFriction;
    if ((options == null ? void 0 : options.inertiaRotateFriction) != null) touchBase.inertiaRotateFriction = options.inertiaRotateFriction;
    this.touch = new TouchMultiHandler(this.el, this.transform, this.helper, touchBase);
    this.touch.enable();
    const kbOpts = (_e = options == null ? void 0 : options.keyboard) != null ? _e : {};
    this.keyboard = new KeyboardHandler(
      this.el,
      this.transform,
      this.helper,
      typeof kbOpts === "object" ? kbOpts : { onChange: options == null ? void 0 : options.onChange }
    );
    this.keyboard.enable();
    const dblOpts = (_f = options == null ? void 0 : options.dblclick) != null ? _f : {};
    this.dblclick = new DblclickHandler(
      this.el,
      this.transform,
      this.helper,
      typeof dblOpts === "object" ? dblOpts : { onChange: options == null ? void 0 : options.onChange }
    );
    this.dblclick.enable();
    const boxOpts = (_g = options == null ? void 0 : options.boxZoom) != null ? _g : {};
    this.boxZoom = new BoxZoomHandler(
      this.el,
      this.transform,
      this.helper,
      typeof boxOpts === "object" ? boxOpts : { onChange: options == null ? void 0 : options.onChange }
    );
    this.boxZoom.enable();
    const sg = (_h = options == null ? void 0 : options.safariGestures) != null ? _h : false;
    const touchCapable = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    if (sg && !touchCapable) {
      this.safariGestures = new SafariGestureHandler(
        this.el,
        this.transform,
        this.helper,
        typeof sg === "object" ? { onChange: options == null ? void 0 : options.onChange, anchorTightness: options == null ? void 0 : options.anchorTightness, ...sg, enabled: true } : { enabled: true, onChange: options == null ? void 0 : options.onChange, anchorTightness: options == null ? void 0 : options.anchorTightness }
      );
      this.safariGestures.enable();
    }
  }
  dispose() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    if (this.onCtx) {
      this.el.removeEventListener("contextmenu", this.onCtx, { capture: true });
      window.removeEventListener("contextmenu", this.onCtx, { capture: true });
      this.onCtx = void 0;
    }
    (_a = this.scroll) == null ? void 0 : _a.destroy();
    (_b = this.mousePan) == null ? void 0 : _b.destroy();
    (_c = this.mousePanSecondary) == null ? void 0 : _c.destroy();
    (_d = this.mouseRotatePitch) == null ? void 0 : _d.destroy();
    (_e = this.touch) == null ? void 0 : _e.destroy();
    (_f = this.keyboard) == null ? void 0 : _f.destroy();
    (_g = this.dblclick) == null ? void 0 : _g.destroy();
    (_h = this.boxZoom) == null ? void 0 : _h.destroy();
    (_i = this.safariGestures) == null ? void 0 : _i.destroy();
  }
};

// src/util/flight.ts
function computeFlyParams(w0, w1, u1, rho) {
  const rho2 = rho * rho;
  if (u1 < 1e-9) {
    const S2 = 0;
    return { rho, w0, w1, u1, b: 0, r0: 0, r1: 0, S: S2 };
  }
  const b = (w1 * w1 - w0 * w0 + rho2 * rho2 * u1 * u1) / (2 * w0 * rho2 * u1);
  const sqrtTerm = Math.sqrt(Math.max(0, b * b + 1));
  const r0 = Math.log(sqrtTerm - b);
  const r1 = Math.log(sqrtTerm + b);
  const S = r1 - r0;
  return { rho, w0, w1, u1, b, r0, r1, S };
}
function widthAt(params, s) {
  const r = params.r0 + s;
  const coshr0 = Math.cosh(params.r0);
  const coshr = Math.cosh(r);
  return params.w0 * (coshr0 / coshr);
}
function uAt(params, s) {
  const r = params.r0 + s;
  const coshr0 = Math.cosh(params.r0);
  const tanhr = Math.tanh(r);
  const sinhr0 = Math.sinh(params.r0);
  const rho2 = params.rho * params.rho;
  return params.w0 * (coshr0 * tanhr - sinhr0) / rho2;
}

// src/core/cameraController.ts
var CameraController = class extends Evented {
  constructor(opts) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m;
    super();
    this._moving = false;
    this._animHandle = null;
    this._bearingSnapEps = 1e-3;
    this._moveEndTimer = null;
    this._zooming = false;
    this._rotating = false;
    this._pitching = false;
    this._rolling = false;
    this._dragging = false;
    this._constraints = { minZoom: -Infinity, maxZoom: Infinity, minPitch: 0.01, maxPitch: 85 };
    this._softClamping = false;
    if (typeof window === "undefined") {
      this._camera = opts.camera;
      this._dom = {};
      this._helper = new PlanarCameraHelper();
      this.transform = new ThreePlanarTransform({
        camera: opts.camera,
        width: (_a = opts.width) != null ? _a : 0,
        height: (_b = opts.height) != null ? _b : 0,
        devicePixelRatio: opts.devicePixelRatio
      });
      this._bearingSnap = (_c = opts.bearingSnap) != null ? _c : 7;
      return;
    }
    this._camera = opts.camera;
    this._dom = opts.domElement;
    this._helper = new PlanarCameraHelper();
    this.transform = new ThreePlanarTransform({
      camera: opts.camera,
      width: (_d = opts.width) != null ? _d : this._dom.clientWidth,
      height: (_e = opts.height) != null ? _e : this._dom.clientHeight,
      devicePixelRatio: opts.devicePixelRatio
    });
    this._bearingSnap = (_f = opts.bearingSnap) != null ? _f : 7;
    this._bearingSnapEps = (_g = opts.bearingSnapEpsilon) != null ? _g : 1e-3;
    this._constraints = {
      minZoom: (_h = opts.minZoom) != null ? _h : -Infinity,
      maxZoom: (_i = opts.maxZoom) != null ? _i : Infinity,
      minPitch: (_j = opts.minPitch) != null ? _j : 0.01,
      maxPitch: (_k = opts.maxPitch) != null ? _k : 85,
      panBounds: opts.panBounds
    };
    this.transform.setConstraints(this._constraints);
    this._handlers = new HandlerManager(this._dom, this.transform, this._helper, {
      scrollZoom: (_m = (_l = opts.handlers) == null ? void 0 : _l.scrollZoom) != null ? _m : { around: "center" },
      onChange: (delta) => this._externalChange(delta)
    });
  }
  dispose() {
    var _a, _b;
    if (this._animHandle != null) {
      caf(this._animHandle);
      this._animHandle = null;
    }
    if (this._easeAbort) this._easeAbort.abort();
    (_a = this._handlers) == null ? void 0 : _a.dispose();
    if (this._moveEndTimer != null) {
      (_b = globalThis.clearTimeout) == null ? void 0 : _b.call(globalThis, this._moveEndTimer);
      this._moveEndTimer = null;
    }
    this._endAllAxes();
  }
  setViewport(view) {
    this.transform.setViewport(view);
  }
  getCenter() {
    return this.transform.center;
  }
  getZoom() {
    return this.transform.zoom;
  }
  getBearing() {
    return this.transform.bearing;
  }
  getPitch() {
    return this.transform.pitch;
  }
  getRoll() {
    return this.transform.roll;
  }
  getPadding() {
    return this.transform.padding;
  }
  isMoving() {
    return this._moving;
  }
  isZooming() {
    return this._zooming;
  }
  isRotating() {
    return this._rotating;
  }
  isPitching() {
    return this._pitching;
  }
  isRolling() {
    return this._rolling;
  }
  setCenter(center) {
    this.transform.setCenter(center);
    this._emitRender();
    return this;
  }
  setZoom(zoom) {
    this.transform.setZoom(zoom);
    this._emitRender();
    return this;
  }
  setBearing(bearing) {
    this.transform.setBearing(bearing);
    this._emitRender();
    return this;
  }
  setPitch(pitch) {
    this.transform.setPitch(pitch);
    this._emitRender();
    return this;
  }
  setRoll(roll) {
    this.transform.setRoll(roll);
    this._emitRender();
    return this;
  }
  setPadding(padding) {
    this.transform.setPadding(padding);
    this._emitRender();
    return this;
  }
  setConstraints(c) {
    this._constraints = { ...this._constraints, ...c };
    this.transform.setConstraints(this._constraints);
    this._emitRender();
    return this;
  }
  jumpTo(options) {
    if (options.center) this.transform.setCenter(options.center);
    if (typeof options.zoom === "number") this.transform.setZoom(options.zoom);
    if (typeof options.bearing === "number") this.transform.setBearing(options.bearing);
    if (typeof options.pitch === "number") this.transform.setPitch(options.pitch);
    if (typeof options.roll === "number") this.transform.setRoll(options.roll);
    if (options.padding) this.transform.setPadding(options.padding);
    this._emitRender();
    return this;
  }
  panBy(offset, _opts) {
    this._helper.handleMapControlsPan(this.transform, offset.x, offset.y);
    this._emitRender();
    return this;
  }
  panTo(center, opts) {
    return this.easeTo({ ...opts, center });
  }
  zoomTo(zoom, opts) {
    return this.easeTo({ ...opts, zoom });
  }
  zoomIn(delta = 1, opts) {
    return this.zoomTo(this.getZoom() + delta, opts);
  }
  zoomOut(delta = 1, opts) {
    return this.zoomTo(this.getZoom() - delta, opts);
  }
  rotateTo(bearing, opts) {
    return this.easeTo({ ...opts, bearing });
  }
  rotateBy(delta, opts) {
    return this.rotateTo(this.getBearing() + delta, opts);
  }
  pitchTo(pitch, opts) {
    return this.easeTo({ ...opts, pitch });
  }
  pitchBy(delta, opts) {
    return this.pitchTo(this.getPitch() + delta, opts);
  }
  rollTo(roll, opts) {
    return this.easeTo({ ...opts, roll });
  }
  rollBy(delta, opts) {
    return this.rollTo(this.getRoll() + delta, opts);
  }
  easeTo(options) {
    var _a, _b, _c, _d, _e, _f, _g;
    const essential = (_a = options.essential) != null ? _a : false;
    const animate = (_b = options.animate) != null ? _b : true;
    if (!essential && browser.reducedMotion()) {
      return this.jumpTo(options);
    }
    const start = {
      center: this.getCenter(),
      zoom: this.getZoom(),
      bearing: this.getBearing(),
      pitch: this.getPitch(),
      roll: this.getRoll(),
      padding: this.getPadding()
    };
    const target = {
      center: (_c = options.center) != null ? _c : start.center,
      zoom: typeof options.zoom === "number" ? options.zoom : start.zoom,
      bearing: typeof options.bearing === "number" ? options.bearing : start.bearing,
      pitch: typeof options.pitch === "number" ? options.pitch : start.pitch,
      roll: typeof options.roll === "number" ? options.roll : start.roll,
      padding: options.padding ? { ...start.padding, ...options.padding } : start.padding
    };
    if (options.offset && (options.offset.x !== 0 || options.offset.y !== 0)) {
      const rad = ((_d = target.bearing) != null ? _d : this.getBearing()) * Math.PI / 180;
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
    const duration = Math.max(0, (_e = options.duration) != null ? _e : 300);
    const easing = (_f = options.easing) != null ? _f : defaultEasing;
    const axes = {
      zoom: target.zoom !== start.zoom,
      rotate: target.bearing !== start.bearing,
      pitch: target.pitch !== start.pitch,
      roll: target.roll !== start.roll,
      pan: !!(options.center || options.offset || options.around === "pointer")
    };
    this._startMoveLifecycle();
    this._axisStart(axes);
    if (this._easeAbort) this._easeAbort.abort();
    this._easeAbort = new AbortController();
    const signal = this._easeAbort.signal;
    const t0 = browser.now();
    const anchorPt = options.aroundPoint;
    const useAnchor = options.around === "pointer" && !!anchorPt;
    const tight = Math.max(0, Math.min(1, (_g = options.anchorTightness) != null ? _g : 1));
    const loop = () => {
      const now = browser.now();
      const k = Math.min(1, (now - t0) / duration);
      const e = easing(k);
      const groundBefore = useAnchor ? this.transform.groundFromScreen(anchorPt) : null;
      this.transform.deferApply(() => {
        var _a2, _b2;
        const startZ = (_a2 = start.center.z) != null ? _a2 : 0;
        const targetZ = (_b2 = target.center.z) != null ? _b2 : 0;
        this.transform.setCenter({
          x: start.center.x + (target.center.x - start.center.x) * e,
          y: start.center.y + (target.center.y - start.center.y) * e,
          z: startZ + (targetZ - startZ) * e
        });
        this.transform.setZoom(start.zoom + (target.zoom - start.zoom) * e);
        this.transform.setBearing(start.bearing + (target.bearing - start.bearing) * e);
        this.transform.setPitch(start.pitch + (target.pitch - start.pitch) * e);
        this.transform.setRoll(start.roll + (target.roll - start.roll) * e);
        this.transform.setPadding({
          top: start.padding.top + (target.padding.top - start.padding.top) * e,
          right: start.padding.right + (target.padding.right - start.padding.right) * e,
          bottom: start.padding.bottom + (target.padding.bottom - start.padding.bottom) * e,
          left: start.padding.left + (target.padding.left - start.padding.left) * e
        });
      });
      if (groundBefore) {
        const groundAfter = this.transform.groundFromScreen(anchorPt);
        if (groundAfter) {
          const dgx = (groundBefore.gx - groundAfter.gx) * tight;
          const dgz = (groundBefore.gz - groundAfter.gz) * tight;
          if (dgx || dgz) this.transform.adjustCenterByGroundDelta(dgx, dgz);
        }
      }
      this._axisEmitDuring(axes);
      this._emitRender();
      if (k < 1 && !signal.aborted) {
        this._animHandle = raf(loop);
      } else {
        this._animHandle = null;
        if (axes.rotate) this._applyBearingSnap();
        this._applySoftPanBounds();
        this._axisEnd(axes);
        this._endMoveLifecycle();
      }
    };
    this._animHandle = raf(loop);
    return this;
  }
  flyTo(options) {
    var _a, _b, _c, _d, _e, _f, _g;
    const startCenter = this.getCenter();
    const endCenter = (_a = options.center) != null ? _a : startCenter;
    const startZoom = this.getZoom();
    const endZoom = typeof options.zoom === "number" ? options.zoom : startZoom;
    const startBearing = this.getBearing();
    const endBearing = typeof options.bearing === "number" ? options.bearing : startBearing;
    const startPitch = this.getPitch();
    const endPitch = typeof options.pitch === "number" ? options.pitch : startPitch;
    const startRoll = this.getRoll();
    const endRoll = typeof options.roll === "number" ? options.roll : startRoll;
    const dx = endCenter.x - startCenter.x;
    const dy = endCenter.y - startCenter.y;
    const worldDist = Math.hypot(dx, dy);
    const pad = (_b = options.padding) != null ? _b : this.getPadding();
    const effH = Math.max(1, this.transform.height - (((_c = pad == null ? void 0 : pad.top) != null ? _c : 0) + ((_d = pad == null ? void 0 : pad.bottom) != null ? _d : 0)));
    const startScale = Math.pow(2, startZoom);
    const pxDist = worldDist * startScale;
    let duration = options.duration;
    if (duration == null) {
      if (options.screenSpeed && options.screenSpeed > 0) {
        duration = pxDist / options.screenSpeed * 1e3;
      } else if (options.speed && options.speed > 0) {
        duration = pxDist / (options.speed * 100) * 1e3;
      } else {
        duration = 1e3;
      }
      if (options.maxDuration != null) duration = Math.min(duration, options.maxDuration);
    }
    const useScreenSpeed = !!options.screenSpeed && options.screenSpeed > 0 && pxDist > 0;
    if (!useScreenSpeed) {
      const rho = Math.max(0.01, Math.min(5, (_e = options.curve) != null ? _e : 1.42));
      const u1 = pxDist;
      const w0 = effH;
      const w1 = w0 * (Math.pow(2, startZoom) / Math.pow(2, endZoom));
      if (u1 < 1e-3) {
        return this.easeTo({ ...options, duration });
      }
      const params = computeFlyParams(w0, w1, u1, rho);
      const S = params.S;
      if (options.duration == null) {
        const v = options.speed && options.speed > 0 ? options.speed : 1.2;
        duration = Math.abs(S) / v * 1e3;
      }
      const degSpeed = 180;
      const pitchSpeed = 120;
      const rollSpeed = 180;
      const rotDur = Math.abs(endBearing - startBearing) / degSpeed * 1e3;
      const pitDur = Math.abs(endPitch - startPitch) / pitchSpeed * 1e3;
      const rolDur = Math.abs(endRoll - startRoll) / rollSpeed * 1e3;
      duration = Math.max(duration, rotDur, pitDur, rolDur);
      if (options.maxDuration != null) duration = Math.min(duration, options.maxDuration);
      const easing2 = (_f = options.easing) != null ? _f : defaultEasing;
      this._startMoveLifecycle();
      this._axisStart({ zoom: endZoom !== startZoom, rotate: endBearing !== startBearing, pitch: endPitch !== startPitch, roll: endRoll !== startRoll, pan: worldDist > 0 });
      if (this._easeAbort) this._easeAbort.abort();
      this._easeAbort = new AbortController();
      const signal2 = this._easeAbort.signal;
      const t02 = browser.now();
      const loop2 = () => {
        const now = browser.now();
        const k = Math.min(1, (now - t02) / duration);
        const e = easing2(k);
        const s = S * e;
        const w = widthAt(params, s);
        const scaleRatio = w0 / w;
        const z = startZoom + Math.log2(scaleRatio);
        const u = uAt(params, s);
        const fu = Math.max(0, Math.min(1, u / u1));
        const cx = startCenter.x + dx * (fu / (worldDist || 1));
        const cy = startCenter.y + dy * (fu / (worldDist || 1));
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
        if (k < 1 && !signal2.aborted) {
          this._animHandle = raf(loop2);
        } else {
          this.transform.deferApply(() => {
            var _a2;
            this.transform.setZoom(endZoom);
            this.transform.setBearing(endBearing);
            this.transform.setPitch(endPitch);
            this.transform.setRoll(endRoll);
            this.transform.setCenter({ x: endCenter.x, y: endCenter.y, z: (_a2 = endCenter.z) != null ? _a2 : startCenter.z });
          });
          if (endBearing !== startBearing) this._applyBearingSnap();
          this._applySoftPanBounds();
          this._axisEnd({ zoom: endZoom !== startZoom, rotate: endBearing !== startBearing, pitch: endPitch !== startPitch, roll: endRoll !== startRoll, pan: worldDist > 0 });
          this._endMoveLifecycle();
          this._animHandle = null;
        }
      };
      this._animHandle = raf(loop2);
      return this;
    }
    const easing = (_g = options.easing) != null ? _g : defaultEasing;
    this._startMoveLifecycle();
    this._axisStart({ zoom: endZoom !== startZoom, rotate: endBearing !== startBearing, pitch: endPitch !== startPitch, roll: endRoll !== startRoll, pan: worldDist > 0 });
    if (this._easeAbort) this._easeAbort.abort();
    this._easeAbort = new AbortController();
    const signal = this._easeAbort.signal;
    const t0 = browser.now();
    const dirX = worldDist > 0 ? dx / worldDist : 0;
    const dirY = worldDist > 0 ? dy / worldDist : 0;
    let traveled = 0;
    let last = t0;
    const loop = () => {
      const now = browser.now();
      const k = Math.min(1, (now - t0) / duration);
      const e = easing(k);
      const z = startZoom + (endZoom - startZoom) * e;
      const b = startBearing + (endBearing - startBearing) * e;
      const p = startPitch + (endPitch - startPitch) * e;
      const r = startRoll + (endRoll - startRoll) * e;
      this.transform.deferApply(() => {
        this.transform.setZoom(z);
        this.transform.setBearing(b);
        this.transform.setPitch(p);
        this.transform.setRoll(r);
      });
      const dt = (now - last) / 1e3;
      last = now;
      const scale = Math.pow(2, z);
      const stepWorld = options.screenSpeed * dt / scale;
      traveled = Math.min(worldDist, traveled + stepWorld);
      const cx = startCenter.x + dirX * traveled;
      const cy = startCenter.y + dirY * traveled;
      this.transform.setCenter({ x: cx, y: cy, z: startCenter.z });
      this._axisEmitDuring({ zoom: endZoom !== startZoom, rotate: endBearing !== startBearing, pitch: endPitch !== startPitch, roll: endRoll !== startRoll, pan: worldDist > 0 });
      this._emitRender();
      if (k < 1 && traveled < worldDist && !signal.aborted) {
        this._animHandle = raf(loop);
      } else {
        this.transform.deferApply(() => {
          var _a2;
          this.transform.setZoom(endZoom);
          this.transform.setBearing(endBearing);
          this.transform.setPitch(endPitch);
          this.transform.setRoll(endRoll);
          this.transform.setCenter({ x: endCenter.x, y: endCenter.y, z: (_a2 = endCenter.z) != null ? _a2 : startCenter.z });
        });
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
  fitBounds(bounds, options) {
    const { center, zoom, bearing } = new PlanarCameraHelper().cameraForBoxAndBearing(this.transform, bounds, options);
    return this.easeTo({ center, zoom, bearing, ...options });
  }
  cameraForBounds(bounds, options) {
    return new PlanarCameraHelper().cameraForBoxAndBearing(this.transform, bounds, options);
  }
  _emitRender() {
    this.fire("renderFrame", {});
  }
  _startMoveLifecycle() {
    if (!this._moving) {
      this._moving = true;
      this.fire("movestart", {});
    }
    this.fire("move", {});
  }
  _endMoveLifecycle() {
    if (this._moving) {
      this._moving = false;
      this.fire("moveend", {});
    }
  }
  _externalChange(delta) {
    var _a, _b, _c;
    const axes = (_a = delta == null ? void 0 : delta.axes) != null ? _a : {};
    this._startMoveLifecycle();
    this._axisStart(axes, delta == null ? void 0 : delta.originalEvent);
    this._axisEmitDuring(axes, delta == null ? void 0 : delta.originalEvent);
    this._emitRender();
    if (this._moveEndTimer != null) {
      (_b = globalThis.clearTimeout) == null ? void 0 : _b.call(globalThis, this._moveEndTimer);
    }
    this._moveEndTimer = (_c = globalThis.setTimeout) == null ? void 0 : _c.call(globalThis, () => {
      if (axes.rotate) this._applyBearingSnap(delta == null ? void 0 : delta.originalEvent);
      this._applySoftPanBounds();
      this._axisEnd(axes, delta == null ? void 0 : delta.originalEvent);
      this._endMoveLifecycle();
      this._moveEndTimer = null;
    }, 120);
  }
  _axisStart(axes, originalEvent) {
    if (axes.zoom && !this._zooming) {
      this._zooming = true;
      this.fire("zoomstart", { originalEvent });
    }
    if (axes.rotate && !this._rotating) {
      this._rotating = true;
      this.fire("rotatestart", { originalEvent });
    }
    if (axes.pitch && !this._pitching) {
      this._pitching = true;
      this.fire("pitchstart", { originalEvent });
    }
    if (axes.roll && !this._rolling) {
      this._rolling = true;
      this.fire("rollstart", { originalEvent });
    }
    if (axes.pan && !this._dragging) {
      this._dragging = true;
      this.fire("dragstart", { originalEvent });
    }
  }
  _axisEmitDuring(axes, originalEvent) {
    if (axes.zoom) this.fire("zoom", { originalEvent });
    if (axes.rotate) this.fire("rotate", { originalEvent });
    if (axes.pitch) this.fire("pitch", { originalEvent });
    if (axes.roll) this.fire("roll", { originalEvent });
    if (axes.pan) this.fire("drag", { originalEvent });
  }
  _axisEnd(axes, originalEvent) {
    if (axes.zoom && this._zooming) {
      this._zooming = false;
      this.fire("zoomend", { originalEvent });
    }
    if (axes.rotate && this._rotating) {
      this._rotating = false;
      this.fire("rotateend", { originalEvent });
    }
    if (axes.pitch && this._pitching) {
      this._pitching = false;
      this.fire("pitchend", { originalEvent });
    }
    if (axes.roll && this._rolling) {
      this._rolling = false;
      this.fire("rollend", { originalEvent });
    }
    if (axes.pan && this._dragging) {
      this._dragging = false;
      this.fire("dragend", { originalEvent });
    }
  }
  _endAllAxes() {
    if (this._zooming) {
      this._zooming = false;
      this.fire("zoomend", {});
    }
    if (this._rotating) {
      this._applyBearingSnap();
      this._rotating = false;
      this.fire("rotateend", {});
    }
    if (this._pitching) {
      this._pitching = false;
      this.fire("pitchend", {});
    }
    if (this._rolling) {
      this._rolling = false;
      this.fire("rollend", {});
    }
    if (this._dragging) {
      this._dragging = false;
      this.fire("dragend", {});
    }
  }
  _applyBearingSnap(originalEvent) {
    const snap = this._bearingSnap;
    if (snap > 0) {
      const b = this.getBearing();
      if (Math.abs(b) <= snap + this._bearingSnapEps) {
        this.transform.setBearing(0);
        this.fire("rotate", { originalEvent });
        this._emitRender();
      }
    }
  }
  _applySoftPanBounds() {
    var _a;
    if (this._softClamping) return;
    const bounds = this._constraints.panBounds;
    if (!bounds) return;
    const c = this.getCenter();
    const clamped = {
      x: Math.max(bounds.min.x, Math.min(bounds.max.x, c.x)),
      y: Math.max(bounds.min.y, Math.min(bounds.max.y, c.y)),
      z: c.z
    };
    if (clamped.x !== c.x || clamped.y !== c.y) {
      this._softClamping = true;
      this.easeTo({ center: clamped, duration: 180, easing: defaultEasing, essential: true });
      (_a = globalThis.setTimeout) == null ? void 0 : _a.call(globalThis, () => {
        this._softClamping = false;
      }, 220);
    }
  }
};

// src/public.ts
function createController(options) {
  return new CameraController(options);
}
function createControllerForNext(options) {
  if (typeof window === "undefined") {
    return {
      // no-op stub API for server
      dispose() {
      },
      setViewport() {
      },
      isSSRStub: true
    };
  }
  const resolved = typeof options === "function" ? options() : options;
  return new CameraController(resolved);
}

export { CameraController, Evented, TILE_SIZE, browser, caf, clamp, createController, createControllerForNext, cubicBezier, defaultEasing, degToRad, lerp, mod, normalizeAngleDeg, off, on, radToDeg, raf, scaleZoom, worldSizeForZoom, zoomScale };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map