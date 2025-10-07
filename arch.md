# ARCHITECTURE_.md

## 1. Title & Summary

ThreeJS RoveMaps Camera Controls delivers MapLibre GL JS–style camera controls for Three.js scenes: jumpTo/
easeTo/flyTo/fitBounds, pan/zoom/rotate/pitch/roll, around-point anchoring, padding/offset, events, inertia, and
reduced-motion behavior. It exposes a single controller that maps MapLibre camera semantics onto a Three.js Camera,
with projection-agnostic transforms (planar first) and an input handler stack for pointer, wheel, touch, keyboard,
dblclick, box-zoom, and Safari gestures.

The result is a drop-in control system for 3D scenes that reproduces MapLibre’s “map feel” (naming, options,
constraints, events) while remaining renderer-agnostic and SSR-safe.

## 2. Context & Constraints

- Tech stack: TypeScript, Three.js PerspectiveCamera/OrthographicCamera, DOM Pointer/Touch/Wheel APIs.
Packaging emits ESM+CJS with types; peer dependency on three and sideEffects:false for tree-shaking
(package.json: "type":"module","main": "dist/index.cjs","module":"dist/index.js","types":"dist/
index.d.ts","sideEffects":false,"peerDependencies":{"three":">=0.153 <0.170"}) (package.json:1–25, 31–35, 43–45).
- Runtime: Browser-first with SSR/Next.js support. SSR stub factory createControllerForNext returns a no-op on
server and constructs the real controller on client after mount (src/public.ts:9–22).
- Reduced motion: easeTo auto-falls back to jumpTo if prefers-reduced-motion:reduce and essential:false (src/core/
cameraController.ts:193–199; src/util/browser.ts:1–7).
- Assumptions:
    - MapLibre parity uses public semantics where MapLibre source isn’t available in this repo; where behavior is
unspecified, assumptions are called out.
    - Default wheel anchoring parity may differ (MapLibre defaults vary by version; see Gaps).
- Known gaps:
    - easeTo does not implement the around anchoring option; only offset is honored (src/core/
cameraController.ts:192–228).
    - flyTo uses two modes (constant screen-speed and a simplified hyperbolic path). Exact MapLibre flight path
math and minZoom are not fully mirrored (src/core/cameraController.ts:314–325, 327–476).
    - Touch “two-finger pitch” gating is partially disabled to prioritize usability; thresholds and first-move
gates differ from MapLibre (src/handlers/touchMultiHandler.ts:205–241, comments at 221–238).

Parity intent: Strict behavioral parity with MapLibre GL JS naming, options, event model, and constraints
(README.md “Goals”; docs/Overview.md).

## 3. High-Level Architecture
flowchart LR
  subgraph DOM/Input
    A[Pointer/Mouse] -->|pointerdown/move/up| H
    B[Wheel] -->|wheel| H
    C[Touch] -->|pointerdown/move/up| H
    D[Keyboard] -->|keydown| H
    E[Safari Gesture] -->|gesturestart/change/end| H
    F[Dblclick/Box] -->|dblclick/pointer| H
  end

  H[Handler Manager\nhandlers/*] -->|axes + deltas| CC
  subgraph Core
    CC[CameraController\ncore/cameraController.ts] -->|setters + deferApply| T
    CC -->|events| EV[Evented]
  end

  subgraph Transform & Helpers
    T[Transform\ntransform/threePlanarTransform.ts] -->|apply to camera| CAM[THREE.Camera]
    HP[PlanarCameraHelper\nhelpers/planarCameraHelper.ts] -.-> H
    HP -.-> CC
  end

  CC -->|renderFrame| Consumer[App Render Loop]
  Consumer -->|resize| CC

  style HP fill:#eef,stroke:#88a
  style T fill:#ffe,stroke:#aa8
  style CC fill:#efe,stroke:#8a8
  style H fill:#fee,stroke:#a88
Subsystem boundaries:

- Core Controller: lifecycle, orchestration, animation, events, constraints.
- Transform: projection math and camera application; screen/world/ground conversions.
- Input Handlers: mouse/touch/wheel/keyboard/safari/dblclick/box-zoom with anchoring, inertia, rubberband.
- Helpers: projection-specific control math (planar; globe optional roadmap).
- Utils: math/easing/browser/DOM helpers and flight math.

## 4. Module & File Breakdown

- src/core/cameraController.ts
    - What: Main controller; MapLibre-style API (jumpTo, easeTo, flyTo, fitBounds), event lifecycle, constraints,
      animation. Optional bearing snap (disabled by default) and optional soft pan clamping (opt-in via `softPanBounds`).
    - Public API:
    - Constructor(opts: `CameraControllerOptions`) (src/core/cameraController.ts:14–29, 74–113, 114–118).
    - Query: `getCenter/Zoom/Bearing/Pitch/Roll/Padding` (src/core/cameraController.ts:139–144).
    - State: `isMoving` and axis flags (note: current `isZooming/isRotating/isPitching/isRolling` return false; see
Pitfalls) (src/core/cameraController.ts:146–150).
    - Setters: `setCenter/Zoom/Bearing/Pitch/Roll/Padding/Constraints` (src/core/cameraController.ts:152–158).
    - Navigation: `jumpTo` (src/core/cameraController.ts:160–169), `easeTo` (src/core/cameraController.ts:192–291),
`flyTo` (src/core/cameraController.ts:294–476), `fitBounds`/`cameraForBounds` (src/core/cameraController.ts:478–
485), `panBy`/`panTo`, `zoomTo/In/Out`, `rotateTo/By`, `pitchTo/By`, `rollTo/By` (src/core/cameraController.ts:171–
190).
    - Lifecycle: `setViewport`, `dispose` (dispose: cancels RAF, aborts ease, disposes handlers, axis end) (src/
core/cameraController.ts:120–138).
    - Events: `movestart/move/moveend`, `zoom*`, `rotate*`, `pitch*`, `roll*`, `drag*`, `renderFrame`, `error`
(src/core/cameraController.ts:31–52, 487–586).
- Key dependencies: PlanarCameraHelper (helpers), ThreePlanarTransform (transform), HandlerManager (input),
defaultEasing, browser timing (src/core/cameraController.ts:3–10, 193–199, 234–235, 250–281).
- Where used: Entrypoint via createController/createControllerForNext (src/public.ts:5–22).
- 
Where used: Entrypoint via createController/createControllerForNext (src/public.ts:5–22).
- 
src/core/evented.ts
    - What: Minimal event bus with on/once/off/fire; swallows listener errors with console.error (src/core/
evented.ts:1–22, 23–34).
    - Public API: on, once, off, fire.
    - Key dependencies: none external.
    - Where used: CameraController emits; handlers inform Controller through onChange.
- 
src/transform/interfaces.ts
    - What: Transform contracts and types: viewport, center/zoom/bearing/pitch/roll, padding, worldSize,
conversions, constraints (src/transform/interfaces.ts:1–64, 84–94).
    - Public API: ITransform, IReadonlyTransform, ThreePlanarTransformOptions, TransformConstraints,
worldSizeForZoom, Bounds2D, Padding types.
    - Where used: Transform implementation; helpers and handlers rely on groundFromScreen/adjustCenterByGroundDelta
(src/transform/interfaces.ts:40–64).
- 
src/transform/threePlanarTransform.ts
    - What: Planar projection that maps MapLibre camera state to Three camera position/up/lookAt with bearing/
pitch/roll, screen<->world/ground conversions, deferred apply, constraints and clamping (src/transform/
threePlanarTransform.ts:1–28, 80–157, 190–243, 281–344).
    - Public API: Implements ITransform.
    - Key dependencies: Three Vector3/Ray/Plane, math utils (normalize/clamp), worldSizeForZoom (src/transform/
threePlanarTransform.ts:5–11, 7th import is math).
    - Where used: Controller and all handlers.
    - Notes:
    - Bearing negated so increasing bearing rotates view clockwise (view semantics vs camera orbit) (src/transform/
threePlanarTransform.ts:215–223, 295–303).
    - Pooled vectors and `deferApply` to reduce allocations on hot paths (src/transform/threePlanarTransform.ts:18–
26, 120–134).

- src/helpers/planarCameraHelper.ts
    - What: MapLibre-style control math for planar scenes: screen-space pan mapping, combined roll/pitch/bearing/
zoom updates, fit-bounds solve, anchor corrections (src/helpers/planarCameraHelper.ts:1–8, 9–27, 29–47, 73–139).
    - Public API: ICameraHelper methods: handleMapControlsPan, handleMapControlsRollPitchBearingZoom,
cameraForBoxAndBearing, etc. (src/helpers/icameraHelper.ts:1–38).
    - Where used: Controller and handlers use helper to apply deltas consistently.
    - Where used: Controller and handlers use helper to apply deltas consistently.
- 
src/handlers/*
    - handlerManager.ts
    - What: Wires up all input handlers to an element; suppresses contextmenu; optional Safari gestures; emits
`onChange` to Controller (src/handlers/handlerManager.ts:1–18, 23–50, 91–118, 133–162, 193–218).
    - Public API: `HandlerManager(options)` with toggles and friction settings (src/handlers/handlerManager.ts:1–
21).
    - Defaults: scrollZoom enabled with `{around:'center'}` if unspecified; mouse pan/rotate-pitch/touch/keyboard/
dblclick/boxZoom enabled; Safari gestures optional (src/handlers/handlerManager.ts:114–121, 137–162, 166–175, 183–
192, 202–218).
- scrollZoomHandler.ts
    - What: Wheel/trackpad zoom with classifier (pixel vs line), pointer anchoring, optional cooperative gestures
(require ctrl/meta), zoom inertia (decay) (src/handlers/scrollZoomHandler.ts:1–19, 27–39, 90–114, 116–134, 136–
160).
    - API: Options `around`, `maxDeltaPerEvent`, `cooperative`, `anchorTightness`, `onWheelModeChange`, `zoomSign`
(src/handlers/scrollZoomHandler.ts:7–19).
- mousePanHandler.ts
    - What: Left-drag pan with ground anchoring, rubberband near/outside pan bounds, ground-space inertia and
directional clamps (src/handlers/mousePanHandler.ts:1–17, 51–70, 94–117, 118–169, 176–215, 223–260).
    - Notes: Converts screen dx/dy into ground deltas using bearing and scale when anchor unavailable (src/
handlers/mousePanHandler.ts:139–156).
- mouseRotatePitchHandler.ts
    - What: Right-drag rotate (dx) + pitch (dy) with optional pitch-only via modifier; around-pointer anchoring
(optional) (src/handlers/mouseRotatePitchHandler.ts:1–17, 42–76, 90–120, 121–151).
- touchMultiHandler.ts
    - What: Two-finger pinch/rotate/pitch + one-finger pan; centroid anchoring; rubberband; inertia per axis;
VisualViewport offset handling (iOS); sign/inertia clamps to avoid backslide (src/handlers/touchMultiHandler.ts:1–
31, 139–169, 170–214, 215–241, 300–381, 382–420, 420–476).
    - Notes: Pitch gating comments show MapLibre-like semantics partially disabled (src/handlers/
touchMultiHandler.ts:221–238).
- keyboardHandler.ts
    - What: Arrow pan, +/- zoom, Q/E rotate, PageUp/Down pitch with preventDefault and edit-field guard (src/
handlers/keyboardHandler.ts:1–19, 25–38, 54–95).
- dblclickHandler.ts
    - What: Dblclick and double-tap zoom around pointer; Shift invert (src/handlers/dblclickHandler.ts:1–16, 36–58,
61–77, 92–110).
- boxZoomHandler.ts
    - What: Shift+drag box zoom; fit via projection-based solver or fallback (src/handlers/boxZoomHandler.ts:1–16,
41–69, 70–107).
- safariGestureHandler.ts
    - What: Desktop Safari trackpad pinch/rotate via `gesture*` events with pointer anchoring (experimental,
opt-in) (src/handlers/safariGestureHandler.ts:1–17, 19–43, 45–74, 76–105).

- src/util/*
    - math.ts: clamp/lerp/angle normalization; zoom scale conversions (src/util/math.ts:1–22).
    - easing.ts: default easing (easeOutQuad) and cubicBezier helper (src/util/easing.ts:1–23).
    - browser.ts: now, reduced-motion; RAF/CANCEL wrappers (src/util/browser.ts:1–15).
    - dom.ts: on/off helpers (src/util/dom.ts:1–17).
    - flight.ts: flight path math (Van Wijk-like parameters) used in flyTo (src/util/flight.ts:1–37, 39–56).
    - flight.ts: flight path math (Van Wijk-like parameters) used in flyTo (src/util/flight.ts:1–37, 39–56).
- 
src/public.ts
    - What: Stable entry exports and SSR factory (src/public.ts:1–22).
    - API: createController, createControllerForNext.

## 5. Lifecycle & Data Flow

- Construction
    - Controller constructs transform and registers handlers on the provided domElement. SSR path avoids DOM access
and returns early; constraints seeded; default handlers configured (src/core/cameraController.ts:74–91, 93–113,
114–121).
- Handler registration
    - HandlerManager attaches listeners (pointer, wheel, key, dblclick, box, safari) and suppresses native
contextmenu to allow right-drag rotate/pitch (src/handlers/handlerManager.ts:31–40, 91–118, 133–162, 183–192, 202–
218).
- Gesture pipeline
    - Input deltas (dx/dy/dz/db/dp) are converted to transform updates via helper functions:
    - Pan mapping rotates screen deltas by bearing and scales by 2^zoom to ground-space (src/helpers/
planarCameraHelper.ts:9–20).
    - Combined roll/pitch/bearing/zoom updates deferred-applied for batch performance (src/helpers/
planarCameraHelper.ts:30–47).
    - Around-point anchoring preserves the ground point under pointer/centroid by adjusting center using
`groundBefore - groundAfter` (e.g., scroll zoom: src/handlers/scrollZoomHandler.ts:129–160; touch zoom/rotate/
pitch: src/handlers/touchMultiHandler.ts:343–368, 370–381).
- Transform applies camera state: computes camera position/up/lookAt from center/zoom/bearing/pitch/roll; negates
bearing so positive bearings rotate view clockwise; applies roll as world-axis rotation about look vector; updates
projection matrices as needed (src/transform/threePlanarTransform.ts:205–249, 250–283, 284–344).
- Event emission
    - For gesture-driven changes, handlers call onChange which drives _externalChange to emit per-axis start/
during/end events with debounced moveend (src/core/cameraController.ts:506–523, 525–547). Animations (easeTo/flyTo)
emit start/during/end and renderFrame on each frame (src/core/cameraController.ts:236–246, 276–291, 415–470, 487–
489).
- Inertia
    - For pan/zoom/rotate/pitch (varies per handler), velocities are estimated and decayed; ground-space inertia
integrates directly into center updates; rubberband damping applies near/outside pan bounds (mouse pan: src/
handlers/mousePanHandler.ts:223–260; touch: src/handlers/touchMultiHandler.ts:420–476; scroll zoom: src/handlers/
scrollZoomHandler.ts:136–160).
- Cancellation & conflicts
    - A new easeTo/flyTo aborts any previous animation via AbortController and still completes axis end/moveend
lifecycle (src/core/cameraController.ts:246–249; tests/cancelation.test.ts verify) (tests/cancelation.test.ts:43–
66).

## 6. Configuration & Secrets

- Controller options
    - View: width/height/devicePixelRatio, projection:'planar' (src/core/cameraController.ts:14–21).
    - Constraints: minZoom/maxZoom, minPitch/maxPitch, optional panBounds, optional soft clamping (softPanBounds),
      optional bearingSnap/bearingSnapEpsilon (bearing snap disabled by default) (src/core/
cameraController.ts:21–28, 102–111).
- HandlerManager options
    - Global: rubberbandStrength, anchorTightness, per-axis inertia frictions, rightButtonPan, suppressContextMenu
(src/handlers/handlerManager.ts:1–21).
    - Per-handler toggles and options (scroll zoom, mouse pan/rotate-pitch, touch, keyboard, dblclick, box zoom,
safari gesture) (src/handlers/handlerManager.ts:1–21, 91–121, 133–162, 166–175, 183–192, 202–218).
- SSR/Next.js
    - Use createControllerForNext(() => ({ camera, domElement, ... })) inside client components; server returns
no-op stub to avoid DOM access (src/public.ts:9–22). Resize via setViewport wired with ResizeObserver (examples/
next-pages/pages/index.tsx:8–25).
- Failure modes
    - Invalid/missing DOM/camera on server: SSR guard returns early in constructor (src/core/
cameraController.ts:74–91).
    - dispose on SSR path references window.clearTimeout and window.setTimeout indirectly; if invoked server-side,
may throw unless guarded (see Pitfalls) (src/core/cameraController.ts:512–521, 582–585).
    - easeTo ignores around option (not implemented) — anchoring must be performed by handlers or using offset
(src/core/cameraController.ts:192–228).

## 7. Observability & Operations

- Events
    - Per-axis start/during/end plus aggregate move* and per-frame renderFrame (src/core/cameraController.ts:31–52,
487–503, 525–547). Attach listeners via on/once/off (src/core/evented.ts:1–22).
- Logs
    - Event listener exceptions are caught and logged via console.error (src/core/evented.ts:23–34).
- Metrics & debug
    - Not built-in; recommended to subscribe to renderFrame for frame cadence and timing deltas, and hook device/
browser flags in your app.
- Feature flags
    - Handler options act as feature toggles: cooperative scroll zoom, safariGestures, right button pan, invert
signs, anchor tightness, rubberband strength (src/handlers/*).
- Running locally
    - Typecheck/tests: npm run -s typecheck, npm run -s test (README.md “Test Commands”; package.json scripts)
(package.json:31–39).
    - Demo site: examples/site with Vite; see docs/Examples.md (docs/Examples.md:12–17).
- Reproducing parity issues
    - Use the demo’s toggles (see README “Notes on Parity…”) and onChange logs; write focused vitest cases like
aroundpoint*.test.ts and fitbounds.test.ts patterns (tests/*.test.ts).

## 8. Security & Privacy

- Threat points
    - DOM element references: passing external elements risks XSS if untrusted code mutates listeners. Handlers
attach event listeners; no innerHTML usage found.
    - Event spoofing: Synthetic events could drive camera unexpectedly; mitigated by scoping handlers to provided
element and pointerType checks (e.g., mouse-only in mouse handlers) (src/handlers/mousePanHandler.ts:88–93; src/
handlers/mouseRotatePitchHandler.ts:55–63).
    - SSR pitfalls: Accessing window on server can throw; controller is guarded at construction, but see dispose
caveat (src/core/cameraController.ts:74–91).
- Mitigations
    - All DOM access is feature-detected; SSR factory avoids building handlers on server (src/public.ts:9–22; src/
core/cameraController.ts:74–91).
    - Context menu suppressed at capture phase to prevent OS UI during right-drag rotate/pitch (src/handlers/
handlerManager.ts:31–40).
    - Touch handlers detect pointerType to avoid double-handling and apply VisualViewport offsets to reduce
unexpected deltas (src/handlers/touchMultiHandler.ts:170–214).

## 9. Performance

- Hot paths
    - Pointer move/wheel/touch move: anchoring computes groundFromScreen via unproject + plane intersection; pooled
Vector3/Ray/Plane and deferApply reduce allocations (src/transform/threePlanarTransform.ts:18–26, 120–134, 190–
243).
    - Inertia loops run per-frame with exponential decay; axis-specific frictions tune runtime (src/handlers/
mousePanHandler.ts:223–260; src/handlers/touchMultiHandler.ts:420–476; src/handlers/scrollZoomHandler.ts:136–160).
- GC pressure
    - Transform reuses vectors; handlers cache DOMRect but refresh per-move on mobile to avoid viewport drift (src/
handlers/touchMultiHandler.ts:170–214).
- N+1 events
    - Controller batches transform setters inside deferApply during animation frames; handlers often
co-apply deltas to avoid intermediate states (src/transform/threePlanarTransform.ts:120–134; src/handlers/
touchMultiHandler.ts:359–367).
- Quick wins
    - Use passive listeners where safe (already used in several handlers).
    - Batch set operations during animations (already using deferApply).
- Profiling plan
    - Instrument renderFrame to gather frame durations and handler latencies.
    - Toggle anchor tightness and rubberband to quantify anchoring corrections/frame.
    - Validate RAF batching with performance marks in easeTo/flyTo loops.

## 10. Pitfalls & Risks (very specific)

- Symptom: isZooming/isRotating/isPitching/isRolling always return false.
    - Root cause: Accessors are hardcoded false instead of returning private flags.
    - Evidence: src/core/cameraController.ts:146–150.
    - Severity: Medium (API correctness; diagnostic tooling).
    - Fix: Return _zooming/_rotating/_pitching/_rolling.
    - Fix: Return _zooming/_rotating/_pitching/_rolling.
- 
Symptom: Calling dispose() in SSR can throw ReferenceError: window is not defined.
    - Root cause: Uses window.clearTimeout and window.setTimeout regardless of environment.
    - Evidence: src/core/cameraController.ts:512–521, 582–585.
    - Severity: Medium (SSR safety).
    - Fix: Guard with typeof window !== 'undefined' in dispose and soft-pan bounds.
- 
Symptom: easeTo({ around }) does not anchor around a screen point.
    - Root cause: Option exists in types but not applied; only offset is implemented for target center.
    - Evidence: src/core/cameraController.ts:192–228.
    - Severity: Medium (parity gap).
    - Fix: Implement around-point anchoring using groundFromScreen(pointer) and adjustCenterByGroundDelta during
animation frames.
- 
Symptom: Desktop wheel zoom continues with inertia after input stops (feels “floaty” vs MapLibre).
    - Root cause: ScrollZoomHandler implements zoom inertia with friction-based decay.
    - Evidence: src/handlers/scrollZoomHandler.ts:136–160.
    - Severity: Low–Medium (behavioral parity; platform preference).
    - Fix: Gate inertia behind option (default off) and tune to match MapLibre (smoothing, not inertia).
- 
Symptom: Two-finger pitch sometimes enters pinch/rotate or requires timing not consistent with MapLibre.
    - Root cause: Pitch gating logic is partially disabled; thresholds differ.
    - Evidence: src/handlers/touchMultiHandler.ts:221–238 (commented gating), 205–214 (thresholds).
    - Severity: Medium (touch parity).
    - Fix: Reintroduce gating windows (allowedSingleTouchTimeMs, pitchFirstMoveWindowMs) per MapLibre and adjust
thresholds per profile.
- 
Symptom: dispose() doesn’t end axis states if a gesture is mid-flight.
    - Root cause: Axis termination order is correct but relies on window timers; SSR paths may skip cleanup.
    - Evidence: src/core/cameraController.ts:534–555, 512–521.
    - Severity: Low.
    - Fix: Ensure _endAllAxes() always runs and timer guards handle SSR.
- 
Symptom: Rotate sign confusion between transform and handlers.
    - Root cause: Transform negates bearing to achieve clockwise-positive view; touch handler negates rotation
deltas to compensate.
    - Evidence: src/transform/threePlanarTransform.ts:215–223; src/handlers/touchMultiHandler.ts:357–368.
    - Severity: Low (internal consistency).
    - Fix: Document sign conventions; centralize sign mapping.

## 11. Recommendations & Roadmap

- Short-term
    - Fix isZooming/isRotating/isPitching/isRolling accessors (tests to cover) (src/core/cameraController.ts:146–
150).
   
    - Make wheel zoom inertia opt-in (default off) to match MapLibre.
- Medium-term
    - Formalize transform ground axis naming ({x,z}) and ensure consistent worldToScreen across pitches (remove
stub fallbacks).
    - Adopt exact MapLibre flight math (Van Wijk params, rho/minZoom handling), and extend tests to strict
endpoints.
    - Fit-bounds rigor at nonzero pitch/bearing via projection-based containment checks; expand tests.
- Long-term
    - Optional spherical/globe projection helper (README “Roadmap”) with transform and helper specialization.
    - Platform profiles (macOS trackpad vs mouse) for default signs, thresholds, and friction.
    - Documentation hardening with parity matrices and per-handler defaults.

Parity Matrix (MapLibre → RoveMaps)

- API: jumpTo
    - Parity: Yes — sets center/zoom/bearing/pitch/roll/padding synchronously (src/core/cameraController.ts:160–
169).
    - Differences: None noted.
    - Gaps: None.
    - Next Steps: N/A.
- API: easeTo
    - Parity: Partial — duration/easing/animate/essential/offset/padding supported; events and bearingSnap applied
at end (src/core/cameraController.ts:192–291, 283–286).
    - Differences: around option ignored (anchoring not applied).
    - Gaps: Implement around anchoring.
    - Next: Add pointer/centroid anchoring similar to handlers.
- API: flyTo
    - Parity: Partial — supports curve/speed/screenSpeed and duration capping; interpolates center/zoom/bearing/
pitch/roll (src/core/cameraController.ts:314–325, 431–466).
    - Differences: Constant screen-speed mode; hyperbolic path approximated; minZoom not applied.
    - Gaps: Full MapLibre path with rho/minZoom; around-point during flight.
    - Next: Integrate flight math (src/util/flight.ts) end-to-end and add tests.
- API: fitBounds / cameraForBounds
    - Parity: Yes (planar): binary search zoom to fit within padded viewport and apply offset in rotated
screen-space (src/helpers/planarCameraHelper.ts:89–139).
    - Differences: Precision at high pitch/bearing depends on worldToScreen.
    - Gaps: Validate vs MapLibre with pitch/bearing stress tests.
    - Next: Expand tests; refine projection branch.
- Events
    - Parity: Yes — axis-specific + move lifecycle with originalEvent propagation (src/core/cameraController.ts:31–
52, 525–547).
    - Differences: None notable.
    - Gaps: N/A.
    - Next: Add move throttling option if needed.

## 12. References

- Core
    - src/core/cameraController.ts:14–29 (options), 74–91 (SSR guard), 93–113 (DOM path), 114–121 (handlers), 139–
144 (getters), 146–150 (is*), 152–158 (setters), 160–169 (jumpTo), 171–190 (pan/zoom/rotate/pitch/roll helpers),
192–228 (easeTo options/offset), 234–246 (ease lifecycle start), 250–281 (loop), 283–291 (bearingSnap+end), 294–325
(flyTo setup/duration), 415–470 (fly loop/end), 478–485 (fit/cameraFor), 487–489 (renderFrame), 506–523 (external
change debounce), 525–547 (axis events), 557–566 (bearingSnap impl), 569–586 (soft pan bounds).
    - src/core/evented.ts:1–22 (API), 23–34 (error handling).
- Transform & Helpers
    - src/transform/interfaces.ts:1–64 (ITransform contract), 84–94 (constraints).
    - src/transform/threePlanarTransform.ts:18–26 (pooled vectors), 80–97 (viewport setters), 190–243
(screenToWorld), 281–344 (worldToScreen/ground/center), 205–223 (perspective apply with negated bearing), 295–303
(ortho apply), 120–134 (deferApply).
    - src/helpers/icameraHelper.ts:1–38 (public helper API).
    - src/helpers/planarCameraHelper.ts:9–20 (pan mapping), 29–47 (combined axis apply), 89–139 (fit bounds solve/
offset).
- Handlers
    - src/handlers/handlerManager.ts:31–40 (contextmenu suppression), 114–121 (scrollZoom defaults), 133–162 (mouse
handlers), 166–175 (touch), 183–192 (keyboard), 202–218 (safari gestures).
    - src/handlers/scrollZoomHandler.ts:7–19 (options), 90–114 (wheel delta to zoom), 116–134 (anchor correction),
136–160 (inertia loop).
    - src/handlers/mousePanHandler.ts:118–169 (anchored pan + rubberband), 139–156 (bearing-aware fallback), 223–
260 (ground-space inertia).
    - src/handlers/mouseRotatePitchHandler.ts:90–120 (rotate/pitch deltas + anchoring).
    - src/handlers/touchMultiHandler.ts:205–214 (thresholds), 221–238 (gating comments), 300–381 (pan mode +
rubberband + velocities), 343–368 (zoom/rotate around-point), 420–476 (inertia).
    - src/handlers/dblclickHandler.ts:36–58 (dblclick), 92–110 (anchor correction).
    - src/handlers/boxZoomHandler.ts:70–107 (fit/screen fallback).
    - src/handlers/safariGestureHandler.ts:45–74 (apply zoom/rotate with anchoring).
- Utils & Packaging
    - src/util/browser.ts:1–15 (reducedMotion, raf/caf).
    - src/util/easing.ts:1–7 (defaultEasing).
    - src/util/flight.ts:1–37, 39–56 (fly params).
    - package.json:1–25, 31–39, 43–45 (ESM/CJS/types, scripts, peer deps, sideEffects).
- Docs & Examples
    - docs/SSR-Next.md:3–12 (Next usage).
    - examples/next-pages/pages/index.tsx:8–25 (ResizeObserver wiring).
    - README.md: Quick links and parity notes.

External references

- MapLibre GL JS Camera API: https://maplibre.org/maplibre-gl-js/docs/API/classes/Map#jumpTo
- Pointer Events: https://w3c.github.io/pointerevents/
- Wheel Events: https://www.w3.org/TR/uievents/#events-wheelevents
- VisualViewport API (iOS): https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
