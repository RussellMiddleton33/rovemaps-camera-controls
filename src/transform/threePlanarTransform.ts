import type {
  PerspectiveCamera,
  OrthographicCamera,
  Vector3 as ThreeVector3,
} from 'three';
import { Vector3, Ray, Plane } from 'three';
import { worldSizeForZoom, type ITransform, type ThreePlanarTransformOptions, type Padding, type Center, type Vec2, type TransformConstraints } from './interfaces';
import { clamp, normalizeAngleDeg } from '../util/math';

// Lightweight Vector3 to avoid creating new instances in hot paths
// Consumers are expected to provide pooled vectors when needed.

export class ThreePlanarTransform implements ITransform {
  private _camera: PerspectiveCamera | OrthographicCamera;
  private _width: number;
  private _height: number;
  private _dpr: number;
  private _padding: Padding = { top: 0, right: 0, bottom: 0, left: 0 };
  private _center: Center = { x: 0, y: 0, z: 0 };
  private _zoom = 0; // semantic zoom
  private _bearing = 0; // deg
  private _pitch = 0; // deg
  private _roll = 0; // deg
  private _tileSize: number;
  private _zoomMode: 'fov' | 'dolly';
  private _upAxis: 'y' | 'z';
  private _getGroundIntersection?: (screen: Vec2) => ThreeVector3 | null;
  private _constraints: TransformConstraints = { minZoom: -Infinity, maxZoom: Infinity, minPitch: 0, maxPitch: 85 };
  // pooled objects to avoid allocs in hot path
  private _tmpVec3a = new Vector3();
  private _tmpVec3b = new Vector3();
  private _ray = new Ray();
  private _plane = new Plane();
  private _deferDepth = 0;
  private _needsApply = false;
  private _projDirty = true;

  private _projection?: import('./interfaces').ProjectionAdapter;
  private _baseScale: number;

  constructor(opts: ThreePlanarTransformOptions) {
    this._camera = opts.camera;
    this._width = opts.width;
    this._height = opts.height;
    this._dpr = opts.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    this._tileSize = opts.tileSize ?? 256;
    this._zoomMode = opts.zoomMode ?? 'fov';
    this._upAxis = opts.upAxis ?? 'y';
    this._getGroundIntersection = opts.getGroundIntersection;
    this._projection = opts.projection;
    this._baseScale = opts.baseScale ?? 1;

    // Set camera up axis
    if (this._upAxis === 'z') {
      (this._camera as any).up?.set?.(0, 0, 1);
    } else {
      (this._camera as any).up?.set?.(0, 1, 0);
    }

    this._applyToCamera();
  }

  get camera() { return this._camera; }
  get width() { return this._width; }
  get height() { return this._height; }
  get devicePixelRatio() { return this._dpr; }
  get center() { return this._center; }
  get zoom() { return this._zoom; }
  get bearing() { return this._bearing; }
  get pitch() { return this._pitch; }
  get roll() { return this._roll; }
  get padding() { return this._padding; }
  get worldSize() { return worldSizeForZoom(this._zoom, this._tileSize); }

  // Projection adapter helpers
  projectLngLat(lngLat: [number, number]): { x: number; y: number } {
    if (this._projection) {
      if (this._projection.lngLatToScene) {
        const [x, y] = this._projection.lngLatToScene(lngLat[0], lngLat[1]);
        return { x, y };
      }
      return this._projection.project(lngLat);
    }
    // Default: simple planar with base scale
    return { x: lngLat[0] * this._baseScale, y: lngLat[1] * this._baseScale };
  }

  unprojectPoint(point: { x: number; y: number }): [number, number] {
    if (this._projection) {
      if (this._projection.sceneToLngLat) {
        return this._projection.sceneToLngLat(point.x, point.y);
      }
      return this._projection.unproject(point);
    }
    // Default: simple planar with base scale
    return [point.x / this._baseScale, point.y / this._baseScale];
  }

  setViewport(view: { width: number; height: number; devicePixelRatio?: number; }): void {
    this._width = view.width;
    this._height = view.height;
    if (view.devicePixelRatio) this._dpr = view.devicePixelRatio;
    this._projDirty = true;
    this._applyToCamera();
  }

  setPadding(padding: Partial<Padding>): void {
    this._padding = { ...this._padding, ...padding };
    // padding affects only view computations outside camera matrices; no apply needed
  }

  setCenter(center: Center): void {
    this._center = { x: center.x, y: center.y, z: center.z ?? 0 };
    this._scheduleApply();
  }

  setZoom(zoom: number): void {
    const z = Math.max(this._constraints.minZoom, Math.min(this._constraints.maxZoom, zoom));
    this._zoom = z;
    // Perspective projection matrix does not depend on zoom; orthographic does.
    const cam = this._camera as any;
    if (cam && 'isOrthographicCamera' in cam && cam.isOrthographicCamera) this._projDirty = true;
    this._scheduleApply();
  }

