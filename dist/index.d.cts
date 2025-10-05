import { Vector3, PerspectiveCamera, OrthographicCamera } from 'three';
export { Camera } from 'three';

type Padding = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};
type Vec2 = {
    x: number;
    y: number;
};
type Center = {
    x: number;
    y: number;
    z?: number;
};
type GroundPoint = {
    gx: number;
    gz: number;
};
interface IReadonlyTransform {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
    readonly center: Center;
    readonly zoom: number;
    readonly bearing: number;
    readonly pitch: number;
    readonly roll: number;
    readonly padding: Padding;
    readonly worldSize: number;
}
interface ITransform extends IReadonlyTransform {
    setViewport(view: {
        width: number;
        height: number;
        devicePixelRatio?: number;
    }): void;
    setPadding(padding: Partial<Padding>): void;
    setCenter(center: Center): void;
    setZoom(zoom: number): void;
    setBearing(bearing: number): void;
    setPitch(pitch: number): void;
    setRoll(roll: number): void;
    setConstraints(constraints: Partial<TransformConstraints>): void;
    getPanBounds(): Bounds2D | undefined;
    deferApply<T>(fn: () => T): T;
    screenToWorld(screen: Vec2): Vector3 | null;
    worldToScreen(world: Vector3): Vec2 | null;
    groundFromScreen(screen: Vec2): GroundPoint | null;
    adjustCenterByGroundDelta(dgx: number, dgz: number): void;
    getGroundCenter(): GroundPoint;
    setGroundCenter(g: GroundPoint): void;
    clamp(): void;
}
type GroundIntersectionFn = (screen: Vec2) => Vector3 | null;
type ZoomMode = 'fov' | 'dolly';
interface ThreePlanarTransformOptions {
    camera: PerspectiveCamera | OrthographicCamera;
    width: number;
    height: number;
    devicePixelRatio?: number;
    upAxis?: 'y' | 'z';
    zoomMode?: ZoomMode;
    getGroundIntersection?: GroundIntersectionFn;
    tileSize?: number;
    projection?: ProjectionAdapter;
    baseScale?: number;
}
declare const TILE_SIZE = 256;
declare function worldSizeForZoom(zoom: number, tileSize?: number): number;
type Bounds2D = {
    min: {
        x: number;
        y: number;
    };
    max: {
        x: number;
        y: number;
    };
};
interface TransformConstraints {
    minZoom: number;
    maxZoom: number;
    minPitch: number;
    maxPitch: number;
    panBounds?: Bounds2D;
}
interface ProjectionAdapter {
    project(lngLat: [number, number]): {
        x: number;
        y: number;
    };
    unproject(point: {
        x: number;
        y: number;
    }): [number, number];
    sceneToLngLat?(x: number, y: number): [number, number];
    lngLatToScene?(lng: number, lat: number, z?: number): [number, number, number];
}
interface MethodOptions {
    silent?: boolean;
}

type Listener = (ev?: any) => void;
declare class Evented<TEvents extends Record<string, any> = any> {
    private listeners;
    on<K extends keyof TEvents & string>(type: K, fn: (ev: TEvents[K]) => void): this;
    once<K extends keyof TEvents & string>(type: K, fn: (ev: TEvents[K]) => void): this;
    off<K extends keyof TEvents & string>(type: K, fn: (ev: TEvents[K]) => void): this;
    fire<K extends keyof TEvents & string>(type: K, ev: TEvents[K]): this;
}

interface EaseOptions {
    duration?: number;
    easing?: (t: number) => number;
    animate?: boolean;
    essential?: boolean;
    around?: 'center' | 'pointer';
    aroundPoint?: {
        x: number;
        y: number;
    };
    anchorTightness?: number;
    offset?: {
        x: number;
        y: number;
    };
    padding?: Partial<{
        top: number;
        right: number;
        bottom: number;
        left: number;
    }>;
}
interface FlyToOptions extends EaseOptions {
    curve?: number;
    speed?: number;
    screenSpeed?: number;
    maxDuration?: number;
    minZoom?: number;
}
interface CameraForBoundsOptions extends EaseOptions {
    bearing?: number;
    padding?: Partial<{
        top: number;
        right: number;
        bottom: number;
        left: number;
    }>;
    offset?: {
        x: number;
        y: number;
    };
}
interface ICameraHelper {
    handleMapControlsPan(transform: ITransform, dx: number, dy: number): void;
    handleMapControlsRollPitchBearingZoom(transform: ITransform, dRoll: number, dPitch: number, dBearing: number, dZoom: number, around?: 'center' | 'pointer'): void;
    handleJumpToCenterZoom(transform: ITransform, center?: {
        x: number;
        y: number;
        z?: number;
    }, zoom?: number): void;
    handleEaseTo(transform: ITransform, opts: EaseOptions): void;
    handleFlyTo(transform: ITransform, opts: FlyToOptions): void;
    handlePanInertia(transform: ITransform, vx: number, vy: number): void;
    cameraForBoxAndBearing(transform: ITransform, bounds: {
        min: {
            x: number;
            y: number;
        };
        max: {
            x: number;
            y: number;
        };
    }, options?: CameraForBoundsOptions): {
        center: {
            x: number;
            y: number;
        };
        zoom: number;
        bearing: number;
        pitch: number;
    };
}

