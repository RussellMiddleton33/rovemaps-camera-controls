Three.js Camera Controls — 1:1 MapLibre Parity Plan

Goals
- Replicate MapLibre GL JS camera controls behavior and APIs 1-to-1 (naming, options, events, semantics) in a standalone TS package for Three.js scenes.
- Provide a drop-in controller with the same methods and options: jumpTo, easeTo, flyTo, fitBounds, cameraForBounds, panBy/panTo, zoomTo/By/In/Out, rotateTo/By, pitchTo/By, rollTo/By, set* variants, getters, and event model.
- Support the full gesture set: scroll zoom, wheel vs. trackpad differentiation, mouse pan/rotate/pitch/roll, keyboard navigation, box/double/tap zoom, two-finger pinch/rotate/pitch, cooperativeGestures UX, inertia.
- Preserve MapLibre semantics: around/pivot handling, padding/offset, curve/speed/screenSpeed, bearingSnap, freezeElevation, centerClampedToGround, reduced-motion handling, cancelable animations.

Non-Goals
- Rendering maps/tiles or MapLibre layers; this is a camera control package for any Three.js scene.
- Copying MapLibre rendering or style subsystems.

High-Level Design
- Core Controller mirrors `ui/camera.ts`, backed by a Transform abstraction mirroring `geo/transform_interface.ts` but implemented for Three.js camera math.
- Projection Helpers mirror `ICameraHelper` to encapsulate projection-specific control math; start with planar (Mercator-like) and optionally spherical/globe support.
- Handler Manager and input handlers mirror `ui/handler_manager.ts` and `ui/handler/*` but operate on a supplied HTML element and a Three.js `Camera`.
- Utilities replicate needed math/easing, event system, and timing APIs.

Phase 0 — Repository, Tooling, and Baseline
1) Repo setup
   - Initialize TS project with strict settings. Target `ES2019+`, `module: ESNext`.
   - Lint/format: ESLint + Prettier. GitHub Actions for CI (build + tests).
   - Bundling: tsup or Rollup to emit ESM + CJS with type declarations. Mark `three` as a peerDependency.
   - Directory structure:
     - `src/core` (controller, events)
     - `src/transform` (interfaces + implementations)
     - `src/helpers` (projection-specific camera helpers)
     - `src/handlers` (input handlers + manager)
     - `src/util` (math, easing, dom, browser)
     - `examples/` (minimal Three.js scenes)

2) Baseline artifacts
   - LICENSE/README. Changelog.
   - Type tests in `tests/` and unit tests with vitest/jest.

Phase 1 — Core Abstractions and Types
1) Define `ITransform` + `IReadonlyTransform` (ported from MapLibre contracts)
   - Properties: center (LngLat-like or custom Vec2/Vec3), zoom, bearing, pitch, roll, worldSize/scale, width/height, padding.
   - Methods: setters for roll/pitch/bearing/zoom/center, screen<->world conversions, clamping, constraints.
   - Three.js mapping: Provide a concrete `ThreePlanarTransform` that internally maps these to a `THREE.Camera` (position/quaternion) and world plane.
   - Adopt `LngLat` primitives or define generic `Vec2LngLat` for non-geographic scenes; offer adapters.

2) Define `ICameraHelper` (projection-specific logic)
   - Methods: `handleMapControlsRollPitchBearingZoom`, `handleMapControlsPan`, `cameraForBoxAndBearing`, `handleJumpToCenterZoom`, `handleEaseTo`, `handleFlyTo`, `handlePanInertia`.
   - Implement baseline `PlanarCameraHelper` (Mercator-like planar math). Optionally add `SphericalCameraHelper` to emulate globe semantics.

3) Event system
   - Port minimal `Evented` API (on/off/once/fire) to match MapLibre’s behavior.
   - Define event payloads: move/zoom/rotate/pitch/roll start/move/end, `renderFrame`, `error`.

