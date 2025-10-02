Overview of MapLibre Camera Controls Code (Reference Snapshot)

Scope
- Files copied from `maplibre-gl/src` that directly implement camera operations, input handlers, inertia, and projection-specific helpers used by camera movement.
- This outline summarizes responsibilities, key types/functions, and notable dependencies to aid a 1:1 feature replication in a Three.js-oriented package.

Top-Level Architecture
- Core Camera: `ui/camera.ts` is the central API that manipulates an abstract `ITransform` and delegates projection-specific behavior to an `ICameraHelper`.
- Input Handling: `ui/handler/*` contains discrete handlers for wheel, mouse, touch, keyboard, and higher-level coordination via `ui/handler_manager.ts`.
- Inertia: `ui/handler_inertia.ts` computes post-gesture momentum for pan/zoom/bearing/pitch/roll.
- Projections/Transforms: `geo/projection/*` implements math for mercator/globe/vertical-perspective transforms and camera helpers.
- Geometry/Types: `geo/*` provides LngLat, LngLatBounds, EdgeInsets, MercatorCoordinate, and `ITransform` interfaces.
- Utilities: `util/*` provides easing, math helpers, browser timing, task queue, and DOM helpers.

Core Camera
- `ui/camera.ts`
  - Role: Public camera API. Emits events and updates `ITransform` by calling `jumpTo`, `easeTo`, `flyTo`, `fitBounds`, `panBy`, `panTo`, `zoomTo/By/In/Out`, `rotateTo/By`, `pitchTo/By`, `rollTo/By`, `set*` variants, and query getters (`getZoom`, `getCenter`, etc.).
  - Delegation: Uses `ICameraHelper` for projection-specific calculations, including `cameraForBoxAndBearing`, `handleJumpToCenterZoom`, `handleEaseTo`, and `handleFlyTo`.
  - State: Tracks `_moving`, `_zooming`, `_rotating`, `_pitching`, `_rolling`, `_padding`. Manages `_easeStart`, `_easeOptions`, `_easeId`, `_onEaseFrame`, `_onEaseEnd`.
  - Options/Types: `CameraOptions`, `AnimationOptions`, `EaseToOptions`, `FlyToOptions`, `FitBoundsOptions`, `CameraForBoundsOptions`, `CameraUpdateTransformFunction`.
  - Semantics: Supports `bearingSnap`, `freezeElevation`, `centerClampedToGround`, and a hook to transform camera updates (`transformCameraUpdate`).
  - Events: Move/zoom/rotate/pitch/roll start/move/end events; integrates `browser.prefersReducedMotion`.

Handler System
- `ui/handler_manager.ts`
  - Role: Listens to DOM events and routes them to registered handlers. Merges returned deltas (`HandlerResult`) into a combined camera change each frame.
  - Orchestration: Enforces handler activation rules, manages simultaneous gestures, and coordinates inertia via `HandlerInertia`.
  - Integration: Applies deltas through `cameraHelper.handleMapControls*` and uses `TransformProvider` to read the desired (requested) camera state.
  - Events: Batches and emits map movement and interaction events; supports cooperative-gestures UX.

- `ui/handler_inertia.ts`
  - Role: Records recent gesture samples, computes momentum using configurable deceleration, linearity, and easing for pan/zoom/bearing/pitch/roll.
  - Key Functions: `calculateEasing`, `extendDuration`, `_onMoveEnd` outputting an `EaseToOptions` to continue motion.
  - Dependencies: `browser.now`, `util.bezier`, `util.clamp`, `Transform` state via `map.cameraHelper`.