type WheelMode = 'trackpad' | 'wheel';

type HandlerAxes = {
    pan?: boolean;
    zoom?: boolean;
    rotate?: boolean;
    pitch?: boolean;
    roll?: boolean;
};
type HandlerDelta = {
    axes: HandlerAxes;
    originalEvent?: Event;
};

interface ScrollZoomOptions {
    maxDeltaPerEvent?: number;
    preventDefault?: boolean;
    around?: 'center' | 'pointer';
    onWheelModeChange?: (mode: WheelMode) => void;
    onChange?: (delta: HandlerDelta) => void;
    cooperative?: boolean;
    onCoopGestureHint?: (req: {
        type: 'pinch' | 'rotate';
    }) => void;
    zoomSign?: 1 | -1;
    anchorTightness?: number;
    zoomInertia?: boolean;
}

interface MousePanOptions {
    button?: number;
    dragThresholdPx?: number;
    onChange?: (delta: HandlerDelta) => void;
    rubberbandStrength?: number;
    inertiaPanFriction?: number;
    panXSign?: 1 | -1;
    panYSign?: 1 | -1;
    recenterOnPointerDown?: boolean;
    inertiaPanYSign?: 1 | -1;
    inertiaPanXSign?: 1 | -1;
    anchorTightness?: number;
}

interface MouseRotatePitchOptions {
    rotateButton?: number;
    pitchModifier?: 'shift' | 'alt';
    sensitivity?: {
        rotatePerPx?: number;
        pitchPerPx?: number;
    };
    onChange?: (delta: HandlerDelta) => void;
    around?: 'center' | 'pointer';
    rotateSign?: 1 | -1;
    pitchSign?: 1 | -1;
    recenterOnPointerDown?: boolean;
    anchorTightness?: number;
}

interface TouchMultiOptions {
    enablePan?: boolean;
    enableZoom?: boolean;
    enableRotate?: boolean;
    enablePitch?: boolean;
    pitchPerPx?: number;
    rotateThresholdDeg?: number;
    pitchThresholdPx?: number;
    zoomThreshold?: number;
    onChange?: (delta: HandlerDelta) => void;
    preventDefault?: boolean;
    around?: 'center' | 'pinch';
    rubberbandStrength?: number;
    panXSign?: 1 | -1;
    panYSign?: 1 | -1;
    recenterOnGestureStart?: boolean;
    anchorTightness?: number;
    inertiaPanXSign?: 1 | -1;
    inertiaPanYSign?: 1 | -1;
    rotateSign?: 1 | -1;
    allowedSingleTouchTimeMs?: number;
    pitchFirstMoveWindowMs?: number;
    inertiaPanFriction?: number;
    inertiaZoomFriction?: number;
    inertiaRotateFriction?: number;
    showDebugOverlay?: boolean;
}

interface KeyboardOptions {
    panStepPx?: number;
    zoomDelta?: number;
    rotateStepDeg?: number;
    pitchStepDeg?: number;
    preventDefault?: boolean;
    onChange?: (delta: HandlerDelta) => void;
}

interface DblclickOptions {
    zoomDelta?: number;
    invertWithShift?: boolean;
    around?: 'center' | 'pointer';
    preventDefault?: boolean;
    onChange?: (delta: HandlerDelta) => void;
    anchorTightness?: number;
}

interface BoxZoomOptions {
    triggerModifier?: 'shift';
    minAreaPx?: number;
    preventDefault?: boolean;
    onChange?: (delta: HandlerDelta) => void;
}

interface SafariGestureOptions {
    enabled?: boolean;
    around?: 'center' | 'pointer';
    onChange?: (delta: HandlerDelta) => void;
    rotateSign?: 1 | -1;
    zoomSign?: 1 | -1;
    anchorTightness?: number;
}