  setBearing(bearing: number): void { this._bearing = normalizeAngleDeg(bearing); this._scheduleApply(); }
  setPitch(pitch: number): void { this._pitch = clamp(pitch, this._constraints.minPitch, this._constraints.maxPitch); this._scheduleApply(); }
  setRoll(roll: number): void { this._roll = normalizeAngleDeg(roll); this._scheduleApply(); }

  setConstraints(constraints: Partial<TransformConstraints>): void {
    this._constraints = { ...this._constraints, ...constraints };
    this.clamp();
  }

  getPanBounds() { return this._constraints.panBounds; }

  deferApply<T>(fn: () => T): T {
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

  screenToWorld(screen: Vec2): ThreeVector3 | null {
    // Custom strategy first
    if (this._getGroundIntersection) return this._getGroundIntersection(screen);
    // Default: intersect with ground plane at y=0 (or z=0 for z-up)
    const ndcX = (screen.x / this._width) * 2 - 1;
    const ndcY = -(screen.y / this._height) * 2 + 1; // invert Y

    // Unproject two points to form a ray
    const pNear = this._tmpVec3a.set(ndcX, ndcY, -1).unproject(this._camera as any);
    const pFar = this._tmpVec3b.set(ndcX, ndcY, 1).unproject(this._camera as any);
    const origin = pNear;
    const dir = pFar.sub(pNear).normalize();
    this._ray.set(origin, dir);

    if (this._upAxis === 'y') {
      this._plane.set(new Vector3(0, 1, 0), 0); // y=0
    } else {
      this._plane.set(new Vector3(0, 0, 1), 0); // z=0
    }
    const hit = this._ray.intersectPlane(this._plane, new Vector3());
    return hit ?? null;
  }

  worldToScreen(world: ThreeVector3): Vec2 | null {
    const v = this._tmpVec3a.copy(world).project(this._camera as any);
    const x = (v.x + 1) * 0.5 * this._width;
    const y = (-v.y + 1) * 0.5 * this._height;
    return { x, y };
  }

  groundFromScreen(screen: { x: number; y: number }) {
    const hit = this.screenToWorld(screen);
    if (!hit) return null;
    // Y-up: ground is XZ plane (y=0), so gx=hit.x, gz=hit.z
    // Z-up: ground is XY plane (z=0), so gx=hit.x, gz=hit.y
    return this._upAxis === 'z' ? { gx: hit.x, gz: hit.y } : { gx: hit.x, gz: hit.z };
  }

  adjustCenterByGroundDelta(dgx: number, dgz: number) {
    this._center = { x: this._center.x + dgx, y: this._center.y + dgz, z: this._center.z };
    this._scheduleApply();
  }

  getGroundCenter() { return { gx: this._center.x, gz: this._center.y }; }
  setGroundCenter(g: { gx: number; gz: number }) {
    this._center = { x: g.gx, y: g.gz, z: this._center.z };
    this._applyToCamera();
  }

  clamp(): void {
    this._pitch = clamp(this._pitch, this._constraints.minPitch, this._constraints.maxPitch);
    this._zoom = clamp(this._zoom, this._constraints.minZoom, this._constraints.maxZoom);
    if (this._constraints.panBounds) {
      const b = this._constraints.panBounds;
      this._center = {
        x: clamp(this._center.x, b.min.x, b.max.x),
        y: clamp(this._center.y, b.min.y, b.max.y),
        z: this._center.z,
      };
    }
    this._scheduleApply();
  }

  private _applyToCamera() {
    const cam = this._camera as any;
    if (!cam) return;

    // Compute target point based on coordinate system
    let targetX: number, targetY: number, targetZ: number;

    if (this._upAxis === 'z') {
      // Z-up: ground plane is XY (z=0)
      targetX = this._center.x;
      targetY = this._center.y;
      targetZ = 0;
    } else {
      // Y-up: ground plane is XZ (y=0)
      targetX = this._center.x;
      targetZ = this._center.y;
      targetY = 0;
    }

    if ('isPerspectiveCamera' in cam && cam.isPerspectiveCamera) {
      // Perspective: compute distance to achieve desired pixels-per-world at center when pitch=0.
      const fovRad = (cam.fov * Math.PI) / 180;
      const s = Math.pow(2, this._zoom); // px per world unit
      const visibleWorldHeight = this._height / s; // world units
      const dist = (visibleWorldHeight / 2) / Math.tan(fovRad / 2);

      // Negate bearing so increasing bearing rotates view clockwise (not camera orbit)
      // Note: Z-up uses positive bearing to correct for handedness difference
      const bearingRad = (this._upAxis === 'z' ? 1 : -1) * (this._bearing * Math.PI) / 180;
      const pitchRad = (this._pitch * Math.PI) / 180;

      // Clamp pitch away from exactly 0 to avoid gimbal lock (like Spherical.makeSafe())
      // Using a small epsilon - need to be large enough to avoid lookAt degeneracy
      const EPS = 0.01; // ~0.57 degrees, small but prevents gimbal lock
      const pitchEff = Math.max(EPS, Math.abs(pitchRad)) * Math.sign(pitchRad || 1);

      if (this._upAxis === 'z') {
        // Z-up: Camera orbits in 3D with Z as vertical axis
        // Pitch=0 is bird's eye (looking straight down), Pitch=90 is horizontal
        const horiz = dist * Math.sin(pitchEff); // Horizontal distance from target
        const z = dist * Math.cos(pitchEff);     // Height above ground

        // Bearing rotates around Z axis (horizontal plane)
        const ox = horiz * Math.sin(bearingRad);
        const oy = horiz * Math.cos(bearingRad);

        cam.position?.set?.(targetX + ox, targetY + oy, targetZ + z);
        cam.up?.set?.(0, 0, 1);
        cam.lookAt?.(targetX, targetY, targetZ);
      } else {
        // Y-up: Camera orbits in 3D with Y as vertical axis
        const horiz = dist * Math.sin(pitchEff);
        const y = dist * Math.cos(pitchEff);
        const ox = horiz * Math.sin(bearingRad);
        const oz = horiz * Math.cos(bearingRad);

        cam.position?.set?.(targetX + ox, targetY + y, targetZ + oz);
        cam.up?.set?.(0, 1, 0);
        cam.lookAt?.(targetX, targetY, targetZ);
      }

      // Apply roll about forward axis
      if (this._roll) {
        const rollRad = (this._roll * Math.PI) / 180;
        const dir = this._tmpVec3a.set(0, 0, -1).applyQuaternion((cam as any).quaternion ?? this._tmpVec3b.set(0,0,-1));
        cam.rotateOnWorldAxis?.(dir, rollRad);
      }

      if (this._projDirty) {
        cam.updateProjectionMatrix?.();
        this._projDirty = false;
      }
      cam.updateMatrixWorld?.();
    } else if ('isOrthographicCamera' in cam && cam.isOrthographicCamera) {
      // Ortho: set frustum to map pixels-per-world
      const s = Math.pow(2, this._zoom);
      const halfW = this._width / (2 * s);
      const halfH = this._height / (2 * s);
      cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;

      // Place camera above ground with pitch and bearing
      const baseDist = 1000; // arbitrary; irrelevant for projection, but needed for near/far
      const bearingRad = (this._upAxis === 'z' ? 1 : -1) * (this._bearing * Math.PI) / 180;
      const pitchRad = (this._pitch * Math.PI) / 180;

      // Clamp pitch away from exactly 0 to avoid gimbal lock (like Spherical.makeSafe())
      // Using a small epsilon - need to be large enough to avoid lookAt degeneracy
      const EPS = 0.01; // ~0.57 degrees, small but prevents gimbal lock
      const pitchEff = Math.max(EPS, Math.abs(pitchRad)) * Math.sign(pitchRad || 1);

      if (this._upAxis === 'z') {
        // Z-up orthographic
        const horiz = baseDist * Math.sin(pitchEff);
        const z = baseDist * Math.cos(pitchEff);
        const ox = -horiz * Math.sin(bearingRad);
        const oy = horiz * Math.cos(bearingRad);

        cam.position?.set?.(targetX + ox, targetY + oy, targetZ + z);
        cam.up?.set?.(0, 0, 1);
        cam.lookAt?.(targetX, targetY, targetZ);
      } else {
        // Y-up orthographic
        const horiz = baseDist * Math.sin(pitchEff);
        const y = baseDist * Math.cos(pitchEff);
        const ox = horiz * Math.sin(bearingRad);
        const oz = horiz * Math.cos(bearingRad);

        cam.position?.set?.(targetX + ox, targetY + y, targetZ + oz);
        cam.up?.set?.(0, 1, 0);
        cam.lookAt?.(targetX, targetY, targetZ);
      }

      if (this._roll) {
        const rollRad = (this._roll * Math.PI) / 180;
        const dir = this._tmpVec3a.set(0, 0, -1).applyQuaternion((cam as any).quaternion ?? this._tmpVec3b.set(0,0,-1));
        cam.rotateOnWorldAxis?.(dir, rollRad);
      }

      // Ortho frustum changes every zoom/viewport change
      cam.updateProjectionMatrix?.();
      cam.updateMatrixWorld?.();
    }
  }

  private _scheduleApply() {
    if (this._deferDepth > 0) {
      this._needsApply = true;
    } else {
      this._applyToCamera();
    }
  }
}
