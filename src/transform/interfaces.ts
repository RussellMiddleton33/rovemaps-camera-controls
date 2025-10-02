import type { Camera, PerspectiveCamera, OrthographicCamera, Vector3 } from 'three';

export type Padding = { top: number; right: number; bottom: number; left: number };

export type Vec2 = { x: number; y: number };

export type Center = { x: number; y: number; z?: number };
export type GroundPoint = { gx: number; gz: number };

export interface IReadonlyTransform {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  readonly center: Center;
  readonly zoom: number;
  readonly bearing: number; // degrees
  readonly pitch: number; // degrees
  readonly roll: number; // degrees
  readonly padding: Padding;
  readonly worldSize: number; // analogous to MapLibre worldSize at current zoom
}

export interface ITransform extends IReadonlyTransform {
  setViewport(view: { width: number; height: number; devicePixelRatio?: number }): void;
  setPadding(padding: Partial<Padding>): void;
  setCenter(center: Center): void;
  setZoom(zoom: number): void;
  setBearing(bearing: number): void;
  setPitch(pitch: number): void;
  setRoll(roll: number): void;
  setConstraints(constraints: Partial<TransformConstraints>): void;
  getPanBounds(): Bounds2D | undefined;
  // Batch multiple setters into a single camera application for perf
  deferApply<T>(fn: () => T): T;

  // Coordinate conversions depend on projection; planar implements via a ground plane
  screenToWorld(screen: Vec2): Vector3 | null;
  worldToScreen(world: Vector3): Vec2 | null;
  // Ground helpers for planar projections (y-up, ground plane y=0)
  groundFromScreen(screen: Vec2): GroundPoint | null;
  adjustCenterByGroundDelta(dgx: number, dgz: number): void;
  getGroundCenter(): GroundPoint;
  setGroundCenter(g: GroundPoint): void;
  clamp(): void;
}

export type GroundIntersectionFn = (screen: Vec2) => Vector3 | null;

export type ZoomMode = 'fov' | 'dolly';

export interface ThreePlanarTransformOptions {
  camera: PerspectiveCamera | OrthographicCamera;
  width: number;
  height: number;
  devicePixelRatio?: number;
  upAxis?: 'y' | 'z';
  zoomMode?: ZoomMode;
  getGroundIntersection?: GroundIntersectionFn;
  tileSize?: number; // default 256
}

export const TILE_SIZE = 256;

export function worldSizeForZoom(zoom: number, tileSize: number = TILE_SIZE) {
  // MapLibre: worldSize = tileSize * 2^z
  return tileSize * Math.pow(2, zoom);
}

export type Bounds2D = { min: { x: number; y: number }; max: { x: number; y: number } };

export interface TransformConstraints {
  minZoom: number;
  maxZoom: number;
  minPitch: number;
  maxPitch: number;
  panBounds?: Bounds2D; // world coordinate bounds
}
