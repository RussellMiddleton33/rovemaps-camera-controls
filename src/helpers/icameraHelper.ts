import type { ITransform } from '../transform/interfaces';

export interface EaseOptions {
  duration?: number;
  easing?: (t: number) => number;
  animate?: boolean;
  essential?: boolean;
  around?: 'center' | 'pointer';
  // When around === 'pointer', provide the screen point to preserve
  aroundPoint?: { x: number; y: number };
  // 0..1, how strongly to keep the pointer point fixed
  anchorTightness?: number;
  offset?: { x: number; y: number };
  padding?: Partial<{ top: number; right: number; bottom: number; left: number }>;
}

export interface FlyToOptions extends EaseOptions {
  curve?: number;
  speed?: number;
  screenSpeed?: number;
  maxDuration?: number;
  minZoom?: number;
}

export interface CameraForBoundsOptions extends EaseOptions {
  bearing?: number;
  padding?: Partial<{ top: number; right: number; bottom: number; left: number }>;
  offset?: { x: number; y: number };
}

export interface ICameraHelper {
  handleMapControlsPan(transform: ITransform, dx: number, dy: number): void;
  handleMapControlsRollPitchBearingZoom(
    transform: ITransform,
    dRoll: number,
    dPitch: number,
    dBearing: number,
    dZoom: number,
    around?: 'center' | 'pointer'
  ): void;

  handleJumpToCenterZoom(transform: ITransform, center?: { x: number; y: number; z?: number }, zoom?: number): void;
  handleEaseTo(transform: ITransform, opts: EaseOptions): void; // compute targets and apply per-frame outside
  handleFlyTo(transform: ITransform, opts: FlyToOptions): void; // compute path params
  handlePanInertia(transform: ITransform, vx: number, vy: number): void;

  cameraForBoxAndBearing(
    transform: ITransform,
    bounds: { min: { x: number; y: number }; max: { x: number; y: number } },
    options?: CameraForBoundsOptions
  ): { center: { x: number; y: number }; zoom: number; bearing: number; pitch: number };
}