- `ui/handler/*` (selected)
  - `scroll_zoom.ts`: Trackpad/wheel zoom differentiation, time-based easing in `renderFrame`, rate limiting, and pivot (around center or pointer). Uses `TransformProvider`.
  - `mouse.ts`: Factory generators for mouse pan/rotate/pitch/roll handlers; translates button+modifier combos to deltas with around-point handling.
  - `touch_pan.ts`: Single-finger drag panning.
  - `two_fingers_touch.ts`: Two-finger pinch zoom, rotate, and pitch with prioritization between `around` and `pinchAround`.
  - `keyboard.ts`: Arrow/WASD panning, `+/-` zoom steps, and rotation/pitch shortcuts.
  - `box_zoom.ts`, `click_zoom.ts`, `tap_zoom.ts`, `tap_drag_zoom.ts`: Discrete zooming gestures.
  - `cooperative_gestures.ts`: UX gate for blocking gestures until user intent is clear (tooltips, etc.).
  - `handler_util.ts`, `drag_handler.ts`, `drag_move_state_manager.ts`, `map_event.ts`, `tap_recognizer.ts`: Shared gesture parsing and move state management.
  - `handler/shim/*`: Compatibility shims for dblclick zoom, drag pan/rotate, and two-finger touch on platforms lacking pointer capture.
  - `transform-provider.ts`: Exposes the “desired” transform state to handlers (requested camera state or the actual transform) so accumulated deltas remain coherent.

Projections and Transforms
- `geo/projection/camera_helper.ts`
  - Role: Defines `ICameraHelper` interface and core helpers used by `ui/camera.ts` and handlers.
  - Key Exports: `ICameraHelper`, `updateRotation` (SLERP vs. Euler), `cameraForBoxAndBearing` (fit bounds with rotation).
  - Deltas Handling: `handleMapControlsRollPitchBearingZoom`, `handleMapControlsPan`, `handlePanInertia`, `handleEaseTo`, `handleFlyTo`.

- Projection-specific implementations
  - `mercator_camera_helper.ts`, `globe_camera_helper.ts`, `vertical_perspective_camera_helper.ts`: Implement `ICameraHelper` per projection.
  - `mercator_transform.ts`, `globe_transform.ts`, `vertical_perspective_transform.ts`: Implement `ITransform` math for each projection (center, zoom/scale, bearing/pitch/roll, screen/world conversions, clamping, and world size).
  - `mercator_utils.ts`: Project/unproject helpers used by camera math.
  - `projection.ts`, `projection_factory.ts`, `vertical_perspective_projection.ts`, `mercator_projection.ts`: Projection descriptors and factory wiring returning `{projection, transform, cameraHelper}`.

Geometry/Types
- `geo/lng_lat.ts`, `geo/lng_lat_bounds.ts`: Geographic primitives and bounds helpers.
- `geo/edge_insets.ts`: Padding model used for fit/camera calculations.
- `geo/mercator_coordinate.ts`: Mercator coordinate conversions.
- `geo/bounds.ts`: Screen/world bounds utilities used by hit-tests and camera queries.
- `geo/transform_interface.ts`: Contracts for `ITransform` and `IReadonlyTransform` used across camera/handlers.

Utilities
- `util/util.ts`: Bezier easing, clamping, angle math, zoom<->scale conversions, interpolation helpers, ID generators, deepEqual/clone, etc.
- `util/evented.ts`: Event system used by `Camera` to fire lifecycle events.
- `util/browser.ts`: Timing (`now`), RAF wrapper with AbortController, reduced-motion detection, URL resolver.
- `util/dom.ts`: DOM helpers for event registration and measurement used by handlers/manager.
- `util/task_queue.ts`: Task scheduling ID type used for animation frames.

Key Interaction Semantics To Replicate
- Multi-axis deltas: Combine `panDelta`, `zoomDelta`, `bearingDelta`, `pitchDelta`, `rollDelta` with priority rules and around-point constraints.
- Around/pivot logic: Zoom/rotate/pitch around pointer, center, or a specific `LngLat` with correct screen/world conversions.
- Inertia: Gesture momentum for pan/zoom/bearing/pitch/roll with safe clamping (bearing/roll wrap, pitch limits).
- Animation: `easeTo` and `flyTo` with curve/speed/screenSpeed, duration capping, reduced-motion, and cancellation semantics.
- Fit/cameraForBounds: Honor padding, offset, and maxZoom, including rotated bounds.
- State flags and events: Accurate start/move/end sequencing per axis and for overall move.
- Cooperative gestures: Optional blocking UX for scroll/zoom requiring modifier or repeated intent.

File Inventory (copied)
- See `maplibre_camera_controls/COPIED_FILES.txt` for the exact file list and paths.