4) Utilities
   - Port required math: clamp, bezier, defaultEasing, zoomScale/scaleZoom, angle helpers, lerp, mod, deepEqual/clone.
   - `browser.now()` and RAF wrapper with AbortController; `prefers-reduced-motion` check.
   - DOM helpers for event binding with passive/capture flags.

Phase 2 — Core Camera Controller (API parity)
1) Implement `CameraController` mirroring `ui/camera.ts`
   - Constructor args: `{ camera: THREE.PerspectiveCamera | THREE.OrthographicCamera; domElement: HTMLElement; width/height?: number; projection?: 'planar'|'spherical'|Custom; bearingSnap?: number; }`.
   - Internals: attach `ITransform` implementation (e.g., `ThreePlanarTransform`), choose `ICameraHelper` by projection, initialize handler manager.
   - State: `_moving`, `_zooming`, `_rotating`, `_pitching`, `_rolling`, `_padding`, `_easeStart`, `_easeOptions`, `_easeId`, `_requestedCameraState`.
   - Options: support `transformCameraUpdate` callback and `freezeElevation`, `centerClampedToGround` semantics via user-provided ground function.

2) Methods (1:1)
   - Query: `getCenter/Zoom/Bearing/Pitch/Roll`, `getPadding`, `isMoving/Zooming/Rotating/Pitching/Rolling`.
   - Jump: `jumpTo(options)`, `setCenter/Zoom/Bearing/Pitch/Roll/Elevation`, `panTo`, `panBy`.
   - Ease: `easeTo(options)`, event sequencing and cancellation; respect `essential` and reduced-motion.
   - Fly: `flyTo(options)` with `curve`, `speed`, `screenSpeed`, `minZoom`, `maxDuration`.
   - Fit: `fitBounds(bounds, options)`, `cameraForBounds(bounds, options)`, rotated bounds support via helper.
   - Zoom: `zoomTo`, `zoomIn`, `zoomOut` with around-point logic.
   - Rotate/Pitch/Roll: `rotateTo/By`, `pitchTo/By`, `rollTo/By` with `bearingSnap`.

3) Animation engine
   - Frame loop using RAF wrapper with abort support. `defaultEasing` and custom easing; normalized k in [0..1].
   - Internal `_easeTo` orchestrator: records start state, computes target via helper, invokes per-frame `updateRotation` (SLERP or Euler), pan/zoom interpolation.
   - Cancellation semantics: new movement cancels in-flight animations and fires `moveend` appropriately.

Phase 3 — Handler Manager and Input Handlers
1) Manager (`HandlerManager` parity)
   - Bind listeners to `domElement` and `window/document` with proper passive/capture flags.
   - Track active handlers, prevent conflicts, merge `HandlerResult` deltas per frame, and apply via `ICameraHelper`.
   - Maintain `_eventsInProgress` and emit accurate start/move/end events per-axis and combined.

2) Handlers (feature-complete set)
   - `ScrollZoomHandler`: wheel vs. trackpad detection, rate limiting (`maxScalePerFrame`), renderFrame smoothing, `around: 'center'|'pointer'` option.
   - Mouse: generators for `pan`, `rotate`, `pitch`, `roll` based on button+modifier configuration; pointer lock optional.
   - Touch: `TouchPanHandler` (one finger), `TwoFingersTouchZoom/Pitch/Rotate` and a shim for platforms lacking pointer capture.
   - Keyboard: panning, zooming, rotate/pitch bindings, configurable key map.
   - Discrete: `dblclick` zoom in/out, click/tap zoom, tap-drag zoom, box zoom.
   - Cooperative gestures: optional feature gating with tooltip callbacks.

3) TransformProvider
   - Expose desired camera state (`_requestedCameraState` or active transform) to handlers so accumulated deltas track intended end-state.

4) Inertia
   - Port `HandlerInertia` logic; configurable per-axis deceleration/linearity/maxSpeed/easing; apply via `easeTo` on gesture end.