interface HandlerManagerOptions {
    scrollZoom?: ScrollZoomOptions | boolean;
    onChange?: (delta: HandlerDelta) => void;
    touch?: TouchMultiOptions | boolean;
    rubberbandStrength?: number;
    mousePan?: MousePanOptions | boolean;
    mouseRotatePitch?: MouseRotatePitchOptions | boolean;
    keyboard?: KeyboardOptions | boolean;
    dblclick?: DblclickOptions | boolean;
    boxZoom?: BoxZoomOptions | boolean;
    suppressContextMenu?: boolean;
    safariGestures?: SafariGestureOptions | boolean;
    anchorTightness?: number;
    rightButtonPan?: boolean;
    inertiaPanFriction?: number;
    inertiaZoomFriction?: number;
    inertiaRotateFriction?: number;
}

type Projection = 'planar';
interface CameraControllerOptions {
    camera: PerspectiveCamera | OrthographicCamera;
    domElement: HTMLElement;
    width?: number;
    height?: number;
    devicePixelRatio?: number;
    upAxis?: 'y' | 'z';
    projection?: Projection | ProjectionAdapter;
    baseScale?: number;
    bearingSnap?: number;
    bearingSnapEpsilon?: number;
    handlers?: HandlerManagerOptions;
    minZoom?: number;
    maxZoom?: number;
    minPitch?: number;
    maxPitch?: number;
    panBounds?: Bounds2D;
    suppressEvents?: boolean;
    useExternalAnimationLoop?: boolean;
    observeResize?: boolean;
}
type CameraMoveEvents = {
    movestart: {
        originalEvent?: Event;
    };
    move: {
        originalEvent?: Event;
    };
    moveend: {
        originalEvent?: Event;
    };
    zoomstart: {
        originalEvent?: Event;
    };
    zoom: {
        originalEvent?: Event;
    };
    zoomend: {
        originalEvent?: Event;
    };
    rotatestart: {
        originalEvent?: Event;
    };
    rotate: {
        originalEvent?: Event;
    };
    rotateend: {
        originalEvent?: Event;
    };
    pitchstart: {
        originalEvent?: Event;
    };
    pitch: {
        originalEvent?: Event;
    };
    pitchend: {
        originalEvent?: Event;
    };
    rollstart: {
        originalEvent?: Event;
    };
    roll: {
        originalEvent?: Event;
    };
    rollend: {
        originalEvent?: Event;
    };
    dragstart: {
        originalEvent?: Event;
    };
    drag: {
        originalEvent?: Event;
    };
    dragend: {
        originalEvent?: Event;
    };
    renderFrame: {};
    error: {
        error: Error;
    };
};
declare class CameraController extends Evented<CameraMoveEvents> {
    private readonly _camera;
    private readonly _dom;
    private readonly _helper;
    readonly transform: ITransform;
    private _moving;
    private _animHandle;
    private _easeAbort?;
    private _bearingSnap;
    private _bearingSnapEps;
    private _handlers?;
    private _moveEndTimer;
    private _zooming;
    private _rotating;
    private _pitching;
    private _rolling;
    private _dragging;
    private _constraints;
    private _softClamping;
    private _suppressEvents;
    private _isInternalUpdate;
    private _resizeObserver?;
    private _useExternalLoop;
    private _activeAnimation;
    constructor(opts: CameraControllerOptions);
    dispose(): void;
    private _fire;
    setTouchDebugOverlay(enabled: boolean): void;
    setViewport(view: {
        width: number;
        height: number;
        devicePixelRatio?: number;
    }): void;
    getCenter(): Center;
    getZoom(): number;
    getBearing(): number;
    getPitch(): number;
    getRoll(): number;
    getPadding(): Padding;
    isMoving(): boolean;
    isZooming(): boolean;
    isRotating(): boolean;
    isPitching(): boolean;
    isRolling(): boolean;
    setCenter(center: {
        x: number;
        y: number;
        z?: number;
    }): this;
    setZoom(zoom: number): this;
    setBearing(bearing: number): this;
    setPitch(pitch: number): this;
    setRoll(roll: number): this;
    setPadding(padding: Partial<Padding>): this;
    setConstraints(c: Partial<TransformConstraints>): this;
    jumpTo(options: {
        center?: {
            x: number;
            y: number;
            z?: number;
        };
        zoom?: number;
        bearing?: number;
        pitch?: number;
        roll?: number;
        padding?: Partial<Padding>;
    }, methodOpts?: MethodOptions): this;
    panBy(offset: {
        x: number;
        y: number;
    }, _opts?: EaseOptions): this;
    panTo(center: {
        x: number;
        y: number;
    }, opts?: EaseOptions): this;
    zoomTo(zoom: number, opts?: EaseOptions): this;
    zoomIn(delta?: number, opts?: EaseOptions): this;
    zoomOut(delta?: number, opts?: EaseOptions): this;
    rotateTo(bearing: number, opts?: EaseOptions): this;
    rotateBy(delta: number, opts?: EaseOptions): this;
    pitchTo(pitch: number, opts?: EaseOptions): this;
    pitchBy(delta: number, opts?: EaseOptions): this;
    rollTo(roll: number, opts?: EaseOptions): this;
    rollBy(delta: number, opts?: EaseOptions): this;
    easeTo(options: {
        center?: {
            x: number;
            y: number;
            z?: number;
        };
        zoom?: number;
        bearing?: number;
        pitch?: number;
        roll?: number;
        padding?: Partial<Padding>;
        offset?: {
            x: number;
            y: number;
        };
    } & EaseOptions): this;
    flyTo(options: {
        center?: {
            x: number;
            y: number;
            z?: number;
        };
        zoom?: number;
        bearing?: number;
        pitch?: number;
        roll?: number;
        maxDuration?: number;
    } & FlyToOptions): this;
    fitBounds(bounds: {
        min: {
            x: number;
            y: number;
        };
        max: {
            x: number;
            y: number;
        };
    }, options?: EaseOptions & {
        offset?: {
            x: number;
            y: number;
        };
    }): this;
    cameraForBounds(bounds: {
        min: {
            x: number;
            y: number;
        };
        max: {
            x: number;
            y: number;
        };
    }, options?: EaseOptions & {
        offset?: {
            x: number;
            y: number;
        };
    }): {
        center: {
            x: number;
            y: number;
        };
        zoom: number;
        bearing: number;
        pitch: number;
    };
    getStateSnapshot(): {
        center: Center;
        zoom: number;
        bearing: number;
        pitch: number;
        roll: number;
        padding: Padding;
    };
    setStateSnapshot(state: {
        center?: {
            x: number;
            y: number;
            z?: number;
        };
        zoom?: number;
        bearing?: number;
        pitch?: number;
        roll?: number;
        padding?: Partial<Padding>;
    }, methodOpts?: MethodOptions): this;
    /**
     * Update animation state (for external animation loops).
     * Call this from your animation loop (e.g., React Three Fiber's useFrame) when
     * useExternalAnimationLoop is true. This advances any active easeTo/flyTo animation.
     *
     * @param deltaTime - Optional delta time in seconds (currently unused, for future use)
     * @returns this for chaining
     */
    update(deltaTime?: number): this;
    /**
     * Advance the active animation by one frame.
     * Returns true if animation continues, false if complete.
     * @internal
     */
    private _advanceAnimation;
    private _emitRender;
    private _startMoveLifecycle;
    private _endMoveLifecycle;
    private _externalChange;
    private _axisStart;
    private _axisEmitDuring;
    private _axisEnd;
    private _endAllAxes;
    private _applyBearingSnap;
    private _applySoftPanBounds;
}

