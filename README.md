# ThreeJS RoveMaps Camera Controls (WIP)

Quick links
- Live Demo: https://russellmiddleton33.github.io/rovemaps-camera-controls/demo/
- Documentation: https://russellmiddleton33.github.io/rovemaps-camera-controls/

Drop-in GL JS camera controls for Three.js scenes with (jumpTo/easeTo/flyTo/fitBounds, pan/zoom/rotate/pitch/roll, around-point, padding/offset, events, inertia, reduced motion).


- In progress / next up:
- Not started (planned):
  - Globe/spherical projection helper.
  

## Quick Start (conceptual)

- Install: `npm i three three-rovemaps-camera-controls` (WIP)
- Use:

```ts
import { createController } from 'three-rovemaps-camera-controls';
const controller = createController({ camera, domElement, width, height });
controller.jumpTo({ center: { x: 0, y: 0 }, zoom: 2 });
```

SSR/Next.js:

```ts
import { createControllerForNext } from 'three-rovemaps-camera-controls';
const controller = createControllerForNext(() => ({ camera, domElement }));
```

## Goals

- Maping parity for camera API, gestures, events, inertia, and semantics.
- Projection-agnostic design with a Planar helper first; optional spherical/globe.
- SSR hardened; Next.js examples (Pages and App Router) with ResizeObserver wiring.

## Repository Structure

- `src/core`: controller, event system
- `src/transform`: interfaces + ThreePlanarTransform
- `src/helpers`: projection-specific camera helpers
- `src/handlers`: input handlers + manager (TBD)
- `src/util`: math, easing, browser, dom helpers
- `examples/`: Next.js stubs
- `tests/`: unit tests (vitest)

## Roadmap

- M1: Core abstractions (ITransform, Evented, utils) + PlanarCameraHelper stub
- M2: CameraController (jump/ease) + baseline handlers + examples
- M3: Full handlers (rotate/pitch/roll, touch, dbl/tap/box) + inertia
- M4: flyTo, fitBounds rigor, around-point invariants, cooperative gestures
- M5: Tests, docs, packaging; first beta
- M6: Optional spherical/globe projection

## Types & Packaging

- ESM + CJS with types, `sideEffects:false`, `three` as peerDependency.
- Strict TS; no `any` in public APIs.

## License

MIT

## Notes on Parity, Anchoring, and Inertia (Ongoing)

This project aims for 1:1 MapLibre camera feel. While iterating with a real Mac trackpad and different browsers, we uncovered several subtle sources of “almost right” behavior. This section documents the issues observed, changes made, and what remains to be tuned so others can reproduce and validate.

What was off (symptoms reported)
- Pointer-anchored zoom felt “random”—zoom appeared around center, not under the cursor.
- Pan at non‑zero bearing felt reversed in one axis.
- Right‑drag rotate/pitch popped a context menu (“Save image as”).
- Vertical/horizontal inertia sometimes glided opposite the direction of the drag (especially on Mac trackpads with natural scrolling).
- Trackpad twist/pinch anchoring weaker than pan anchoring.
- Demo blur while dragging (antialias vs DPR).
- Demo/Docs caching on Pages produced stale bundles or runtime TDZ errors unrelated to the demo.

What we changed (so far)
- Pointer anchoring: Zoom/rotate/pitch/pan now preserve the exact ground point under the pointer/centroid by shifting center with groundBefore − groundAfter deltas (MapLibre‑style setLocationAtPoint). This eliminated drift and made “grab the map” behavior precise.
- Pan mapping: Panning is rotated by bearing before converting to ground deltas so drag directions match screen intent at any bearing.
- Right‑drag rotate+pitch: Supports combined rotate (dx) + pitch (dy) with optional pitch‑only via modifier. We suppress the native context menu at capture phase to avoid “Save image” interruptions.
- Safari gestures: Added a handler for gesturestart/gesturechange (pinch/rotate). It uses the same ground anchoring and anchor‑tightness correction as other gestures.
- Inertia in ground space: Inertia now maps the last screen velocity to ground velocity (bearing+scale) and applies center updates directly in ground coordinates. We fixed a double sign application in velocity that caused “kick back” in one axis.
- Rubberband damping: Damping now applies to sign‑adjusted ground deltas so resistance follows your selected direction (no more fighting the user when inverted).
- Tunable signs and tightness: Exposed invert toggles (Zoom/Pitch/Twist/Pan‑Y/Inertia‑X/Inertia‑Y) and an Anchor Tightness slider (0..1) to dial how strongly the pointer stays pinned across gestures.
- Demo hardening: Added Show Debug Gizmos (world/camera axes, pointer anchor, velocity arrow), an Antialias toggle (to isolate blur), a “Center on Down” option (optional UX), and started the demo more zoomed out.
- Three.js dedupe: The demo and library now share the same Three instance to avoid “Multiple instances of Three.js”.
- Docs link: Switched the demo button to a direct absolute link to avoid VitePress bundle caching pitfalls during iteration.

How to calibrate quickly (demo)
- Flip only the toggles that feel “wrong” on your device. Common Mac trackpad defaults many prefer:
  - Invert Pitch: ON (drag down tilts forward)
  - Invert Pan Y: ON if vertical drag at a bearing feels reversed
  - Invert Inertia Y/X: ON if glide after release goes opposite your flick
  - Anchor Tightness: 1.0 (then adjust down if you prefer looser pointer lock)
  - Rubberband: ~0.2–0.3
  - Around Pointer: ON for zoom, OFF for rotate/pitch (mouse) if you prefer MapLibre’s center‑anchored rotation
- Use Show Debug Gizmos: the green velocity arrow shows glide direction; it should match the way you flicked.

Known differences / next steps
- Anchor policy defaults: MapLibre typically anchors wheel/dblclick zoom to the pointer, drag pan to the pointer, mouse rotate/pitch to center (touch rotates around centroid). We will lock these defaults in the library and let pointer anchoring for rotate/pitch be opt‑in via options.
- Platform defaults: We’ll define sensible default signs per platform (macOS trackpad with natural scrolling vs external mouse) and expose a single “platform profile” switch.
- Flight path math: Replace the approximated Van Wijk path with MapLibre’s exact formula (rho/minZoom handling) so flight tests pass strict endpoints without loosened tolerances.
- Fit bounds rigor: Use projection checks at higher pitch/bearing and confirm the binary‑search fit under padding/offset matches MapLibre semantics exactly.
- Transform refactor: Formalize center as {x,z} across the transform to remove any remaining ambiguity (ground helpers already isolate the mapping).
- Docs deploy: Keep the demo isolated from docs bundling during active iteration to avoid user‑visible TDZ cache issues.

If you see behavior that still differs from MapLibre on your device, please share:
- OS + browser, input (trackpad vs mouse), “natural scrolling” setting
- Which toggles you needed (Invert Pitch/Pan‑Y/Inertia X/Y, Anchor Tightness)
- A short clip or screenshot of the debug gizmos (green velocity arrow and world axes)

We’ll codify those as defaults (per platform) and add tests so the feel is correct out of the box.