Phase 4 — Projections and Transforms for Three.js
1) Planar Transform (`ThreePlanarTransform`)
   - World: define a ground plane (user-configurable up-axis and units). Provide world<->screen conversion using the Three.js camera and viewport size.
   - Center: represent as world position (or geographic adapter). Zoom: implement as dollying (changing camera distance or FOV) consistent with MapLibre zoomScale semantics.
   - Bearing/Pitch/Roll: map to camera quaternion; keep yaw=bearing around up-axis, pitch around right-axis, roll around forward-axis; clamp pitch to [0..maxPitch].
   - Around-point: compute a world point under a screen pixel via a user-specified raycast callback or a default plane intersection.
   - Padding/offset: adjust target center by rotated padding offset analogous to MapLibre.

2) Spherical/Globe Transform (optional initial version)
   - Support globe-like controls by interpreting center as lon/lat and projecting to a sphere; maintain camera target on sphere surface.
   - Pivoting/around-point handles geodesic motions; reuse `GlobeCameraHelper` logic adapted to 3D sphere.

3) Camera Helpers
   - Implement `PlanarCameraHelper` that mirrors `MercatorCameraHelper` math: `handleMapControls*`, `cameraForBoxAndBearing`, `handleEaseTo`, `handleFlyTo`, `handlePanInertia`.
   - For spherical mode, implement `SphericalCameraHelper` mirroring `GlobeCameraHelper` semantics.

Phase 5 — API Surface and Integration with Three.js
1) Public API
   - `new CameraControls({ camera, domElement, width, height, projection, bearingSnap, ...options })`
   - Properties: `handlers`, `cooperativeGestures`, `transform`, `cameraHelper`.
   - Methods: parity with MapLibre camera API; enable/disable handlers via manager.
   - Events: identical event names and payload shapes where possible.

2) Configuration/injection
   - Ground intersection strategy: plane, custom raycaster, or callback.
   - Coordinate adapter: use LngLat semantics or generic Vec types; provide converters if user supplies geo projections.
   - Gesture configuration: zoom rates (trackpad vs. wheel), speed multipliers, min/max zoom, min/max pitch, keyboard map.

Phase 6 — Testing and Quality
1) Unit tests
   - Math: zoomScale/scaleZoom, easing curves, angle wrap/snap.
   - Helpers: `cameraForBoxAndBearing`, `updateRotation` (SLERP vs Euler), inertia outcomes.
   - Controller: correctness of event sequencing, cancellation, reduced-motion behavior.

2) Integration tests (jsdom + Three)
   - Simulate DOM events to validate handlers and manager (wheel, mouse drag, touch, keyboard) and verify camera deltas applied.
   - Around-point correctness: verify world-point under cursor remains fixed during zoom/rotate.

3) Visual examples
   - Basic planar scene with grid/floor. Globe example (optional).
   - Demos for each gesture and API: flyTo, fitBounds, cooperative gestures.

Phase 7 — Documentation and Examples
1) README
   - Quick start; feature matrix vs. MapLibre; API reference mirroring MapLibre docs structure.
   - Notes on differences/assumptions (world units, raycasting, projections).

2) Guides
   - Adapting controls to your scene (ground plane vs. custom intersection).
   - Using keyboard/mouse/touch options; inertia tuning; reduced motion.
   - Migrating from MapLibre camera API.

3) Examples
   - Hosted via Vite playground; codesandbox links.

Phase 8 — Packaging, Versioning, and Release
1) Build outputs: `dist/` with ESM + CJS and `.d.ts`.
2) Package.json: `exports` map, sideEffects: false, `types` field, peerDep on `three`.
3) Semantic versioning; release notes; automated publish workflow.