type ControllerOptions = ConstructorParameters<typeof CameraController>[0];
declare function createController(options: ControllerOptions): CameraController;
declare function createControllerForNext(options: ControllerOptions | (() => ControllerOptions)): CameraController;

declare function clamp(v: number, min: number, max: number): number;
declare function lerp(a: number, b: number, t: number): number;
declare function mod(n: number, m: number): number;
declare function degToRad(d: number): number;
declare function radToDeg(r: number): number;
declare function normalizeAngleDeg(a: number): number;
declare function zoomScale(zoomDelta: number): number;
declare function scaleZoom(scale: number): number;

type Easing = (t: number) => number;
declare const defaultEasing: Easing;
declare function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): Easing;

declare const browser: {
    now: () => number;
    reducedMotion: () => boolean;
};
declare function raf(callback: FrameRequestCallback): number;
declare function caf(handle: number): void;

type ListenerOptions = boolean | AddEventListenerOptions;
declare function on<K extends keyof HTMLElementEventMap>(el: HTMLElement | Window | Document, type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, options?: ListenerOptions): () => void;
declare function off<K extends keyof HTMLElementEventMap>(el: HTMLElement | Window | Document, type: K, listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any, options?: ListenerOptions): void;

export { type Bounds2D, CameraController, type CameraControllerOptions, type CameraForBoundsOptions, type CameraMoveEvents, type Center, type ControllerOptions, type EaseOptions, type Easing, Evented, type FlyToOptions, type GroundIntersectionFn, type GroundPoint, type ICameraHelper, type IReadonlyTransform, type ITransform, type Listener, type ListenerOptions, type MethodOptions, type Padding, type Projection, type ProjectionAdapter, TILE_SIZE, type ThreePlanarTransformOptions, type TransformConstraints, type Vec2, type ZoomMode, browser, caf, clamp, createController, createControllerForNext, cubicBezier, defaultEasing, degToRad, lerp, mod, normalizeAngleDeg, off, on, radToDeg, raf, scaleZoom, worldSizeForZoom, zoomScale };
