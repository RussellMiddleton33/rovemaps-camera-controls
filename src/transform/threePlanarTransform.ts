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
  private _constraints: TransformConstraints = { minZoom: -Infinity, maxZoom: Infinity, minPitch: 0.001, maxPitch: 85 };
  // pooled objects to avoid allocs in hot path
  private _tmpVec3a = new Vector3();
  private _tmpVec3b = new Vector3();
  private _ray = new Ray();
  private _plane = new Plane();

  constructor(opts: ThreePlanarTransformOptions) {
    this._camera = opts.camera;
    this._width = opts.width;
    this._height = opts.height;
    this._dpr = opts.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    this._tileSize = opts.tileSize ?? 256;
    this._zoomMode = opts.zoomMode ?? 'fov';
    this._upAxis = opts.upAxis ?? 'y';
    this._getGroundIntersection = opts.getGroundIntersection;
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

  setViewport(view: { width: number; height: number; devicePixelRatio?: number; }): void {
    this._width = view.width;
    this._height = view.height;
    if (view.devicePixelRatio) this._dpr = view.devicePixelRatio;
    this._applyToCamera();
  }

  setPadding(padding: Partial<Padding>): void {
    this._padding = { ...this._padding, ...padding };
  }

  setCenter(center: Center): void {
    this._center = { x: center.x, y: center.y, z: center.z ?? 0 };
    this._applyToCamera();
  }

  setZoom(zoom: number): void {
    const z = Math.max(this._constraints.minZoom, Math.min(this._constraints.maxZoom, zoom));
    this._zoom = z;
    this._applyToCamera();
  }

  setBearing(bearing: number): void { this._bearing = normalizeAngleDeg(bearing); this._applyToCamera(); }
  setPitch(pitch: number): void { this._pitch = clamp(pitch, this._constraints.minPitch, this._constraints.maxPitch); this._applyToCamera(); }
  setRoll(roll: number): void { this._roll = normalizeAngleDeg(roll); this._applyToCamera(); }

  setConstraints(constraints: Partial<TransformConstraints>): void {
    this._constraints = { ...this._constraints, ...constraints };
    this.clamp();
  }

  getPanBounds() { return this._constraints.panBounds; }

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
    return { gx: hit.x, gz: hit.z };
  }

  adjustCenterByGroundDelta(dgx: number, dgz: number) {
    this._center = { x: this._center.x + dgx, y: this._center.y + dgz, z: this._center.z };
    this._applyToCamera();
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
    this._applyToCamera();
  }

  private _applyToCamera() {
    const cam = this._camera as any;
    if (!cam) return;
    if (this._upAxis !== 'y') {
      // Basic support; focus on y-up for now
    }
    // Compute target point on ground plane (y=0) for y-up
    const targetX = this._center.x;
    const targetZ = this._center.y;
    const targetY = 0;

    if ('isPerspectiveCamera' in cam && cam.isPerspectiveCamera) {
      // Perspective: compute distance to achieve desired pixels-per-world at center when pitch=0.
      const fovRad = (cam.fov * Math.PI) / 180;
      const s = Math.pow(2, this._zoom); // px per world unit
      const visibleWorldHeight = this._height / s; // world units
      const dist = (visibleWorldHeight / 2) / Math.tan(fovRad / 2);

      // Bearing (yaw) around Y-up, pitch tilts downward from vertical
      const bearingRad = (this._bearing * Math.PI) / 180;
      const pitchRad = (this._pitch * Math.PI) / 180;
      const horiz = dist * Math.sin(pitchRad);
      const y = dist * Math.cos(pitchRad);
      const ox = horiz * Math.sin(bearingRad);
      const oz = horiz * Math.cos(bearingRad);

      cam.position.set(targetX + ox, targetY + y, targetZ + oz);
      // Handle top-down singularity: when pitch ~ 0, bearing should rotate the view in-plane.
      // Use camera.up to encode bearing so lookAt can orient consistently.
      const eps = 1e-6;
      if (Math.abs(pitchRad) <= eps) {
        // Up vector aligned with ground "north" rotated by bearing
        cam.up.set(Math.sin(bearingRad), 0, Math.cos(bearingRad));
      } else {
        cam.up.set(0, 1, 0);
      }
      cam.lookAt(targetX, targetY, targetZ);
      // Apply roll about forward axis
      if (this._roll) {
        const rollRad = (this._roll * Math.PI) / 180;
        // Rotate camera around its look vector
        const dir = this._tmpVec3a.set(0, 0, -1).applyQuaternion(cam.quaternion);
        cam.rotateOnWorldAxis(dir, rollRad);
      }
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    } else if ('isOrthographicCamera' in cam && cam.isOrthographicCamera) {
      // Ortho: set frustum to map pixels-per-world
      const s = Math.pow(2, this._zoom);
      const halfW = this._width / (2 * s);
      const halfH = this._height / (2 * s);
      cam.left = -halfW; cam.right = halfW; cam.top = halfH; cam.bottom = -halfH;
      // Place camera above ground with pitch and bearing
      const baseDist = 1000; // arbitrary; irrelevant for projection, but needed for near/far
      const bearingRad = (this._bearing * Math.PI) / 180;
      const pitchRad = (this._pitch * Math.PI) / 180;
      const horiz = baseDist * Math.sin(pitchRad);
      const y = baseDist * Math.cos(pitchRad);
      const ox = horiz * Math.sin(bearingRad);
      const oz = horiz * Math.cos(bearingRad);
      cam.position.set(targetX + ox, targetY + y, targetZ + oz);
      const eps = 1e-6;
      if (Math.abs(pitchRad) <= eps) {
        cam.up.set(Math.sin(bearingRad), 0, Math.cos(bearingRad));
      } else {
        cam.up.set(0, 1, 0);
      }
      cam.lookAt(targetX, targetY, targetZ);
      if (this._roll) {
        const rollRad = (this._roll * Math.PI) / 180;
        const dir = this._tmpVec3a.set(0, 0, -1).applyQuaternion(cam.quaternion);
        cam.rotateOnWorldAxis(dir, rollRad);
      }
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    }
  }
}