Parity Checklist (from Outline)
- Camera API parity: jump/ease/fly/fit/pan/zoom/rotate/pitch/roll + getters/setters + options (curve/speed/screenSpeed, maxDuration, padding, offset, around, freezeElevation, centerClampedToGround, bearingSnap).
- Inertia parity: pan/zoom/bearing/pitch/roll; clamping and easing selection via longest duration.
- Around-point semantics: pointer/center selection; precedence of `pinchAround` for pinch gestures.
- Event parity: start/move/end per axis and combined move; originalEvent propagation; noMoveStart handling.
- Gesture parity: trackpad vs. wheel; dblclick, tap, tap-drag, box zoom; two-finger pinch/rotate/pitch; keyboard; cooperative gestures.
- Reduced motion: respect `prefers-reduced-motion` and `essential` options.

Risks and Mitigations
- Coordinate assumptions: MapLibre uses geographic coordinates; Three.js scenes vary. Mitigate with adapters and a ground-intersection strategy API.
- Precision differences: Minor numerical deviations acceptable; add fuzz tolerances in tests.
- Platform input quirks: Maintain passive/capture flags; implement shims for iOS Safari behaviors similar to MapLibre.
- Performance: Ensure RAF loop and handlers are lightweight; batch updates and avoid layout thrash; use requestAnimationFrame only when needed.

Work Breakdown and Milestones
1) M1: Core abstractions (ITransform, Evented, utils) + PlanarCameraHelper stub.
2) M2: CameraController (jump/ease) + ScrollZoom + MousePan + key events + examples.
3) M3: Full handlers (rotate/pitch/roll, touch, double/tap/box) + inertia.
4) M4: flyTo, fitBounds, around-point rigor, cooperative gestures.
5) M5: Tests coverage + docs + packaging + first beta.
6) M6: Optional spherical/globe projection + advanced examples.

References
- See `maplibre_camera_controls/OUTLINE.md` and `COPIED_FILES.txt` for the exact MapLibre code used as the parity reference.

Add these to the prompt (copy-paste)

1) SSR + Next.js Hardening
	•	SSR guards: Every DOM or window access must be inside attach()/mount() or behind typeof window !== 'undefined'.
	•	Types: Export a createControllerForNext() helper that no-ops on server, real controller on client.
	•	Resize: Provide setViewport({width,height,devicePixelRatio}) and wire it in example via a ResizeObserver.
	•	Example page: Include a Pages Router page and an App Router example (with dynamic(..., { ssr:false })).

2) Device & Input Robustness
	•	Pointer Events first; gracefully fall back to Touch/Mouse when not supported.
	•	Trackpad vs wheel: Implement a heuristic (delta magnitude + frequency) and expose onWheelModeChange('trackpad'|'wheel').
	•	Passive listeners: Use { passive: false } only when you must preventDefault(); otherwise passive true.
	•	iOS Safari: Optional touch-action: none style guidance + gesturestart/gesturechange fallback behind a feature flag.
	•	Cooperative gestures: Provide a minimal tooltip API hook (onCoopGestureHint(request:{type:'pinch'|'rotate'})).

3) Around-Point + Ground Intersection
	•	Raycast strategy: Accept getGroundIntersection(screen: {x,y}) => Vector3 | null. Default is a plane at y=0 (configurable up-axis).
	•	Guarantee: During zoom/rotate with around: 'pointer', the world point under the cursor must remain fixed within 1px (test it).
	•	Padding/offset parity: Apply rotated padding offsets before easing; document order of operations.

4) Animation & Reduced-Motion
	•	Abortable animations with AbortController (return { cancel() } from easeTo/flyTo).
	•	Reduced motion: If prefers-reduced-motion and option { essential:false }, switch flyTo → easeTo with shorter duration or jumpTo.
	•	Deterministic easing: Provide defaultEasing(t) and allow custom; guarantee monotonic k in [0..1].

5) Numerical & Projection Specifics
	•	Zoom semantics: Implement both FOV-based and dolly-distance zoom modes; default to FOV for perspective cameras, keep zoomScale <-> scaleZoom.
	•	Angle normalization: Bearing normalized to (-180, 180]; bearingSnap epsilon configurable; roll clamped if enabled.
	•	World scale: Expose TILE_SIZE (256) and worldSize(z). Include metersPerPixel(lat,z) helper for QA overlays.

6) Events & Interop Parity
	•	Evented API: on/off/once/fire with payloads mirroring MapLibre ({originalEvent?: Event} when applicable).
	•	Move lifecycle: Emit movestart once per gesture/animation, move per change, moveend on settle; also axis-specific (zoomstart/zoom/zoomend, etc.).
	•	Cancelable: When a new gesture/command arrives, cancel current animation and fire the correct *end events.

7) Constraints & Safety
	•	Bounds: panBounds soft clamp via spring; maxZoom/minZoom, minPitch/maxPitch.
	•	Freeze elevation semantics: lock ground distance while adjusting pitch/bearing unless freezeElevation:false.
	•	Center clamped to ground: If getGroundIntersection returns null (e.g., off map), soft-snap back.

8) Performance Guarantees
	•	No allocs in hot path: Pool vectors/quats; forbid new inside pointer/move loop.
	•	rAF policy: Internal rAF runs only while _moving || _animating; otherwise idle.
	•	DPR handling: Accept devicePixelRatio to stabilize wheel/pinch deltas across displays.

9) Testing Matrix (must include)
	•	Unit: math utilities, angle wrap, zoomScale/scaleZoom, cameraForBounds, inertia settle times.
	•	Simulated input: jsdom + synthetic pointer/wheel/touch events (wheel vs trackpad), verify around-point invariants.
	•	Cross-env: Chrome/Edge/Safari/iOS Safari, Mac trackpad vs external mouse wheel, Windows precision touchpad.
	•	Regression: Test that starting a new flyTo during easeTo cancels correctly and events fire in order.

10) Diagnostics & Dev UX
	•	Debug overlay (example only): Show center/zoom/bearing/pitch/roll, isTrackpad, DPR, meters/pixel.
	•	Logger hooks: Optional onError(e), onWarn(msg), and dev-only console.debug with a debug flag.

11) Packaging & Types
	•	Exports map with ESM/CJS + types; "sideEffects": false for tree-shaking.
	•	Peer deps: three pinned to a tested range; mark compatibility in README.
	•	Strict types: export type for all option objects and event payloads; no any.

12) Example Parity Scenarios

Ship minimal examples that mirror common MapLibre flows:
	•	Fit to bounds with padding + rotated camera.
	•	flyTo parade route demo (long path with curve/speed/screenSpeed).
	•	Cooperative gestures demo with tooltip.
	•	Reduced motion toggle.
	•	Pointer-around zoom stress test ensuring pixel-lock.

⸻

Small but mighty edge cases to cover
	•	Zero-movement wheel spam: Debounce extremely tiny deltas on high-DPR devices to avoid jitter.
	•	Modifier conflicts: Ensure Shift always maps to pitch (configurable), Alt/Option for rotate, and Ctrl/⌘ shortcuts don’t block browser zoom unless cooperative gestures are enabled.
	•	Box-zoom on rotated bearing: Selection rect must be interpreted in screen space; cameraForBounds should respect current bearing.
	•	Click-through prevention: Provide preventClickOnDragThreshold (px) to avoid accidental clicks on UI under canvas.
	•	Memory: dispose() must unbind all listeners (element + window) and cancel RAF/animations.


   	•	Builds in Next.js (Pages & App Router) with strict TS and without SSR crashes.
	•	Trackpad/wheel correctly distinguished; onWheelModeChange fires.
	•	Pointer-around zoom keeps target within ≤1px drift at z ∈ [2, 22].
	•	flyTo respects curve/speed/screenSpeed; new motions cancel in-flight with proper *end events.
	•	fitBounds honors padding + current bearing; cameraForBounds returns identical state as actually applying fitBounds.
	•	Reduced-motion honored; { essential:false } downgrades animation.
	•	No allocations in pointermove/wheel hot paths (verified in Performance panel).
	•	dispose() leaves no dangling listeners (leak test passes).